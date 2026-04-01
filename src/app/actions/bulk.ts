'use server'

import { db } from "@/db";
import { procurementOrders, requisitions, auditLogs } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createNotification } from "./notifications";

export async function bulkUpdateOrderStatus(
    ids: string[],
    status: 'approved' | 'rejected' | 'sent' | 'cancelled'
) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can perform bulk order actions" };
    }

    if (!ids.length) return { success: false, error: "No orders selected" };

    try {
        let updated = 0;
        const errors: string[] = [];

        for (const id of ids) {
            try {
                await db.update(procurementOrders)
                    .set({ status })
                    .where(eq(procurementOrders.id, id));

                await db.insert(auditLogs).values({
                    userId: session.user.id,
                    action: 'BULK_UPDATE',
                    entityType: 'order',
                    entityId: id,
                    details: `Bulk status change to ${status.toUpperCase()}`
                });

                updated++;
            } catch (e) {
                errors.push(`Order ${id.split('-')[0]}: ${e instanceof Error ? e.message : 'Failed'}`);
            }
        }

        revalidatePath('/sourcing/orders');
        revalidatePath('/portal/orders');

        return {
            success: true,
            updated,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error("Bulk order update failed:", error);
        return { success: false, error: "Bulk operation failed" };
    }
}

export async function bulkApproveRequisitions(ids: string[]) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can approve requisitions" };
    }

    if (!ids.length) return { success: false, error: "No requisitions selected" };

    try {
        let approved = 0;
        const errors: string[] = [];

        for (const id of ids) {
            try {
                const [req] = await db.select().from(requisitions).where(eq(requisitions.id, id));
                if (!req) {
                    errors.push(`Requisition ${id.split('-')[0]}: Not found`);
                    continue;
                }

                // Enforce Segregation of Duties
                if (req.requestedById === session.user.id) {
                    errors.push(`Requisition ${id.split('-')[0]}: Self-approval blocked (SoD compliance)`);
                    continue;
                }

                if (req.status !== 'pending_approval') {
                    errors.push(`Requisition ${id.split('-')[0]}: Not in pending_approval status`);
                    continue;
                }

                await db.update(requisitions)
                    .set({ status: 'approved' })
                    .where(eq(requisitions.id, id));

                await db.insert(auditLogs).values({
                    userId: session.user.id,
                    action: 'BULK_APPROVE',
                    entityType: 'requisition',
                    entityId: id,
                    details: `Requisition bulk-approved by admin`
                });

                // Notify requester
                await createNotification({
                    userId: req.requestedById,
                    title: "Requisition Approved",
                    message: `Your requisition "${req.title}" has been approved (bulk action).`,
                    type: 'success',
                    link: `/sourcing/requisitions?id=${req.id}`,
                });

                approved++;
            } catch (e) {
                errors.push(`Requisition ${id.split('-')[0]}: ${e instanceof Error ? e.message : 'Failed'}`);
            }
        }

        revalidatePath('/sourcing/requisitions');

        return {
            success: true,
            approved,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error("Bulk approval failed:", error);
        return { success: false, error: "Bulk operation failed" };
    }
}

export async function bulkRejectRequisitions(ids: string[], reason: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can reject requisitions" };
    }

    if (!ids.length) return { success: false, error: "No requisitions selected" };
    if (!reason.trim()) return { success: false, error: "Rejection reason is required" };

    try {
        let rejected = 0;
        const errors: string[] = [];

        for (const id of ids) {
            try {
                const [req] = await db.select().from(requisitions).where(eq(requisitions.id, id));
                if (!req) {
                    errors.push(`Requisition ${id.split('-')[0]}: Not found`);
                    continue;
                }

                await db.update(requisitions)
                    .set({ status: 'rejected' })
                    .where(eq(requisitions.id, id));

                await db.insert(auditLogs).values({
                    userId: session.user.id,
                    action: 'BULK_REJECT',
                    entityType: 'requisition',
                    entityId: id,
                    details: `Requisition bulk-rejected. Reason: ${reason}`
                });

                await createNotification({
                    userId: req.requestedById,
                    title: "Requisition Rejected",
                    message: `Your requisition "${req.title}" was rejected. Reason: ${reason}`,
                    type: 'warning',
                    link: `/sourcing/requisitions?id=${req.id}`,
                });

                rejected++;
            } catch (e) {
                errors.push(`Requisition ${id.split('-')[0]}: ${e instanceof Error ? e.message : 'Failed'}`);
            }
        }

        revalidatePath('/sourcing/requisitions');

        return {
            success: true,
            rejected,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error("Bulk rejection failed:", error);
        return { success: false, error: "Bulk operation failed" };
    }
}
