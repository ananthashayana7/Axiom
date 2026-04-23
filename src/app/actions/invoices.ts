'use server'

import { db } from "@/db";
import { invoices, auditLogs, suppliers } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and, ilike, gte, lte } from "drizzle-orm";
import { createNotification } from "./notifications";
import {
    coerceInvoiceNumber,
    coerceMoney,
    normalizeCurrencyCode,
    normalizeDateToIso,
    normalizeInvoiceLineItems,
    optionalDecimalString,
} from "@/lib/invoices/normalization";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

        const [invoice] = await db.insert(invoices).values({
            ...(orderId ? { orderId } : {}),
            supplierId,
            invoiceNumber,
            amount: amount.toFixed(2),
            currency: normalizeCurrencyCode(data.currency, "INR") || "INR",
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
            status: 'pending'
        }).returning();

        // Audit Log
        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'CREATE',
            entityType: 'invoice',
            entityId: invoice.id,
            details: `Invoice ${invoiceNumber} created${orderId ? ` for order ${orderId}` : ''}`
        });

        revalidatePath('/sourcing/invoices');
        revalidatePath('/portal/invoices');
        if (orderId) revalidatePath(`/sourcing/orders/${orderId}`);
        return { success: true, data: invoice };
    } catch (error) {
        console.error("Failed to create invoice:", error);
        return { success: false, error: invoiceInsertErrorMessage(error) };
    }
}

export async function updateInvoiceStatus(id: string, status: 'matched' | 'disputed' | 'paid') {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        const updateData: { status: 'matched' | 'disputed' | 'paid'; matchedAt?: Date } = { status };
        if (status === 'matched') {
            updateData.matchedAt = new Date();
        }

        await db.update(invoices)
            .set(updateData)
            .where(eq(invoices.id, id));

        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'UPDATE',
            entityType: 'invoice',
            entityId: id,
            details: `Invoice status updated to ${status}`
        });

        // Notify Supplier
        if (invoice) {
            await createNotification({
                userId: invoice.supplierId, // This might need a supplier-user lookup
                title: `Invoice ${status.toUpperCase()}`,
                message: `Your invoice ${invoice.invoiceNumber} has been updated to ${status}.`,
                type: 'info',
                link: `/portal/invoices`
            });
        }

        revalidatePath('/sourcing/invoices');
        return { success: true };
    } catch (error) {
        console.error("Failed to update invoice status:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
