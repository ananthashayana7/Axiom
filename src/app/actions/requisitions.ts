'use server'

import { db } from "@/db";
import { budgets, requisitions, auditLogs, users } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, and, sql } from "drizzle-orm";
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

export async function createRequisition(data: { 
    title: string, 
    description?: string, 
    estimatedAmount: number, 
    department?: string,
    budgetId?: string 
}) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        if (data.estimatedAmount <= 0) return { success: false, error: "Amount must be positive" };

        let requisition: typeof requisitions.$inferSelect | null = null;

        await db.transaction(async (tx) => {
            if (data.budgetId) {
                const [reservedBudget] = await tx.update(budgets)
                    .set({
                        usedAmount: sql`CAST(${budgets.usedAmount} AS numeric) + ${data.estimatedAmount}`,
                    })
                    .where(and(
                        eq(budgets.id, data.budgetId),
                        eq(budgets.status, 'active'),
                        sql`(CAST(${budgets.totalAmount} AS numeric) - CAST(${budgets.usedAmount} AS numeric)) >= ${data.estimatedAmount}`,
                    ))
                    .returning({ id: budgets.id });

                if (!reservedBudget) {
                    throw new Error("Insufficient active budget for this requisition");
                }
            }

            const [created] = await tx.insert(requisitions).values({
                title: data.title,
                description: data.description,
                estimatedAmount: data.estimatedAmount.toFixed(2),
                department: data.department,
                budgetId: data.budgetId,
                requestedById: session.user.id,
                status: 'pending_approval'
            }).returning();

            requisition = created;

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'CREATE',
                entityType: 'requisition',
                entityId: created.id,
                details: `Requisition created for ${data.title} - Est. Amount: ${data.estimatedAmount}`
            });
        });

        if (!requisition) {
            return { success: false, error: "Failed to create requisition" };
        }

        // Threshold-based approval routing:
        // - Low amount (≤ 10,000): notify admins in the same department (department leads)
        // - High amount (> 10,000): notify all admins (finance-level review)
        try {
            const APPROVAL_THRESHOLD = 10000;
            let approvers;

            if (data.estimatedAmount <= APPROVAL_THRESHOLD && data.department) {
                // Route to department leads first
                approvers = await db.select({ id: users.id }).from(users)
                    .where(and(eq(users.role, 'admin'), eq(users.department, data.department)));
                // Fall back to all admins if no department-specific admin exists
                if (approvers.length === 0) {
                    approvers = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
                }
            } else {
                // High-value: all admins for finance-level review
                approvers = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
            }

            await Promise.allSettled(
                approvers.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: 'New Requisition Pending Approval',
                        message: `"${data.title}" submitted by ${session.user.name || 'a user'} — Est. ${data.estimatedAmount.toLocaleString()}`,
                        type: 'info',
                        link: `/sourcing/requisitions?id=${requisition.id}`,
                    })
                )
            );
        } catch { /* notification failure should not block requisition creation */ }

        revalidatePath('/sourcing/requisitions');
        return { success: true, data: requisition };
    } catch (error) {
        console.error("Failed to create requisition:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function approveRequisition(id: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Only admins can approve requisitions" };

    try {
        let requisitionToNotify: typeof requisitions.$inferSelect | null = null;

        const result = await db.transaction(async (tx) => {
            await tx.execute(sql`select ${requisitions.id} from ${requisitions} where ${requisitions.id} = ${id} for update`);

            const [requisition] = await tx.select().from(requisitions).where(eq(requisitions.id, id));
            if (!requisition) return { success: false, error: "Requisition not found" };

            if (requisition.requestedById === session.user.id) {
                return { success: false, error: "Self-approval is not allowed for compliance (Segregation of Duties)." };
            }

            if (requisition.status !== 'pending_approval') {
                return { success: false, error: `Requisition is already ${requisition.status}` };
            }

            const [updated] = await tx.update(requisitions)
                .set({ status: 'approved' })
                .where(and(eq(requisitions.id, id), eq(requisitions.status, 'pending_approval')))
                .returning();

            if (!updated) {
                return { success: false, error: "Requisition was updated by another user. Refresh and try again." };
            }

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'APPROVE',
                entityType: 'requisition',
                entityId: id,
                details: `Requisition approved by admin`
            });

            requisitionToNotify = requisition;
            return { success: true };
        });

        if (!result.success) return result;

        if (requisitionToNotify) {
            await createNotification({
                userId: requisitionToNotify.requestedById,
                title: "Requisition Approved",
                message: `Your requisition for "${requisitionToNotify.title}" has been approved!`,
                type: 'success',
                link: `/sourcing/requisitions?id=${requisitionToNotify.id}`
            });
        }

        revalidatePath('/sourcing/requisitions');
        return { success: true };
    } catch (error) {
        console.error("Approval failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

export async function rejectRequisition(id: string, reason: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Only admins can reject requisitions" };

    try {
        let requisitionToNotify: typeof requisitions.$inferSelect | null = null;

        const result = await db.transaction(async (tx) => {
            await tx.execute(sql`select ${requisitions.id} from ${requisitions} where ${requisitions.id} = ${id} for update`);

            const [requisition] = await tx.select().from(requisitions).where(eq(requisitions.id, id));
            if (!requisition) return { success: false, error: "Requisition not found" };

            if (requisition.status !== 'pending_approval') {
                return { success: false, error: `Requisition is already ${requisition.status}` };
            }

            const [updated] = await tx.update(requisitions)
                .set({ status: 'rejected' })
                .where(and(eq(requisitions.id, id), eq(requisitions.status, 'pending_approval')))
                .returning();

            if (!updated) {
                return { success: false, error: "Requisition was updated by another user. Refresh and try again." };
            }

            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'REJECT',
                entityType: 'requisition',
                entityId: id,
                details: `Requisition rejected. Reason: ${reason}`
            });

            requisitionToNotify = requisition;
            return { success: true };
        });

        if (!result.success) return result;

        if (requisitionToNotify) {
            await createNotification({
                userId: requisitionToNotify.requestedById,
                title: "Requisition Rejected",
                message: `Your requisition for "${requisitionToNotify.title}" was rejected. Reason: ${reason}`,
                type: 'warning',
                link: `/sourcing/requisitions?id=${requisitionToNotify.id}`
            });
        }

        revalidatePath('/sourcing/requisitions');
        return { success: true };
    } catch (error) {
        console.error("Rejection failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}

import { procurementOrders } from "@/db/schema";

export async function convertToPO(requisitionId: string, supplierId: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Only admins can convert to PO" };

    try {
        let requisitionToNotify: typeof requisitions.$inferSelect | null = null;
        const result = await db.transaction(async (tx) => {
            await tx.execute(sql`select ${requisitions.id} from ${requisitions} where ${requisitions.id} = ${requisitionId} for update`);

            const [requisition] = await tx.select().from(requisitions).where(eq(requisitions.id, requisitionId));
            if (!requisition) {
                return { success: false, error: "Requisition not found" };
            }
            if (requisition.status !== 'approved') {
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
                .where(and(eq(requisitions.id, requisitionId), eq(requisitions.status, 'approved')));

            // 3. Log Audit
            await tx.insert(auditLogs).values({
                userId: session.user.id,
                action: 'CONVERT',
                entityType: 'requisition',
                entityId: requisitionId,
                details: `Requisition converted to PO: ${order.id}`
            });

            requisitionToNotify = requisition;
            return { success: true, orderId: order.id };
        });

        if (!result.success) return result;

        if (requisitionToNotify && result.orderId) {
            await createNotification({
                userId: requisitionToNotify.requestedById,
                title: "Purchase Order Issued",
                message: `Requisition "${requisitionToNotify.title}" has been converted to PO #${result.orderId.split('-')[0].toUpperCase()}.`,
                type: 'info',
                link: `/sourcing/orders?id=${result.orderId}`
            });
        }

        revalidatePath('/sourcing/requisitions');
        revalidatePath('/sourcing/orders');
        return result;
    } catch (error: unknown) {
        console.error("Conversion failed:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
