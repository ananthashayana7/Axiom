'use server'

import { db } from "@/db";
import { invoices, procurementOrders, auditLogs, suppliers } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and } from "drizzle-orm";
import { createNotification } from "./notifications";

export async function getInvoices() {
    const session = await auth();
    if (!session) return [];

    try {
        const userRole = (session.user as any).role;
        const userSupplierId = (session.user as any).supplierId;

        if (userRole === 'supplier') {
            return await db.select()
                .from(invoices)
                .where(eq(invoices.supplierId, userSupplierId))
                .orderBy(desc(invoices.createdAt));
        }

        return await db.select()
            .from(invoices)
            .orderBy(desc(invoices.createdAt));
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
