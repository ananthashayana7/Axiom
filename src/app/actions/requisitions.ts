'use server'

import { db } from "@/db";
import { requisitions, auditLogs } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { createNotification } from "./notifications";

export async function getRequisitions() {
    try {
        const result = await db.select().from(requisitions).orderBy(desc(requisitions.createdAt));
        return result;
    } catch (error) {
        console.error("Failed to fetch requisitions:", error);
        return [];
    }
}

export async function createRequisition(data: { title: string, description?: string, estimatedAmount: number, department?: string }) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        if (data.estimatedAmount <= 0) return { success: false, error: "Amount must be positive" };

        const [requisition] = await db.insert(requisitions).values({
            title: data.title,
            description: data.description,
            estimatedAmount: data.estimatedAmount.toFixed(2),
            department: data.department,
            requestedById: (session.user as any).id,
            status: 'pending_approval'
        }).returning();

        // Audit Trail (SOX Compliance)
        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
            action: 'CREATE',
            entityType: 'requisition',
            entityId: requisition.id,
            details: `Requisition created for ${data.title} - Est. Amount: ${data.estimatedAmount}`
        });

        revalidatePath('/sourcing/requisitions');
        return { success: true, data: requisition };
    } catch (error) {
        console.error("Failed to create requisition:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function approveRequisition(id: string) {
    const session = await auth();
    if (!session?.user || (session?.user as any)?.role !== 'admin') return { success: false, error: "Only admins can approve requisitions" };

    try {
        const [requisition] = await db.select().from(requisitions).where(eq(requisitions.id, id));
        if (!requisition) return { success: false, error: "Requisition not found" };

        if (requisition.requestedById === (session.user as any).id) {
            return { success: false, error: "Self-approval is not allowed for compliance (Segregation of Duties)." };
        }

        await db.update(requisitions)
            .set({ status: 'approved' })
            .where(eq(requisitions.id, id));

        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
            action: 'APPROVE',
            entityType: 'requisition',
            entityId: id,
            details: `Requisition approved by admin`
        });

        // Notify Requester
        await createNotification({
            userId: requisition.requestedById,
            title: "Requisition Approved",
            message: `Your requisition for "${requisition.title}" has been approved!`,
            type: 'success',
            link: `/sourcing/requisitions?id=${requisition.id}`
        });

        revalidatePath('/sourcing/requisitions');
        return { success: true };
    } catch (error) {
        console.error("Approval failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function rejectRequisition(id: string, reason: string) {
    const session = await auth();
    if (!session?.user || (session?.user as any)?.role !== 'admin') return { success: false, error: "Only admins can reject requisitions" };

    try {
        await db.update(requisitions)
            .set({ status: 'rejected' })
            .where(eq(requisitions.id, id));

        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
            action: 'REJECT',
            entityType: 'requisition',
            entityId: id,
            details: `Requisition rejected. Reason: ${reason}`
        });

        const [requisition] = await db.select().from(requisitions).where(eq(requisitions.id, id));
        if (requisition) {
            // Notify Requester
            await createNotification({
                userId: requisition.requestedById,
                title: "Requisition Rejected",
                message: `Your requisition for "${requisition.title}" was rejected. Reason: ${reason}`,
                type: 'warning',
                link: `/sourcing/requisitions?id=${requisition.id}`
            });
        }

        revalidatePath('/sourcing/requisitions');
        return { success: true };
    } catch (error) {
        console.error("Rejection failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

import { procurementOrders, orderItems } from "@/db/schema";

export async function convertToPO(requisitionId: string, supplierId: string) {
    const session = await auth();
    if (!session?.user || (session?.user as any)?.role !== 'admin') return { success: false, error: "Only admins can convert to PO" };

    try {
        return await db.transaction(async (tx) => {
            const [requisition] = await tx.select().from(requisitions).where(eq(requisitions.id, requisitionId));
            if (!requisition) {
                tx.rollback();
                return { success: false, error: "Requisition not found" };
            }
            if (requisition.status !== 'approved') {
                tx.rollback();
                return { success: false, error: "Only approved requisitions can be converted" };
            }

            // 1. Create the Procurement Order
            const [order] = await tx.insert(procurementOrders).values({
                supplierId,
                status: 'sent', // Auto-set to sent as it's coming from an approved req
                totalAmount: requisition.estimatedAmount,
                requisitionId: requisitionId
            }).returning();

            // 2. Update the Requisition
            await tx.update(requisitions)
                .set({
                    status: 'converted_to_po',
                    purchaseOrderId: order.id
                })
                .where(eq(requisitions.id, requisitionId));

            // 3. Log Audit
            await tx.insert(auditLogs).values({
                userId: (session.user as any).id,
                action: 'CONVERT',
                entityType: 'requisition',
                entityId: requisitionId,
                details: `Requisition converted to PO: ${order.id}`
            });

            // Notify Requester
            await createNotification({
                userId: requisition.requestedById,
                title: "Purchase Order Issued",
                message: `Requisition "${requisition.title}" has been converted to PO #${order.id.split('-')[0].toUpperCase()}.`,
                type: 'info',
                link: `/sourcing/orders?id=${order.id}`
            });

            revalidatePath('/sourcing/requisitions');
            revalidatePath('/sourcing/orders');
            return { success: true, orderId: order.id };
        });
    } catch (error: any) {
        if (error.message === 'Rollback') return { success: false, error: "Transaction rolled back" };
        console.error("Conversion failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
