'use server'

import { db } from "@/db";
import { rfqs, rfqItems, rfqSuppliers, suppliers, parts, documents, sourcingEvents } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { createNotification } from "./notifications";
import { auth } from "@/auth";
import { parseOffer } from "./ai-agents";
import { users as usersTable } from "@/db/schema";
import { sendEmail } from "@/lib/services/email";

const HEURISTIC_CONFIDENCE_NUMERIC = 55; // we trust extracted numeric signals moderately
const HEURISTIC_CONFIDENCE_DEFAULT = 35; // base confidence when only structural parsing succeeds

type SupplierRecommendation = typeof suppliers.$inferSelect & {
    matchScore: number;
    matchReasons: string[];
};

type QuoteAnalysis = {
    totalAmount: number;
    deliveryWeeks: number;
    terms: string;
    highlights: string[];
    aiConfidence: number;
    notes?: string;
    submissionSource?: string;
};

type RfqSupplierCommunicationStage = 'invited' | 'launched';

function getAppBaseUrl() {
    return (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function formatDeadline(deadline: Date | null | undefined) {
    if (!deadline) {
        return "the deadline published in your Axiom portal";
    }

    return deadline.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function parseStructuredQuoteAnalysis(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as Partial<QuoteAnalysis>;
    } catch {
        return null;
    }
}

async function notifySupplierForRfq(params: {
    rfqId: string;
    supplierId: string;
    stage: RfqSupplierCommunicationStage;
    deadline?: Date | null;
}) {
    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, params.rfqId)).limit(1);
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, params.supplierId)).limit(1);

    if (!rfq || !supplier) {
        return {
            portalRecipients: 0,
            emailDelivered: false,
            emailWarning: "RFQ or supplier details could not be loaded for communications.",
        };
    }

    const supplierUsers = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.supplierId, params.supplierId));

    const portalLink = `/portal/rfqs/${params.rfqId}`;
    const absolutePortalLink = `${getAppBaseUrl()}${portalLink}`;
    const deadlineLabel = formatDeadline(params.deadline ?? rfq.deadline);

    const portalTitle = params.stage === 'launched'
        ? 'RFQ Open for Quote Submission'
        : 'RFQ Invitation Created';
    const portalMessage = params.stage === 'launched'
        ? `A sourcing event is now live for "${rfq.title}". Submit your quote in the supplier portal by ${deadlineLabel}.`
        : `You have been shortlisted for "${rfq.title}". The request is now visible in your supplier portal and will accept quotes once sourcing is launched.`;

    for (const supplierUser of supplierUsers) {
        await createNotification({
            userId: supplierUser.id,
            title: portalTitle,
            message: portalMessage,
            type: 'info',
            link: portalLink,
        });
    }

    const emailSubject = params.stage === 'launched'
        ? `Axiom RFQ Open for Quote Submission: ${rfq.title}`
        : `Axiom RFQ Invitation: ${rfq.title}`;
    const emailBody = `
Hello ${supplier.name},

${params.stage === 'launched'
            ? `A sourcing event is now live in Axiom for "${rfq.title}".`
            : `You have been invited to a sourcing event in Axiom for "${rfq.title}".`}

RFQ reference: ${rfq.id.split('-')[0].toUpperCase()}
Portal link: ${absolutePortalLink}
${params.stage === 'launched' ? `Submission deadline: ${deadlineLabel}` : 'You can review the requirement in the supplier portal now. Quote submission opens when the sourcing event is launched.'}

What we need from you:
- Review the requested parts and quantities
- Confirm lead time and payment terms
- Submit your official quote through the supplier portal

If you have questions, reply to this email or contact the procurement team through Axiom Support.

Regards,
Axiom Procurement Platform
    `.trim();

    const emailResult = await sendEmail({
        to: supplier.contactEmail,
        subject: emailSubject,
        body: emailBody,
    });

    return {
        portalRecipients: supplierUsers.length,
        emailDelivered: emailResult.success,
        emailWarning: emailResult.success ? undefined : emailResult.error,
    };
}

function heuristicQuotationSummary(quoteText: string) {
    const text = quoteText || "";
    const amountMatches = [...text.matchAll(/(?:₹|rs\.?|inr|usd|\$|eur)?\s*([\d.,]+)\b/gi)]
        .map(m => parseFloat(m[1].replace(/,/g, "")))
        .filter(n => !Number.isNaN(n));

    const deliveryMatch = text.match(/(\d+)\s*(weeks?|week|wks?|days?|day)/i);
    let deliveryWeeks = 4;
    if (deliveryMatch) {
        const num = parseInt(deliveryMatch[1]);
        if (!Number.isNaN(num)) {
            deliveryWeeks = /day/i.test(deliveryMatch[2]) ? Math.max(1, Math.ceil(num / 7)) : num;
        }
    }

    const termsMatch = text.match(/net\s*(\d+)/i) || text.match(/advance|prepaid|cod/i);
    const terms = termsMatch ? `Payment terms: ${termsMatch[0]}` : "Standard terms - please confirm with supplier.";

    const totalAmount = amountMatches.length > 0 ? Math.max(...amountMatches) : 0;
    const highlights = [];
    if (amountMatches.length > 0) highlights.push(`Detected ${amountMatches.length} numeric amount(s).`);
    if (deliveryMatch) highlights.push(`Indicated delivery in ~${deliveryWeeks} week(s).`);
    highlights.push("Heuristic parsing applied (AI unavailable).");

    return {
        totalAmount,
        deliveryWeeks,
        terms,
        highlights,
        aiConfidence: amountMatches.length > 0 ? HEURISTIC_CONFIDENCE_NUMERIC : HEURISTIC_CONFIDENCE_DEFAULT
    };
}

export async function getRFQs() {
    const session = await auth();
    if (!session) return [];

    const role = session.user.role;
    const supplierId = session.user.supplierId;

    try {
        const baseRfqs = role === 'supplier'
            ? await db.select({
                id: rfqs.id,
                title: rfqs.title,
                description: rfqs.description,
                status: rfqs.status,
                deadline: rfqs.deadline,
                category: rfqs.category,
                createdById: rfqs.createdById,
                createdAt: rfqs.createdAt,
            })
                .from(rfqSuppliers)
                .innerJoin(rfqs, eq(rfqSuppliers.rfqId, rfqs.id))
                .where(eq(rfqSuppliers.supplierId, supplierId))
                .orderBy(desc(rfqs.createdAt))
            : await db.select().from(rfqs).orderBy(desc(rfqs.createdAt));

        const rfqIds = baseRfqs.map(r => r.id);

        if (rfqIds.length === 0) return [];

        // Fetch invited suppliers
        const invitedSuppliers = await db
            .select({
                id: rfqSuppliers.id,
                rfqId: rfqSuppliers.rfqId,
                supplierId: rfqSuppliers.supplierId,
                status: rfqSuppliers.status,
                quoteAmount: rfqSuppliers.quoteAmount,
                supplier: suppliers
            })
            .from(rfqSuppliers)
            .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
            .where(inArray(rfqSuppliers.rfqId, rfqIds));

        // Fetch items
        const rfqItemsData = await db
            .select({
                id: rfqItems.id,
                rfqId: rfqItems.rfqId,
                partId: rfqItems.partId,
                quantity: rfqItems.quantity,
                part: parts
            })
            .from(rfqItems)
            .leftJoin(parts, eq(rfqItems.partId, parts.id))
            .where(inArray(rfqItems.rfqId, rfqIds));

        return baseRfqs.map(rfq => ({
            ...rfq,
            suppliers: invitedSuppliers.filter(s => s.rfqId === rfq.id),
            items: rfqItemsData.filter(i => i.rfqId === rfq.id)
        }));
    } catch (error) {
        console.error("Failed to fetch RFQs:", error);
        return [];
    }
}

export async function getRFQById(id: string) {
    const session = await auth();
    if (!session) return null;

    const role = session.user.role;
    const supplierId = session.user.supplierId;

    // Validate UUID format to prevent SQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return null;

    try {
        const [rfqBase] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
        if (!rfqBase) return null;

        const invitedSuppliers = await db
            .select({
                id: rfqSuppliers.id,
                rfqId: rfqSuppliers.rfqId,
                supplierId: rfqSuppliers.supplierId,
                status: rfqSuppliers.status,
                quoteAmount: rfqSuppliers.quoteAmount,
                aiAnalysis: rfqSuppliers.aiAnalysis,
                supplier: suppliers
            })
            .from(rfqSuppliers)
            .leftJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
            .where(eq(rfqSuppliers.rfqId, id));

        const rfqItemsData = await db
            .select({
                id: rfqItems.id,
                rfqId: rfqItems.rfqId,
                partId: rfqItems.partId,
                quantity: rfqItems.quantity,
                part: parts
            })
            .from(rfqItems)
            .leftJoin(parts, eq(rfqItems.partId, parts.id))
            .where(eq(rfqItems.rfqId, id));

        const rfqDocs = await db.select().from(documents).where(eq(documents.rfqId, id));

        const rfq = {
            ...rfqBase,
            suppliers: invitedSuppliers,
            items: rfqItemsData,
            documents: rfqDocs
        };

        if (!rfq) return null;

        // If supplier, verify they are invited
        if (role === 'supplier') {
            const isInvited = rfq.suppliers.some((s) => s.supplierId === supplierId);
            if (!isInvited) return null;
        }

        return rfq;
    } catch (error) {
        console.error("Failed to fetch RFQ:", error);
        return null;
    }
}

export async function getCurrentSupplierRFQInvitation(rfqId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'supplier' || !session.user.supplierId) {
        return null;
    }

    try {
        const [invitation] = await db.select({
            id: rfqSuppliers.id,
            rfqId: rfqSuppliers.rfqId,
            supplierId: rfqSuppliers.supplierId,
            status: rfqSuppliers.status,
            quoteAmount: rfqSuppliers.quoteAmount,
            aiAnalysis: rfqSuppliers.aiAnalysis,
        }).from(rfqSuppliers)
          .where(and(
              eq(rfqSuppliers.rfqId, rfqId),
              eq(rfqSuppliers.supplierId, session.user.supplierId)
          ))
          .limit(1);

        return invitation || null;
    } catch (error) {
        console.error("Failed to fetch supplier invitation:", error);
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
        const requestedCategories = Array.from(new Set(requestedParts.map((p) => p.category)));

        // 2. Find active suppliers that match these categories
        const allSuppliers = await db.select().from(suppliers).where(eq(suppliers.status, 'active'));

        const recommendations: SupplierRecommendation[] = allSuppliers
            .filter((s) => {
                if (!s.categories) return false;
                return s.categories.some((cat: string) => requestedCategories.includes(cat));
            })
            .map((s) => {
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
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 3); // Top 3

        return recommendations;
    } catch (error) {
        console.error("AI Supplier Selection failed:", error);
        return [];
    }
}

export async function createRFQ(title: string, description: string, items: { partId: string; quantity: number }[]) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        return await db.transaction(async (tx) => {
            // 1. Create RFQ
            const [newRfq] = await tx.insert(rfqs).values({
                title,
                description,
                status: 'draft'
            }).returning();

            // 2. Add Items
            if (items.length > 0) {
                await tx.insert(rfqItems).values(
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
                await tx.insert(rfqSuppliers).values(
                    suggestedSuppliers.map((s) => ({
                        rfqId: newRfq.id,
                        supplierId: s.id,
                        status: 'invited' as const
                    }))
                );
            }

            await logActivity('CREATE', 'rfq', newRfq.id, `RFQ '${title}' created with ${suggestedSuppliers.length} AI-recommended suppliers.`);

            revalidatePath("/sourcing/rfqs");
            return { success: true, rfqId: newRfq.id };
        });
    } catch (error) {
        console.error("Failed to create RFQ:", error);
        return { success: false, error: "Failed to create RFQ" };
    }
}

export async function updateRFQStatus(id: string, status: 'draft' | 'open' | 'closed' | 'cancelled') {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

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

export async function inviteSupplierToRFQ(rfqId: string, supplierId: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // Check if already invited
        const existing = await db.select().from(rfqSuppliers).where(
            and(
                eq(rfqSuppliers.rfqId, rfqId),
                eq(rfqSuppliers.supplierId, supplierId)
            )
        ).limit(1);

        if (existing.length > 0) return { success: false, error: "Supplier already invited" };

        const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1);
        if (!rfq) {
            return { success: false, error: "RFQ not found" };
        }

        await db.insert(rfqSuppliers).values({
            rfqId,
            supplierId,
            status: 'invited'
        });

        await logActivity('UPDATE', 'rfq', rfqId, `Manually invited supplier ${supplierId}`);
        revalidatePath(`/sourcing/rfqs/${rfqId}`);

        const communication = await notifySupplierForRfq({
            rfqId,
            supplierId,
            stage: rfq.status === 'open' ? 'launched' : 'invited',
            deadline: rfq.deadline,
        });

        return { success: true, ...communication };
    } catch (error) {
        console.error("Failed to invite supplier:", error);
        return { success: false, error: "Failed to invite supplier" };
    }
}

async function notifyAdminsOfQuoteSubmission(
    rfqId: string,
    supplierId: string,
    amount: number,
    title: string,
    messagePrefix: string,
) {
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, 'admin'));
    const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, rfqId));
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));

    if (!rfq || !supplier) {
        return;
    }

    for (const admin of admins) {
        await createNotification({
            userId: admin.id,
            title,
            message: `${supplier.name} ${messagePrefix} "${rfq.title}". Amount: INR ${amount.toLocaleString()}`,
            type: 'info',
            link: `/sourcing/rfqs/${rfqId}`
        });
    }
}

export async function launchRFQSourcingEvent(rfqId: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const result = await db.transaction(async (tx) => {
            const [rfq] = await tx.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1);
            if (!rfq) {
                return { success: false, error: "RFQ not found" };
            }

            const [existingEvent] = await tx.select()
                .from(sourcingEvents)
                .where(eq(sourcingEvents.rfqId, rfqId))
                .orderBy(desc(sourcingEvents.createdAt))
                .limit(1);

            const bidDeadline = rfq.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            if (existingEvent) {
                await tx.update(sourcingEvents)
                    .set({
                        status: 'launched',
                        launchedAt: new Date(),
                        bidDeadline,
                        updatedAt: new Date(),
                    })
                    .where(eq(sourcingEvents.id, existingEvent.id));
            } else {
                await tx.insert(sourcingEvents).values({
                    rfqId,
                    status: 'launched',
                    launchedAt: new Date(),
                    bidDeadline,
                    ownerId: session.user.id,
                });
            }

            await tx.update(rfqs)
                .set({ status: 'open' })
                .where(eq(rfqs.id, rfqId));

            const invitedSuppliers = await tx.select({
                supplierId: rfqSuppliers.supplierId,
            }).from(rfqSuppliers).where(eq(rfqSuppliers.rfqId, rfqId));

            await logActivity('UPDATE', 'rfq', rfqId, `RFQ launched for supplier bidding. Deadline: ${bidDeadline.toISOString().split('T')[0]}.`);

            revalidatePath("/sourcing/rfqs");
            revalidatePath(`/sourcing/rfqs/${rfqId}`);
            revalidatePath("/portal/rfqs");
            revalidatePath(`/portal/rfqs/${rfqId}`);

            return {
                success: true,
                bidDeadline,
                invitedSupplierIds: invitedSuppliers.map((supplierRow) => supplierRow.supplierId),
            };
        });

        if (!result.success) {
            return result;
        }

        const invitedSupplierIds = 'invitedSupplierIds' in result ? (result.invitedSupplierIds ?? []) : [];
        const bidDeadline = 'bidDeadline' in result ? (result.bidDeadline ?? null) : null;

        const communications = await Promise.all(
            invitedSupplierIds.map((supplierId) => notifySupplierForRfq({
                rfqId,
                supplierId,
                stage: 'launched',
                deadline: bidDeadline,
            }))
        );

        const emailWarnings = communications
            .map((communication) => communication.emailWarning)
            .filter((warning): warning is string => Boolean(warning));

        return {
            success: true,
            emailDeliveredCount: communications.filter((communication) => communication.emailDelivered).length,
            portalRecipients: communications.reduce((total, communication) => total + communication.portalRecipients, 0),
            warning: emailWarnings.length > 0 ? emailWarnings.join(" | ") : undefined,
        };
    } catch (error) {
        console.error("Failed to launch sourcing event:", error);
        return { success: false, error: "Failed to launch sourcing event" };
    }
}

export async function submitSupplierQuote(data: {
    rfqSupplierId: string;
    totalAmount: number;
    leadTimeWeeks: number;
    paymentTerms?: string;
    notes?: string;
}) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const [rfqSupplier] = await db.select()
            .from(rfqSuppliers)
            .where(eq(rfqSuppliers.id, data.rfqSupplierId))
            .limit(1);

        if (!rfqSupplier) {
            return { success: false, error: "Invitation not found" };
        }

        if (session.user.role === 'supplier' && session.user.supplierId !== rfqSupplier.supplierId) {
            return { success: false, error: "Unauthorized" };
        }

        if (!Number.isFinite(data.totalAmount) || data.totalAmount <= 0) {
            return { success: false, error: "Quote amount must be greater than zero" };
        }

        if (!Number.isFinite(data.leadTimeWeeks) || data.leadTimeWeeks <= 0) {
            return { success: false, error: "Lead time must be at least one week" };
        }

        const trimmedNotes = data.notes?.trim();
        const paymentTerms = data.paymentTerms?.trim() || "Standard terms - please confirm with supplier.";
        const analysis: QuoteAnalysis = {
            totalAmount: Number(data.totalAmount.toFixed(2)),
            deliveryWeeks: Math.round(data.leadTimeWeeks),
            terms: paymentTerms,
            highlights: [
                `Supplier committed delivery in ${Math.round(data.leadTimeWeeks)} week(s).`,
                trimmedNotes ? `Supplier note: ${trimmedNotes}` : "Structured quote submitted through supplier portal.",
            ],
            aiConfidence: 100,
            notes: trimmedNotes,
            submissionSource: 'supplier_portal',
        };

        await db.transaction(async (tx) => {
            await tx.update(rfqSuppliers)
                .set({
                    aiAnalysis: JSON.stringify(analysis),
                    quoteAmount: analysis.totalAmount.toString(),
                    status: 'quoted',
                })
                .where(eq(rfqSuppliers.id, data.rfqSupplierId));

            await tx.update(sourcingEvents)
                .set({
                    status: 'bid_submitted',
                    updatedAt: new Date(),
                })
                .where(eq(sourcingEvents.rfqId, rfqSupplier.rfqId));
        });

        await logActivity('UPDATE', 'rfq_supplier', data.rfqSupplierId, `Supplier quote submitted through portal. Amount: INR ${analysis.totalAmount.toLocaleString()}`);
        await notifyAdminsOfQuoteSubmission(rfqSupplier.rfqId, rfqSupplier.supplierId, analysis.totalAmount, "New Quote Received", "has submitted a quote for");

        revalidatePath("/portal/rfqs");
        revalidatePath(`/portal/rfqs/${rfqSupplier.rfqId}`);
        revalidatePath(`/sourcing/rfqs/${rfqSupplier.rfqId}`);

        return { success: true, analysis };
    } catch (error) {
        console.error("Failed to submit supplier quote:", error);
        return { success: false, error: "Failed to submit supplier quote" };
    }
}

export async function processQuotation(rfqSupplierId: string, quoteText: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        // 1. Verify access (if supplier, must be their own record)
        const [rs] = await db.select().from(rfqSuppliers).where(eq(rfqSuppliers.id, rfqSupplierId));
        if (!rs) return { success: false, error: "Record not found" };

        if (session.user.role === 'supplier' && session.user.supplierId !== rs.supplierId) {
            return { success: false, error: "Unauthorized" };
        }

        // Use AI to parse the quotation
        let analysis: QuoteAnalysis;
        try {
            // Use the centralized AI provider
            const { getAiModel } = await import("@/lib/ai-provider");
            const model = await getAiModel("gemini-2.5-flash");
            if (!model) throw new Error("AI model not available");

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
            analysis = heuristicQuotationSummary(quoteText);
        }

        const analysisString = JSON.stringify(analysis);
        const parsedAmount = Number(analysis.totalAmount || 0);

        return await db.transaction(async (tx) => {
            await tx.update(rfqSuppliers)
                .set({
                    aiAnalysis: analysisString,
                    quoteAmount: parsedAmount.toString(),
                    status: 'quoted'
                })
                .where(eq(rfqSuppliers.id, rfqSupplierId));

            await tx.update(sourcingEvents)
                .set({
                    status: 'bid_submitted',
                    updatedAt: new Date(),
                })
                .where(eq(sourcingEvents.rfqId, rs.rfqId));

            revalidatePath(`/sourcing/rfqs/${rs.rfqId}`);
            revalidatePath(`/portal/rfqs/${rs.rfqId}`);
            revalidatePath("/portal/rfqs");

            await logActivity('UPDATE', 'rfq_supplier', rfqSupplierId, `AI parsed quotation for RFQ. Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`);

            // Notify Admins
            const admins = await tx.select().from(usersTable).where(eq(usersTable.role, 'admin'));
            const [rfq] = await tx.select().from(rfqs).where(eq(rfqs.id, rs.rfqId));
            const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, rs.supplierId));

            if (admins.length > 0 && rfq && supplier) {
                for (const admin of admins) {
                    await createNotification({
                        userId: admin.id,
                        title: "New Quote Received",
                        message: `${supplier.name} has submitted a quote for "${rfq.title}". Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`,
                        type: 'info',
                        link: `/sourcing/rfqs/${rs.rfqId}`
                    });
                }
            }
            return { success: true, analysis: analysis };
        });
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
        const parsedAmount = Number(analysis.totalAmount || 0);

        await db.update(rfqSuppliers)
            .set({
                aiAnalysis: analysisString,
                quoteAmount: parsedAmount.toString(),
                status: 'quoted'
            })
            .where(eq(rfqSuppliers.id, rfqSupplierId));

        await db.update(sourcingEvents)
            .set({
                status: 'bid_submitted',
                updatedAt: new Date(),
            })
            .where(eq(sourcingEvents.rfqId, rs.rfqId));

        revalidatePath(`/sourcing/rfqs/${rs.rfqId}`);
        revalidatePath("/portal/rfqs");

        await logActivity('UPDATE', 'rfq_supplier', rfqSupplierId, `AI parsed file quotation '${fileName}'. Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`);

        // Notify Admins
        const admins = await db.select().from(usersTable).where(eq(usersTable.role, 'admin'));
        const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, rs.rfqId));
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, rs.supplierId));

        if (admins.length > 0 && rfq && supplier) {
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: "New Quote File Received",
                    message: `${supplier.name} uploaded a quote for "${rfq.title}". Amount: ₹${(analysis.totalAmount || 0).toLocaleString()}`,
                    type: 'info',
                    link: `/sourcing/rfqs/${rs.rfqId}`
                });
            }
        }

        return { success: true, analysis };
    } catch (error) {
        console.error("Failed to process quotation file:", error);
        return { success: false, error: "Failed to process quotation file" };
    }
}
