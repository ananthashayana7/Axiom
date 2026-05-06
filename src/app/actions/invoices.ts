'use server'

import { db } from "@/db";
import { invoices, auditLogs, suppliers, fraudAlerts, workflowTasks, invoiceOverrideRequests, users } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and, ilike, gte, lte, inArray, or, sql } from "drizzle-orm";
import { createNotification } from "./notifications";
import { canEscalateInvoiceReview, canMarkInvoicePaid, canRunInvoiceRules, isRegionalOperator } from "@/lib/rbac";
import {
    coerceInvoiceNumber,
    coerceMoney,
    normalizeCurrencyCode,
    normalizeDateToIso,
    normalizeInvoiceLineItems,
    optionalDecimalString,
    type NormalizedInvoiceExtraction,
} from "@/lib/invoices/normalization";
import { assessInvoiceReviewSignals } from "@/lib/invoices/review";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_INVOICE_REVIEW_STATUSES = ['open', 'in_progress', 'blocked', 'escalated'] as const;
const _ACTIVE_OVERRIDE_TYPES = ['place_hold', 'clear_hold', 'payment_reversal'] as const;
const OVERRIDE_REVIEWER_PROFILES = ['super_admin', 'finance_auditor'] as const;
const HIGH_VALUE_RELEASE_THRESHOLDS: Record<string, number> = {
    INR: 500_000,
    USD: 10_000,
    EUR: 10_000,
    GBP: 8_000,
    SGD: 12_000,
    AED: 35_000,
};

function isUuid(value: string) {
    return UUID_PATTERN.test(value);
}

function dateForInsert(value: string | undefined) {
    const iso = normalizeDateToIso(value);
    return iso ? new Date(`${iso}T00:00:00.000Z`) : undefined;
}

function invoiceInsertErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (/order_id.*not null|null value.*order_id/i.test(message) || /column .*invoice_date.*does not exist/i.test(message)) {
        return "Invoice database schema is not up to date. Run the invoice enhancement migration and try again.";
    }

    if (/foreign key.*supplier|suppliers/i.test(message)) {
        return "Selected supplier could not be found.";
    }

    return "Failed to create invoice. Please try again.";
}

function getHumanReleaseThreshold(currency: string) {
    return HIGH_VALUE_RELEASE_THRESHOLDS[currency] ?? 10_000;
}

function formatThresholdAmount(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat("en", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString("en-US")}`;
    }
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function getInvoiceConfidenceLabel(score: number) {
    if (score >= 90) return "High confidence";
    if (score >= 75) return "Guarded release";
    if (score >= 55) return "Needs review";
    return "Manual review required";
}

function getOverrideActionLabel(type: (typeof _ACTIVE_OVERRIDE_TYPES)[number]) {
    switch (type) {
        case 'place_hold':
            return 'Hold requested';
        case 'clear_hold':
            return 'Hold release requested';
        case 'payment_reversal':
            return 'Payment reversal requested';
        default:
            return 'Override requested';
    }
}

function getOverrideTitle(type: (typeof _ACTIVE_OVERRIDE_TYPES)[number]) {
    switch (type) {
        case 'place_hold':
            return 'Place release hold';
        case 'clear_hold':
            return 'Clear release hold';
        case 'payment_reversal':
            return 'Payment reversal';
        default:
            return 'Invoice override';
    }
}

function buildInvoiceConfidenceScore(input: {
    status: string | null;
    hasOrder: boolean;
    hasDocument: boolean;
    openFraudAlerts: number;
    openReviewTasks: number;
    amount: number;
    currency: string;
}) {
    let score = input.hasOrder ? 82 : 42;

    if (input.status === "matched") {
        score += 10;
    } else if (input.status === "paid") {
        score += 14;
    } else if (input.status === "disputed") {
        score = Math.min(score, 24);
    }

    if (!input.hasDocument) {
        score -= 8;
    }

    if (input.openReviewTasks > 0) {
        score -= 24;
    }

    if (input.openFraudAlerts > 0) {
        score -= 34;
    }

    const threshold = getHumanReleaseThreshold(input.currency);
    if (input.amount >= threshold) {
        score -= 10;
    }

    return clamp(Math.round(score), 8, 99);
}

export async function getInvoices(filters?: {
    invoiceNumber?: string;
    status?: string;
    country?: string;
    continent?: string;
    region?: string;
    dateFrom?: string;
    dateTo?: string;
    currency?: string;
}) {
    const session = await auth();
    if (!session) return [];

    try {
        const userRole = session.user.role;
        const userSupplierId = session.user.supplierId;
        const scopedCountry = session.user.countryScope?.trim();
        const scopedRegion = session.user.regionScope?.trim();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conditions: any[] = [];

        if (userRole === 'supplier') {
            conditions.push(eq(invoices.supplierId, userSupplierId));
        }
        if (isRegionalOperator(session.user)) {
            if (!scopedCountry && !scopedRegion) {
                return [];
            }

            if (scopedCountry) {
                conditions.push(or(
                    eq(suppliers.countryCode, scopedCountry.toUpperCase()),
                    ilike(invoices.country, `%${scopedCountry}%`),
                ));
            }

            if (scopedRegion) {
                conditions.push(ilike(invoices.region, `%${scopedRegion}%`));
            }
        }
        if (filters?.status && filters.status !== 'all') {
            const allowedStatuses = ['pending', 'matched', 'disputed', 'paid'];
            if (allowedStatuses.includes(filters.status)) {
                conditions.push(eq(invoices.status, filters.status as 'pending' | 'matched' | 'disputed' | 'paid'));
            }
        }
        if (filters?.invoiceNumber) {
            conditions.push(ilike(invoices.invoiceNumber, `%${filters.invoiceNumber}%`));
        }
        if (filters?.country) {
            conditions.push(ilike(invoices.country, `%${filters.country}%`));
        }
        if (filters?.continent) {
            conditions.push(ilike(invoices.continent, `%${filters.continent}%`));
        }
        if (filters?.region) {
            conditions.push(ilike(invoices.region, `%${filters.region}%`));
        }
        if (filters?.currency && filters.currency !== 'all') {
            conditions.push(eq(invoices.currency, filters.currency));
        }
        if (filters?.dateFrom) {
            conditions.push(gte(invoices.createdAt, new Date(filters.dateFrom)));
        }
        if (filters?.dateTo) {
            conditions.push(lte(invoices.createdAt, new Date(filters.dateTo)));
        }

        const rows = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                amount: invoices.amount,
                currency: invoices.currency,
                status: invoices.status,
                region: invoices.region,
                country: invoices.country,
                continent: invoices.continent,
                orderId: invoices.orderId,
                supplierId: invoices.supplierId,
                matchedAt: invoices.matchedAt,
                createdAt: invoices.createdAt,
                invoiceDate: invoices.invoiceDate,
                dueDate: invoices.dueDate,
                taxAmount: invoices.taxAmount,
                subtotal: invoices.subtotal,
                lineItems: invoices.lineItems,
                paymentTerms: invoices.paymentTerms,
                purchaseOrderRef: invoices.purchaseOrderRef,
                documentUrl: invoices.documentUrl,
                releaseHold: invoices.releaseHold,
                releaseHoldReason: invoices.releaseHoldReason,
                releaseHoldAppliedAt: invoices.releaseHoldAppliedAt,
                reversedAt: invoices.reversedAt,
                reversalReason: invoices.reversalReason,
                reversalReference: invoices.reversalReference,
                supplierName: suppliers.name,
                supplierCountry: suppliers.countryCode,
            })
            .from(invoices)
            .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(invoices.createdAt));

        const invoiceIds = rows.map((row) => row.id);

        const [openFraudRows, openTaskRows, pendingOverrideRows] = invoiceIds.length > 0
            ? await Promise.all([
                db.select({
                    entityId: fraudAlerts.entityId,
                })
                    .from(fraudAlerts)
                    .where(and(
                        eq(fraudAlerts.entityType, 'invoice'),
                        eq(fraudAlerts.status, 'open'),
                        inArray(fraudAlerts.entityId, invoiceIds),
                    )),
                db.select({
                    entityId: workflowTasks.entityId,
                })
                    .from(workflowTasks)
                    .where(and(
                        eq(workflowTasks.entityType, 'invoice'),
                        inArray(workflowTasks.status, [...ACTIVE_INVOICE_REVIEW_STATUSES]),
                        inArray(workflowTasks.entityId, invoiceIds),
                    )),
                db.select({
                    invoiceId: invoiceOverrideRequests.invoiceId,
                    requestType: invoiceOverrideRequests.requestType,
                    requestedAt: invoiceOverrideRequests.requestedAt,
                    requesterName: users.name,
                })
                    .from(invoiceOverrideRequests)
                    .leftJoin(users, eq(invoiceOverrideRequests.requestedById, users.id))
                    .where(and(
                        eq(invoiceOverrideRequests.status, 'pending'),
                        inArray(invoiceOverrideRequests.invoiceId, invoiceIds),
                    ))
            ])
            : [[], [], []];

        const openFraudByInvoice = new Map<string, number>();
        for (const alert of openFraudRows) {
            openFraudByInvoice.set(alert.entityId, (openFraudByInvoice.get(alert.entityId) || 0) + 1);
        }

        const openTasksByInvoice = new Map<string, number>();
        for (const task of openTaskRows) {
            openTasksByInvoice.set(task.entityId, (openTasksByInvoice.get(task.entityId) || 0) + 1);
        }

        const pendingOverrideByInvoice = new Map<string, {
            requestType: 'place_hold' | 'clear_hold' | 'payment_reversal';
            requestedAt: Date | null;
            requesterName: string | null;
        }>();

        for (const request of pendingOverrideRows) {
            if (!pendingOverrideByInvoice.has(request.invoiceId)) {
                pendingOverrideByInvoice.set(request.invoiceId, {
                    requestType: request.requestType,
                    requestedAt: request.requestedAt,
                    requesterName: request.requesterName,
                });
            }
        }

        return rows.map((row) => {
            const currency = row.currency || 'INR';
            const amount = Number(row.amount || 0);
            const openFraudAlerts = openFraudByInvoice.get(row.id) || 0;
            const openReviewTasks = openTasksByInvoice.get(row.id) || 0;
            const pendingOverride = pendingOverrideByInvoice.get(row.id);
            const humanReleaseThreshold = getHumanReleaseThreshold(currency);
            const reviewConfidenceScore = buildInvoiceConfidenceScore({
                status: row.status,
                hasOrder: Boolean(row.orderId),
                hasDocument: Boolean(row.documentUrl),
                openFraudAlerts,
                openReviewTasks,
                amount,
                currency,
            });

            const reviewSignals = [
                !row.orderId ? "Missing purchase order link" : null,
                openFraudAlerts > 0 ? `${openFraudAlerts} open fraud alert${openFraudAlerts === 1 ? "" : "s"}` : null,
                openReviewTasks > 0 ? `${openReviewTasks} open manual review task${openReviewTasks === 1 ? "" : "s"}` : null,
                amount >= humanReleaseThreshold
                    ? `Amount exceeds the ${formatThresholdAmount(humanReleaseThreshold, currency)} manual release threshold`
                    : null,
                row.status === 'disputed' ? "Invoice is already routed into dispute" : null,
                row.releaseHold ? "Release hold is active on this invoice" : null,
                row.reversedAt ? "Payment reversal has been completed for this invoice" : null,
                pendingOverride ? getOverrideActionLabel(pendingOverride.requestType) : null,
            ].filter((signal): signal is string => Boolean(signal));

            return {
                ...row,
                openFraudAlerts,
                openReviewTasks,
                pendingOverrideRequestType: pendingOverride?.requestType || null,
                pendingOverrideRequestedAt: pendingOverride?.requestedAt || null,
                pendingOverrideRequesterName: pendingOverride?.requesterName || null,
                requiresHumanReview: reviewSignals.length > 0 || reviewConfidenceScore < 75 || Boolean(row.releaseHold),
                reviewConfidenceScore,
                confidenceLabel: getInvoiceConfidenceLabel(reviewConfidenceScore),
                humanReleaseThreshold,
                reviewSignals,
            };
        });
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return [];
    }
}

export async function createInvoice(data: {
    orderId?: string,
    supplierId: string,
    invoiceNumber: string,
    amount: number,
    currency?: string,
    invoiceDate?: string,
    dueDate?: string,
    taxAmount?: number,
    subtotal?: number,
    lineItems?: { description: string; quantity: number; unitPrice: number; totalPrice: number }[],
    paymentTerms?: string,
    purchaseOrderRef?: string,
    documentUrl?: string,
    region?: string,
    country?: string,
    continent?: string,
}) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const supplierId = String(data.supplierId || "").trim();
        if (!supplierId || !isUuid(supplierId)) {
            return { success: false, error: "Please select a valid supplier" };
        }

        if (session.user.role === "supplier" && session.user.supplierId !== supplierId) {
            return { success: false, error: "Unauthorized" };
        }

        const invoiceNumber = coerceInvoiceNumber(data.invoiceNumber);
        if (!invoiceNumber) {
            return { success: false, error: "Invoice number is required" };
        }

        const amount = coerceMoney(data.amount);
        if (amount === null || amount <= 0) {
            return { success: false, error: "Invoice amount must be a valid positive amount" };
        }

        const orderId = data.orderId?.trim();
        if (orderId && !isUuid(orderId)) {
            return { success: false, error: "Order reference is invalid" };
        }

        const [supplier] = await db
            .select({ id: suppliers.id })
            .from(suppliers)
            .where(eq(suppliers.id, supplierId))
            .limit(1);

        if (!supplier) {
            return { success: false, error: "Selected supplier could not be found" };
        }

        const invoiceDate = dateForInsert(data.invoiceDate);
        if (data.invoiceDate && !invoiceDate) {
            return { success: false, error: "Invoice date is invalid" };
        }

        const dueDate = dateForInsert(data.dueDate);
        if (data.dueDate && !dueDate) {
            return { success: false, error: "Due date is invalid" };
        }

        const taxAmount = optionalDecimalString(data.taxAmount, "Tax amount");
        if (taxAmount.error) return { success: false, error: taxAmount.error };

        const subtotal = optionalDecimalString(data.subtotal, "Subtotal");
        if (subtotal.error) return { success: false, error: subtotal.error };

        const lineItems = normalizeInvoiceLineItems(data.lineItems);

        const normalizedCurrency = normalizeCurrencyCode(data.currency, "INR") || "INR";
        const humanReleaseThreshold = getHumanReleaseThreshold(normalizedCurrency);
        const requiresHumanRelease = amount >= humanReleaseThreshold;

        const duplicateInvoice = await db.select({
            id: invoices.id,
        })
            .from(invoices)
            .where(and(
                eq(invoices.supplierId, supplierId),
                eq(invoices.invoiceNumber, invoiceNumber),
            ))
            .limit(1);

        const reviewSignals = assessInvoiceReviewSignals({
            invoiceNumber,
            amount,
            currency: normalizedCurrency,
            supplierName: "selected-supplier",
            invoiceDate: invoiceDate ? invoiceDate.toISOString().slice(0, 10) : null,
            dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
            taxAmount: taxAmount.value ? Number(taxAmount.value) : null,
            subtotal: subtotal.value ? Number(subtotal.value) : null,
            lineItems,
            paymentTerms: data.paymentTerms || null,
            purchaseOrderRef: data.purchaseOrderRef || null,
        } satisfies Partial<NormalizedInvoiceExtraction>);

        if (duplicateInvoice.length > 0) {
            reviewSignals.push({
                severity: "critical",
                message: `Invoice number ${invoiceNumber} already exists for this supplier and is routed into dispute review.`,
            });
        }

        const releaseReviewMessage = requiresHumanRelease
            ? `High-value invoice ${invoiceNumber} crosses the human release threshold of ${formatThresholdAmount(humanReleaseThreshold, normalizedCurrency)} and must be reviewed before payment.`
            : null;

        const initialStatus = reviewSignals.some((signal) => signal.severity === "critical") ? 'disputed' : 'pending';

        const [invoice] = await db.transaction(async (tx) => {
            const [createdInvoice] = await tx.insert(invoices).values({
                ...(orderId ? { orderId } : {}),
                supplierId,
                invoiceNumber,
                amount: amount.toFixed(2),
                currency: normalizedCurrency,
                invoiceDate,
                dueDate,
                taxAmount: taxAmount.value,
                subtotal: subtotal.value,
                lineItems: lineItems.length > 0 ? JSON.stringify(lineItems) : undefined,
                paymentTerms: data.paymentTerms,
                purchaseOrderRef: data.purchaseOrderRef,
                documentUrl: data.documentUrl,
                region: data.region,
                country: data.country,
                continent: data.continent,
                status: initialStatus,
            }).returning();

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'CREATE',
                entityType: 'invoice',
                entityId: createdInvoice.id,
                details: `Invoice ${invoiceNumber} created${orderId ? ` for order ${orderId}` : ''}${initialStatus === 'disputed' ? ' and routed to dispute review.' : ''}`,
            });

            if (reviewSignals.length > 0 || requiresHumanRelease) {
                const taskDetails = [
                    ...reviewSignals.map((signal) => signal.message),
                    releaseReviewMessage,
                ].filter((detail): detail is string => Boolean(detail));

                await tx.insert(workflowTasks).values({
                    title: requiresHumanRelease
                        ? `Release review for invoice ${invoiceNumber}`
                        : `Review invoice ${invoiceNumber}`,
                    description: taskDetails.join(' '),
                    entityType: 'invoice',
                    entityId: createdInvoice.id,
                    priority: initialStatus === 'disputed' || requiresHumanRelease ? 'high' : 'medium',
                    createdById: session.user.id,
                    nextAction: initialStatus === 'disputed'
                        ? 'Resolve the invoice discrepancy, rerun deterministic matching, then mark the invoice as paid.'
                        : requiresHumanRelease
                            ? 'Confirm supplier, tax, and banking evidence, then close the review task before the invoice can be marked as paid.'
                            : 'Review extracted invoice fields and confirm totals before matching.',
                });
            }

            if (initialStatus === 'disputed') {
                await tx.insert(fraudAlerts).values({
                    entityType: 'invoice',
                    entityId: createdInvoice.id,
                    alertType: duplicateInvoice.length > 0 ? 'duplicate_invoice' : 'manual_review_required',
                    severity: duplicateInvoice.length > 0 ? 'high' : 'medium',
                    description: reviewSignals.map((signal) => signal.message).join(' '),
                    indicators: JSON.stringify(reviewSignals),
                    suggestedAction: 'Hold payment, confirm supplier evidence, and rerun invoice matching after corrections.',
                    falsePositiveProbability: duplicateInvoice.length > 0 ? '10.00' : '35.00',
                });
            }

            return [createdInvoice];
        });

        revalidatePath('/sourcing/invoices');
        revalidatePath('/sourcing/exceptions');
        revalidatePath('/portal/invoices');
        if (orderId) revalidatePath(`/sourcing/orders/${orderId}`);
        return {
            success: true,
            data: invoice,
            warning: [
                ...reviewSignals.map((signal) => signal.message),
                releaseReviewMessage,
            ].filter((message): message is string => Boolean(message)).join(' ') || undefined,
        };
    } catch (error) {
        console.error("Failed to create invoice:", error);
        return { success: false, error: invoiceInsertErrorMessage(error) };
    }
}

export async function updateInvoiceStatus(id: string, status: 'pending' | 'matched' | 'disputed' | 'paid') {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };

    const canContinue = status === 'paid'
        ? canMarkInvoicePaid(session.user)
        : canRunInvoiceRules(session.user);

    if (!canContinue) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [invoice] = await db.select({
            id: invoices.id,
            supplierId: invoices.supplierId,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
            releaseHold: invoices.releaseHold,
            reversedAt: invoices.reversedAt,
        }).from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        const currentStatus = (invoice.status || 'pending') as 'pending' | 'matched' | 'disputed' | 'paid';

        const logBlockedRelease = async (details: string) => {
            await db.insert(auditLogs).values({
                userId: session.user.id,
                action: 'BLOCK',
                entityType: 'invoice',
                entityId: id,
                details,
            });
        };

        if (status === 'matched') {
            return { success: false, error: "Use deterministic matching to move an invoice into matched state." };
        }

        if (currentStatus === 'paid') {
            await logBlockedRelease(`Status update blocked for invoice ${invoice.invoiceNumber} because paid records are archived and cannot be changed in place.`);
            return { success: false, error: "Paid invoices are archived. Use a reversal workflow instead of editing the original record." };
        }

        const allowedTransitions: Record<'pending' | 'matched' | 'disputed' | 'paid', Array<'pending' | 'matched' | 'disputed' | 'paid'>> = {
            pending: ['disputed'],
            matched: ['paid'],
            disputed: [],
            paid: [],
        };

        if (!allowedTransitions[currentStatus].includes(status)) {
            await logBlockedRelease(`Status update blocked for invoice ${invoice.invoiceNumber} because ${currentStatus} invoices cannot transition to ${status} through the manual status route.`);
            return {
                success: false,
                error: currentStatus === 'matched'
                    ? "Matched invoices are compliance-locked. Escalate the invoice to place it on manual hold instead of moving it back to review."
                    : "This invoice state is locked for manual status changes.",
            };
        }

        if (status === 'paid') {
            if (currentStatus !== 'matched') {
                await logBlockedRelease(`Paid-status update blocked for invoice ${invoice.invoiceNumber} because the invoice is not in matched status.`);
                return { success: false, error: "Only matched invoices can be marked as paid." };
            }

            if (invoice.releaseHold) {
                await logBlockedRelease(`Paid-status update blocked for invoice ${invoice.invoiceNumber} because an approved release hold is still active.`);
                return { success: false, error: "Mark-paid action blocked until the approved release hold is cleared through dual approval." };
            }

            if (invoice.reversedAt) {
                await logBlockedRelease(`Paid-status update blocked for invoice ${invoice.invoiceNumber} because the invoice already has a completed payment reversal.`);
                return { success: false, error: "This invoice already carries a completed reversal record." };
            }

            const [openFraudAlert] = await db.select({ id: fraudAlerts.id })
                .from(fraudAlerts)
                .where(and(
                    eq(fraudAlerts.entityType, 'invoice'),
                    eq(fraudAlerts.entityId, id),
                    eq(fraudAlerts.status, 'open'),
                ))
                .limit(1);

            if (openFraudAlert) {
                await logBlockedRelease(`Paid-status update blocked for invoice ${invoice.invoiceNumber} because open fraud alerts still require review.`);
                return { success: false, error: "Mark-paid action blocked until open fraud alerts are resolved." };
            }

            const [openWorkflowTask] = await db.select({ id: workflowTasks.id })
                .from(workflowTasks)
                .where(and(
                    eq(workflowTasks.entityType, 'invoice'),
                    eq(workflowTasks.entityId, id),
                    inArray(workflowTasks.status, [...ACTIVE_INVOICE_REVIEW_STATUSES]),
                ))
                .limit(1);

            if (openWorkflowTask) {
                await logBlockedRelease(`Paid-status update blocked for invoice ${invoice.invoiceNumber} because a review task is still open.`);
                return { success: false, error: "Mark-paid action blocked until invoice review tasks are closed." };
            }
        }

        const updateData: { status: 'pending' | 'matched' | 'disputed' | 'paid'; matchedAt?: Date | null } = { status };
        if (status === 'disputed' || status === 'pending') {
            updateData.matchedAt = null;
        }

        await db.update(invoices)
            .set(updateData)
            .where(eq(invoices.id, id));

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'UPDATE',
            entityType: 'invoice',
            entityId: id,
            details: `Invoice status updated to ${status}`
        });

        // Notify Supplier
        await createNotification({
            userId: invoice.supplierId, // This might need a supplier-user lookup
            title: `Invoice ${status.toUpperCase()}`,
            message: `Your invoice ${invoice.invoiceNumber} has been updated to ${status}.`,
            type: 'info',
            link: `/portal/invoices`
        });

        revalidatePath('/sourcing/invoices');
        revalidatePath('/sourcing/exceptions');
        return { success: true };
    } catch (error) {
        console.error("Failed to update invoice status:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function escalateInvoiceToHumanReview(invoiceId: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin' || !canEscalateInvoiceReview(session.user)) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [invoice] = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            supplierId: invoices.supplierId,
            supplierName: suppliers.name,
        })
            .from(invoices)
            .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
            .where(eq(invoices.id, invoiceId))
            .limit(1);

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        const [existingTask] = await db.select({
            id: workflowTasks.id,
            status: workflowTasks.status,
        })
            .from(workflowTasks)
            .where(and(
                eq(workflowTasks.entityType, 'invoice'),
                eq(workflowTasks.entityId, invoiceId),
                inArray(workflowTasks.status, [...ACTIVE_INVOICE_REVIEW_STATUSES]),
            ))
            .orderBy(desc(workflowTasks.createdAt))
            .limit(1);

        const nextAction = "Review the original document, supplier identity, PO linkage, tax evidence, and banking controls before any release.";

        if (existingTask) {
            await db.update(workflowTasks)
                .set({
                    status: existingTask.status === 'blocked' ? 'open' : existingTask.status,
                    priority: 'high',
                    nextAction,
                    updatedAt: new Date(),
                })
                .where(eq(workflowTasks.id, existingTask.id));
        } else {
            await db.insert(workflowTasks).values({
                title: `Manual review for invoice ${invoice.invoiceNumber}`,
                description: `Invoice ${invoice.invoiceNumber} for ${invoice.supplierName || 'the selected supplier'} was escalated for manual validation before payment status can change.`,
                entityType: 'invoice',
                entityId: invoiceId,
                priority: 'high',
                createdById: session.user.id,
                nextAction,
            });
        }

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'ESCALATE',
            entityType: 'invoice',
            entityId: invoiceId,
            details: `Invoice ${invoice.invoiceNumber} escalated to manual review from Financial Matching.`,
        });

        await createNotification({
            userId: invoice.supplierId,
            title: 'Invoice under manual review',
            message: `Invoice ${invoice.invoiceNumber} is being reviewed before it can be marked as paid.`,
            type: 'warning',
            link: '/portal/invoices',
        });

        revalidatePath('/admin/financial-matching');
        revalidatePath('/sourcing/invoices');
        revalidatePath('/sourcing/exceptions');
        revalidatePath('/admin/tasks');

        return {
            success: true,
            reused: Boolean(existingTask),
        };
    } catch (error) {
        console.error("Failed to escalate invoice to manual review:", error);
        return { success: false, error: "Failed to route invoice into manual review." };
    }
}

export async function rerunInvoiceMatch(invoiceId: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin' || !canRunInvoiceRules(session.user)) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [invoice] = await db.select({
            id: invoices.id,
            orderId: invoices.orderId,
            invoiceNumber: invoices.invoiceNumber,
        }).from(invoices)
            .where(eq(invoices.id, invoiceId))
            .limit(1);

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        if (!invoice.orderId) {
            return { success: false, error: "Attach the invoice to a purchase order before running deterministic matching." };
        }

        const { validateThreeWayMatch } = await import("./orders");
        const result = await validateThreeWayMatch(invoice.orderId);

        if (!result.success) {
            return { success: false, error: 'error' in result ? result.error || "Failed to rerun deterministic matching" : "Failed to rerun deterministic matching" };
        }

        if (!('status' in result)) {
            return { success: false, error: "Invoice rule engine did not return a match state." };
        }

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'UPDATE',
            entityType: 'invoice',
            entityId: invoiceId,
            details: `Deterministic match rerun for invoice ${invoice.invoiceNumber}`,
        });

        revalidatePath('/sourcing/invoices');
        revalidatePath('/sourcing/exceptions');

        return {
            success: true,
            status: result.status,
            reason: 'reason' in result ? result.reason : undefined,
        };
    } catch (error) {
        console.error("Failed to rerun invoice match:", error);
        return { success: false, error: "Failed to rerun invoice matching" };
    }
}

export async function getInvoiceOverrideRequests(filters?: {
    status?: 'pending' | 'approved' | 'rejected';
    invoiceId?: string;
    limit?: number;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin' || !canRunInvoiceRules(session.user)) {
        return [];
    }

    try {
        const conditions = [];

        if (filters?.status) {
            conditions.push(eq(invoiceOverrideRequests.status, filters.status));
        }

        if (filters?.invoiceId) {
            conditions.push(eq(invoiceOverrideRequests.invoiceId, filters.invoiceId));
        }

        const rows = await db.select({
            id: invoiceOverrideRequests.id,
            invoiceId: invoiceOverrideRequests.invoiceId,
            requestType: invoiceOverrideRequests.requestType,
            status: invoiceOverrideRequests.status,
            reason: invoiceOverrideRequests.reason,
            decisionNotes: invoiceOverrideRequests.decisionNotes,
            requestedById: invoiceOverrideRequests.requestedById,
            approvedById: invoiceOverrideRequests.approvedById,
            requestedAt: invoiceOverrideRequests.requestedAt,
            approvedAt: invoiceOverrideRequests.approvedAt,
            rejectedAt: invoiceOverrideRequests.rejectedAt,
            updatedAt: invoiceOverrideRequests.updatedAt,
            invoiceNumber: invoices.invoiceNumber,
            invoiceStatus: invoices.status,
            releaseHold: invoices.releaseHold,
            reversedAt: invoices.reversedAt,
        })
            .from(invoiceOverrideRequests)
            .innerJoin(invoices, eq(invoiceOverrideRequests.invoiceId, invoices.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(invoiceOverrideRequests.requestedAt))
            .limit(Math.min(Math.max(filters?.limit || 25, 1), 100));

        const userIds = Array.from(new Set(rows.flatMap((row) => [row.requestedById, row.approvedById]).filter(Boolean))) as string[];
        const userRows = userIds.length > 0
            ? await db.select({
                id: users.id,
                name: users.name,
            }).from(users).where(inArray(users.id, userIds))
            : [];
        const userMap = new Map(userRows.map((row) => [row.id, row.name]));

        return rows.map((row) => ({
            ...row,
            requestedByName: userMap.get(row.requestedById) || 'Unknown user',
            approvedByName: row.approvedById ? userMap.get(row.approvedById) || 'Unknown user' : null,
        }));
    } catch (error) {
        console.error("Failed to fetch invoice override requests:", error);
        return [];
    }
}

export async function requestInvoiceOverride(data: {
    invoiceId: string;
    requestType: 'place_hold' | 'clear_hold' | 'payment_reversal';
    reason: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const canRequest = data.requestType === 'payment_reversal'
        ? canMarkInvoicePaid(session.user)
        : canRunInvoiceRules(session.user);

    if (!canRequest) {
        return { success: false, error: "Unauthorized" };
    }

    const reason = String(data.reason || "").trim();
    if (reason.length < 8) {
        return { success: false, error: "Please record a specific override reason before routing this request." };
    }

    try {
        const [invoice] = await db.select({
            id: invoices.id,
            supplierId: invoices.supplierId,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
            releaseHold: invoices.releaseHold,
            reversedAt: invoices.reversedAt,
        }).from(invoices)
            .where(eq(invoices.id, data.invoiceId))
            .limit(1);

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        const currentStatus = (invoice.status || 'pending') as 'pending' | 'matched' | 'disputed' | 'paid';

        if (data.requestType === 'place_hold') {
            if (!['matched', 'paid'].includes(currentStatus)) {
                return { success: false, error: "A release hold can only be requested after the invoice reaches matched or paid state." };
            }
            if (invoice.releaseHold) {
                return { success: false, error: "A release hold is already active for this invoice." };
            }
        }

        if (data.requestType === 'clear_hold') {
            if (!invoice.releaseHold) {
                return { success: false, error: "This invoice does not currently have an approved release hold." };
            }
            if (invoice.reversedAt) {
                return { success: false, error: "A reversed invoice cannot clear the hold state back into payment flow." };
            }
        }

        if (data.requestType === 'payment_reversal') {
            if (currentStatus !== 'paid') {
                return { success: false, error: "Only paid invoices can enter the payment reversal flow." };
            }
            if (invoice.reversedAt) {
                return { success: false, error: "This invoice already has a completed reversal record." };
            }
        }

        const [existingPending] = await db.select({
            id: invoiceOverrideRequests.id,
        }).from(invoiceOverrideRequests)
            .where(and(
                eq(invoiceOverrideRequests.invoiceId, data.invoiceId),
                eq(invoiceOverrideRequests.status, 'pending'),
            ))
            .limit(1);

        if (existingPending) {
            return { success: false, error: "A dual-approval override is already pending for this invoice." };
        }

        const [request] = await db.transaction(async (tx) => {
            const [created] = await tx.insert(invoiceOverrideRequests).values({
                invoiceId: data.invoiceId,
                requestType: data.requestType,
                reason,
                requestedById: session.user.id,
            }).returning();

            await tx.insert(workflowTasks).values({
                title: `${getOverrideTitle(data.requestType)} for invoice ${invoice.invoiceNumber}`,
                description: `${reason} A second finance approver must approve or reject this request before the invoice state changes.`,
                entityType: 'invoice',
                entityId: data.invoiceId,
                priority: data.requestType === 'payment_reversal' ? 'critical' : 'high',
                createdById: session.user.id,
                nextAction: 'Open Financial Matching, review the override queue, and record an approval or rejection with notes.',
            });

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'REQUEST_OVERRIDE',
                entityType: 'invoice',
                entityId: data.invoiceId,
                details: `${getOverrideTitle(data.requestType)} requested for invoice ${invoice.invoiceNumber}. Reason: ${reason}`,
            });

            return [created];
        });

        const reviewers = await db.select({
            id: users.id,
        }).from(users)
            .where(and(
                eq(users.role, 'admin'),
                inArray(users.accessProfile, [...OVERRIDE_REVIEWER_PROFILES]),
                sql`${users.id} <> ${session.user.id}`,
            ));

        await Promise.allSettled(reviewers.map((reviewer) => createNotification({
            userId: reviewer.id,
            title: 'Dual approval required',
            message: `${getOverrideTitle(data.requestType)} was requested for invoice ${invoice.invoiceNumber}. A second approver must review it before the finance state can change.`,
            type: 'warning',
            link: '/admin/financial-matching',
        })));

        revalidatePath('/admin/financial-matching');
        revalidatePath('/admin/tasks');
        revalidatePath('/sourcing/invoices');

        return { success: true, requestId: request.id };
    } catch (error) {
        console.error("Failed to request invoice override:", error);
        return { success: false, error: "Failed to route the override request." };
    }
}

export async function reviewInvoiceOverride(data: {
    requestId: string;
    decision: 'approved' | 'rejected';
    decisionNotes?: string;
    reversalReference?: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin' || !canMarkInvoicePaid(session.user)) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [request] = await db.select({
            id: invoiceOverrideRequests.id,
            invoiceId: invoiceOverrideRequests.invoiceId,
            requestType: invoiceOverrideRequests.requestType,
            status: invoiceOverrideRequests.status,
            reason: invoiceOverrideRequests.reason,
            requestedById: invoiceOverrideRequests.requestedById,
            invoiceNumber: invoices.invoiceNumber,
            invoiceStatus: invoices.status,
            supplierId: invoices.supplierId,
            releaseHold: invoices.releaseHold,
            reversedAt: invoices.reversedAt,
        }).from(invoiceOverrideRequests)
            .innerJoin(invoices, eq(invoiceOverrideRequests.invoiceId, invoices.id))
            .where(eq(invoiceOverrideRequests.id, data.requestId))
            .limit(1);

        if (!request) {
            return { success: false, error: "Override request not found" };
        }

        if (request.status !== 'pending') {
            return { success: false, error: "This override request is already closed." };
        }

        if (request.requestedById === session.user.id) {
            return { success: false, error: "Four-eyes enforcement blocks self-approval. A different approver must review this override." };
        }

        const decisionNotes = String(data.decisionNotes || "").trim();
        const reversalReference = String(data.reversalReference || "").trim();

        await db.transaction(async (tx) => {
            const [freshInvoice] = await tx.select({
                id: invoices.id,
                status: invoices.status,
                releaseHold: invoices.releaseHold,
                reversedAt: invoices.reversedAt,
                invoiceNumber: invoices.invoiceNumber,
            }).from(invoices)
                .where(eq(invoices.id, request.invoiceId))
                .limit(1);

            if (!freshInvoice) {
                throw new Error("Invoice not found");
            }

            if (data.decision === 'approved') {
                if (request.requestType === 'place_hold') {
                    await tx.update(invoices)
                        .set({
                            releaseHold: true,
                            releaseHoldReason: request.reason,
                            releaseHoldAppliedAt: new Date(),
                        })
                        .where(eq(invoices.id, request.invoiceId));
                }

                if (request.requestType === 'clear_hold') {
                    await tx.update(invoices)
                        .set({
                            releaseHold: false,
                            releaseHoldReason: null,
                            releaseHoldAppliedAt: null,
                        })
                        .where(eq(invoices.id, request.invoiceId));
                }

                if (request.requestType === 'payment_reversal') {
                    await tx.update(invoices)
                        .set({
                            releaseHold: true,
                            releaseHoldReason: request.reason,
                            releaseHoldAppliedAt: new Date(),
                            reversedAt: new Date(),
                            reversalReason: request.reason,
                            reversalReference: reversalReference || null,
                            reversedById: session.user.id,
                        })
                        .where(eq(invoices.id, request.invoiceId));
                }
            }

            await tx.update(invoiceOverrideRequests)
                .set({
                    status: data.decision,
                    approvedById: session.user.id,
                    approvedAt: data.decision === 'approved' ? new Date() : null,
                    rejectedAt: data.decision === 'rejected' ? new Date() : null,
                    decisionNotes: decisionNotes || null,
                    updatedAt: new Date(),
                })
                .where(eq(invoiceOverrideRequests.id, data.requestId));

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: data.decision === 'approved' ? 'APPROVE_OVERRIDE' : 'REJECT_OVERRIDE',
                entityType: 'invoice',
                entityId: request.invoiceId,
                details: `${getOverrideTitle(request.requestType)} ${data.decision} for invoice ${request.invoiceNumber}.${decisionNotes ? ` Notes: ${decisionNotes}` : ''}${reversalReference ? ` Reversal reference: ${reversalReference}` : ''}`,
            });

            const [openOverrideTasks] = await tx.select({
                id: workflowTasks.id,
            }).from(workflowTasks)
                .where(and(
                    eq(workflowTasks.entityType, 'invoice'),
                    eq(workflowTasks.entityId, request.invoiceId),
                    inArray(workflowTasks.status, [...ACTIVE_INVOICE_REVIEW_STATUSES]),
                    ilike(workflowTasks.title, `%invoice ${request.invoiceNumber}%`),
                ))
                .limit(1);

            if (openOverrideTasks) {
                await tx.update(workflowTasks)
                    .set({
                        status: 'completed',
                        completedAt: new Date(),
                        completionEvidence: `${getOverrideTitle(request.requestType)} ${data.decision} by second approver.`,
                        updatedAt: new Date(),
                    })
                    .where(eq(workflowTasks.id, openOverrideTasks.id));
            }

            if (data.decision === 'approved' && request.requestType === 'place_hold') {
                const [existingTask] = await tx.select({
                    id: workflowTasks.id,
                    status: workflowTasks.status,
                }).from(workflowTasks)
                    .where(and(
                        eq(workflowTasks.entityType, 'invoice'),
                        eq(workflowTasks.entityId, request.invoiceId),
                        inArray(workflowTasks.status, [...ACTIVE_INVOICE_REVIEW_STATUSES]),
                    ))
                    .orderBy(desc(workflowTasks.createdAt))
                    .limit(1);

                if (existingTask) {
                    await tx.update(workflowTasks)
                        .set({
                            status: existingTask.status === 'blocked' ? 'open' : existingTask.status,
                            priority: 'high',
                            nextAction: 'Release hold is active. Resolve the dispute, then request dual approval to clear the hold before payment can resume.',
                            updatedAt: new Date(),
                        })
                        .where(eq(workflowTasks.id, existingTask.id));
                } else {
                    await tx.insert(workflowTasks).values({
                        title: `Manual review for invoice ${request.invoiceNumber}`,
                        description: `Release hold approved. Resolve the issue before requesting a dual-approved hold release.`,
                        entityType: 'invoice',
                        entityId: request.invoiceId,
                        priority: 'high',
                        createdById: session.user.id,
                        nextAction: 'Resolve the issue, then route a hold-release approval when the invoice is safe to continue.',
                    });
                }
            }
        });

        await createNotification({
            userId: request.requestedById,
            title: data.decision === 'approved' ? 'Invoice override approved' : 'Invoice override rejected',
            message: `${getOverrideTitle(request.requestType)} for invoice ${request.invoiceNumber} was ${data.decision}.`,
            type: data.decision === 'approved' ? 'success' : 'warning',
            link: '/admin/financial-matching',
        });

        if (data.decision === 'approved' && request.supplierId) {
            await createNotification({
                userId: request.supplierId,
                title: request.requestType === 'payment_reversal' ? 'Invoice payment reversed' : 'Invoice finance hold updated',
                message: request.requestType === 'payment_reversal'
                    ? `Invoice ${request.invoiceNumber} now carries a finance reversal record.`
                    : `Invoice ${request.invoiceNumber} is under controlled finance review.`,
                type: 'warning',
                link: '/portal/invoices',
            });
        }

        revalidatePath('/admin/financial-matching');
        revalidatePath('/admin/tasks');
        revalidatePath('/sourcing/invoices');
        revalidatePath('/sourcing/exceptions');

        return { success: true };
    } catch (error) {
        console.error("Failed to review invoice override:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to review the override request." };
    }
}
