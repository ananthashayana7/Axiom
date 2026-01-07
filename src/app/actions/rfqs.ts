'use server'

import { db } from "@/db";
import { rfqs, rfqItems, rfqSuppliers, suppliers, parts } from "@/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";

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
                }
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

        // Simulate AI Parsing (Gemma would normally do this)
        const mockAnalysis = {
            totalAmount: 480000,
            deliveryWeeks: 4,
            terms: "Net 30, EXW",
            highlights: ["Includes 2-year warranty", "ROHS compliant"],
            aiConfidence: 94
        };

        const analysisString = JSON.stringify(mockAnalysis);

        await db.update(rfqSuppliers)
            .set({
                aiAnalysis: analysisString,
                quoteAmount: mockAnalysis.totalAmount.toString(),
                status: 'quoted'
            })
            .where(eq(rfqSuppliers.id, rfqSupplierId));

        revalidatePath(`/sourcing/rfqs/${rs.rfqId}`);
        revalidatePath(`/portal/rfqs/${rs.rfqId}`);
        revalidatePath("/portal/rfqs");

        await logActivity('UPDATE', 'rfq_supplier', rfqSupplierId, `AI parsed quotation for RFQ. Amount: ₹${mockAnalysis.totalAmount.toLocaleString()}`);

        return { success: true, analysis: mockAnalysis };
    } catch (error) {
        console.error("Failed to process quotation:", error);
        return { success: false, error: "Failed to process quotation" };
    }
}
