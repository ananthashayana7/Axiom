'use server'

import { db } from "@/db";
import { rfqs, rfqItems, rfqSuppliers, suppliers, parts } from "@/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { parseOffer } from "./ai-agents";

export async function getRFQs() {
    const session = await auth();
    if (!session) return [];

    const role = (session.user as any).role;
    const supplierId = (session.user as any).supplierId;

    try {
        // Direct query through rfqSuppliers if it's a supplier
        if (role === 'supplier') {
            const vendorRfqs = await db.select({
                id: rfqs.id,
                title: rfqs.title,
                status: rfqs.status,
                createdAt: rfqs.createdAt,
            })
                .from(rfqSuppliers)
                .innerJoin(rfqs, eq(rfqSuppliers.rfqId, rfqs.id))
                .where(eq(rfqSuppliers.supplierId, supplierId))
                .orderBy(desc(rfqs.createdAt));
            return vendorRfqs as any;
        }

        return await db.query.rfqs.findMany({
            with: {
                suppliers: {
                    with: {
                        supplier: true
                    }
                },
                items: {
                    with: {
                        part: true
                    }
                }
            },
            orderBy: (rfqs: any, { desc }: any) => [desc(rfqs.createdAt)]
        });
    } catch (error) {
        console.error("Failed to fetch RFQs:", error);
        return [];
    }
}

export async function getRFQById(id: string) {
    const session = await auth();
    if (!session) return null;

    const role = (session.user as any).role;
    const supplierId = (session.user as any).supplierId;

    try {
        const rfq = await db.query.rfqs.findFirst({
            where: eq(rfqs.id, id),
            with: {
                suppliers: {
                    with: {
                        supplier: true
                    }
                },
                items: {
                    with: {
                        part: true
                    }
                },
                documents: true
            }
        });

        if (!rfq) return null;

        // If supplier, verify they are invited
        if (role === 'supplier') {
            const isInvited = rfq.suppliers.some((s: any) => s.supplierId === supplierId);
            if (!isInvited) return null;
        }

        return rfq;
    } catch (error) {
        console.error("Failed to fetch RFQ:", error);
        return null;
    }
}

/**
 * AI-Powered Automated Supplier Selection
 * Ranks suppliers based on category match, performance, and risk.
 */
export async function recommendSuppliers(partIds: string[]) {
    try {
        // 1. Get categories of the requested parts
        const requestedParts = await db.select().from(parts).where(inArray(parts.id, partIds));
        const requestedCategories = Array.from(new Set(requestedParts.map((p: any) => p.category)));

        // 2. Find active suppliers that match these categories
        const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.status, 'active'));

        const recommendations = allSuppliers
            .filter((s: any) => {
                if (!s.categories) return false;
                return s.categories.some((cat: any) => requestedCategories.includes(cat));
            })
            .map((s: any) => {
                // Scoring Formula: Performance (weight 0.7) - Risk (weight 0.3)
                const performanceWeight = 0.7;
                const riskWeight = 0.3;
                const score = (s.performanceScore || 0) * performanceWeight - (s.riskScore || 0) * riskWeight;

                return {
                    ...s,
                    matchScore: Math.round(score),
                    matchReasons: [
                        s.performanceScore! > 80 ? "High performance history" : null,
                        s.riskScore! < 20 ? "Very low risk profile" : null,
                        "Category specialist"
                    ].filter(Boolean)
                };
            })
            .sort((a: any, b: any) => b.matchScore - a.matchScore)
            .slice(0, 3); // Top 3

        return recommendations;
    } catch (error) {
        console.error("AI Supplier Selection failed:", error);
        return [];
    }
}

export async function createRFQ(title: string, description: string, items: { partId: string; quantity: number }[]) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // 1. Create RFQ
        const [newRfq] = await db.insert(rfqs).values({
            title,
            description,
            status: 'draft'
        }).returning();

        // 2. Add Items
        if (items.length > 0) {
            await db.insert(rfqItems).values(
                items.map(item => ({
                    rfqId: newRfq.id,
                    partId: item.partId,
                    quantity: item.quantity
                }))
            );
        }

        // 3. Automated Supplier Selection (Initial Draft)
        const suggestedSuppliers = await recommendSuppliers(items.map(i => i.partId));
        if (suggestedSuppliers.length > 0) {
            await db.insert(rfqSuppliers).values(
                suggestedSuppliers.map((s: any) => ({
                    rfqId: newRfq.id,
                    supplierId: s.id,
                    status: 'invited' as const
                }))
            );
        }

        await logActivity('CREATE', 'rfq', newRfq.id, `RFQ '${title}' created with ${suggestedSuppliers.length} AI-recommended suppliers.`);

        revalidatePath("/sourcing/rfqs");
        return { success: true, rfqId: newRfq.id };
    } catch (error) {
        console.error("Failed to create RFQ:", error);
        return { success: false, error: "Failed to create RFQ" };
    }
}

export async function updateRFQStatus(id: string, status: 'draft' | 'open' | 'closed' | 'cancelled') {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        await db.update(rfqs).set({ status }).where(eq(rfqs.id, id));
        await logActivity('UPDATE', 'rfq', id, `RFQ status updated to ${status.toUpperCase()}`);

        revalidatePath("/sourcing/rfqs");
        revalidatePath(`/sourcing/rfqs/${id}`);
        revalidatePath("/portal/rfqs");

        return { success: true };
    } catch (error) {
        console.error("Failed to update RFQ status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function processQuotation(rfqSupplierId: string, quoteText: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        // 1. Verify access (if supplier, must be their own record)
        const [rs] = await db.select().from(rfqSuppliers).where(eq(rfqSuppliers.id, rfqSupplierId));
        if (!rs) return { success: false, error: "Record not found" };

        if ((session.user as any).role === 'supplier' && (session.user as any).supplierId !== rs.supplierId) {
            return { success: false, error: "Unauthorized" };
        }

        // Use AI to parse the quotation
        let analysis;
        try {
            // We use the same prompt logic but for text
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `
                Analyze this quotation text and extract structured data:
                "${quoteText}"

                Return JSON format:
                {
                    "totalAmount": number,
                    "deliveryWeeks": number,
                    "terms": string,
                    "highlights": string[],
                    "aiConfidence": number
                }
                Return ONLY the JSON.
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } catch (aiError) {
            console.error("AI Quotation Parsing failed, using fallback:", aiError);
            analysis = {
                totalAmount: 0,
                deliveryWeeks: 0,
                terms: "Error parsing quote",
                highlights: ["AI parsing failed"],
                aiConfidence: 0
            };
        }

        const analysisString = JSON.stringify(analysis);

        await db.update(rfqSuppliers)
            .set({
                aiAnalysis: analysisString,
                quoteAmount: (analysis.totalAmount || 0).toString(),
                status: 'quoted'
            })
            .where(eq(rfqSuppliers.id, rfqSupplierId));

        revalidatePath(`/sourcing/rfqs/${rs.rfqId}`);
        revalidatePath(`/portal/rfqs/${rs.rfqId}`);
        revalidatePath("/portal/rfqs");

        await logActivity('UPDATE', 'rfq_supplier', rfqSupplierId, `AI parsed quotation for RFQ. Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`);

        return { success: true, analysis: analysis };
    } catch (error) {
        console.error("Failed to process quotation:", error);
        return { success: false, error: "Failed to process quotation" };
    }
}

export async function processQuotationFile(rfqSupplierId: string, fileData: string, fileName: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const [rs] = await db.select().from(rfqSuppliers).where(eq(rfqSuppliers.id, rfqSupplierId));
        if (!rs) return { success: false, error: "Record not found" };

        const result = await parseOffer(fileData, fileName);
        if (!result.success) return { success: false, error: result.error };

        const analysis = {
            totalAmount: result.data.totalAmount,
            deliveryWeeks: parseInt(result.data.deliveryLeadTime) || 4,
            terms: result.data.paymentTerms || "Standard",
            highlights: [
                `Validity: ${result.data.validityPeriod}`,
                `Supplier Identified: ${result.data.supplierName}`
            ],
            aiConfidence: 90
        };

        const analysisString = JSON.stringify(analysis);

        await db.update(rfqSuppliers)
            .set({
                aiAnalysis: analysisString,
                quoteAmount: (analysis.totalAmount || 0).toString(),
                status: 'quoted'
            })
            .where(eq(rfqSuppliers.id, rfqSupplierId));

        revalidatePath(`/sourcing/rfqs/${rs.rfqId}`);
        revalidatePath("/portal/rfqs");

        await logActivity('UPDATE', 'rfq_supplier', rfqSupplierId, `AI parsed file quotation '${fileName}'. Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`);

        return { success: true, analysis };
    } catch (error) {
        console.error("Failed to process quotation file:", error);
        return { success: false, error: "Failed to process quotation file" };
    }
}
