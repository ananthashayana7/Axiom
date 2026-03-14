'use server'

import { db } from "@/db";
import { invoices, procurementOrders, auditLogs, suppliers } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and, ilike, gte, lte, sql } from "drizzle-orm";
import { createNotification } from "./notifications";

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
        const userRole = (session.user as any).role;
        const userSupplierId = (session.user as any).supplierId;

        const conditions: any[] = [];

        if (userRole === 'supplier') {
            conditions.push(eq(invoices.supplierId, userSupplierId));
        }
        if (filters?.status && filters.status !== 'all') {
            conditions.push(eq(invoices.status, filters.status as any));
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
    orderId: string,
    supplierId: string,
    invoiceNumber: string,
    amount: number
}) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const [invoice] = await db.insert(invoices).values({
            orderId: data.orderId,
            supplierId: data.supplierId,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount.toString(),
            status: 'pending'
        }).returning();

        // Audit Log
        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
            action: 'CREATE',
            entityType: 'invoice',
            entityId: invoice.id,
            details: `Invoice ${data.invoiceNumber} created for order ${data.orderId}`
        });

        revalidatePath('/sourcing/invoices');
        revalidatePath('/portal/invoices');
        return { success: true, data: invoice };
    } catch (error) {
        console.error("Failed to create invoice:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function updateInvoiceStatus(id: string, status: 'matched' | 'disputed' | 'paid') {
    const session = await auth();
    if (!session?.user || (session?.user as any)?.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        const updateData: any = { status };
        if (status === 'matched') {
            updateData.matchedAt = new Date();
        }

        await db.update(invoices)
            .set(updateData)
            .where(eq(invoices.id, id));

        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));

        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
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
