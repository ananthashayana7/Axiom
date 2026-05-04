'use server'

import { db } from "@/db";
import { invoices, auditLogs, suppliers, fraudAlerts, workflowTasks } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and, ilike, gte, lte, inArray } from "drizzle-orm";
import { createNotification } from "./notifications";
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conditions: any[] = [];

        if (userRole === 'supplier') {
            conditions.push(eq(invoices.supplierId, userSupplierId));
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
                supplierName: suppliers.name,
                supplierCountry: suppliers.countryCode,
            })
            .from(invoices)
            .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(invoices.createdAt));

        return rows;
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
                        ? 'Resolve the invoice discrepancy, rerun deterministic matching, then release payment.'
                        : requiresHumanRelease
                            ? 'Confirm supplier, tax, and banking evidence, then close the review task before payment release.'
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

    try {
        const [invoice] = await db.select({
            id: invoices.id,
            supplierId: invoices.supplierId,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
        }).from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        const logBlockedRelease = async (details: string) => {
            await db.insert(auditLogs).values({
                userId: session.user.id,
                action: 'BLOCK',
                entityType: 'invoice',
                entityId: id,
                details,
            });
        };

        if (status === 'paid') {
            if (invoice.status !== 'matched') {
                await logBlockedRelease(`Payment release blocked for invoice ${invoice.invoiceNumber} because the invoice is not in matched status.`);
                return { success: false, error: "Only matched invoices can move into payment release." };
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
                await logBlockedRelease(`Payment release blocked for invoice ${invoice.invoiceNumber} because open fraud alerts still require review.`);
                return { success: false, error: "Payment release blocked until open fraud alerts are resolved." };
            }

            const [openWorkflowTask] = await db.select({ id: workflowTasks.id })
                .from(workflowTasks)
                .where(and(
                    eq(workflowTasks.entityType, 'invoice'),
                    eq(workflowTasks.entityId, id),
                    inArray(workflowTasks.status, ['open', 'in_progress', 'blocked', 'escalated']),
                ))
                .limit(1);

            if (openWorkflowTask) {
                await logBlockedRelease(`Payment release blocked for invoice ${invoice.invoiceNumber} because a human review task is still open.`);
                return { success: false, error: "Payment release blocked until invoice review tasks are closed." };
            }
        }

        const updateData: { status: 'pending' | 'matched' | 'disputed' | 'paid'; matchedAt?: Date | null } = { status };
        if (status === 'matched') {
            updateData.matchedAt = new Date();
        } else {
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

export async function rerunInvoiceMatch(invoiceId: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
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
