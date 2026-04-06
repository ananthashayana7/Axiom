'use server'

import { db } from "@/db";
import { goodsReceipts, procurementOrders, auditLogs, qcInspections, orderItems, parts } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

async function incrementInventoryForOrder(orderId: string) {
    const items = await db.select({
        partId: orderItems.partId,
        quantity: orderItems.quantity,
    }).from(orderItems).where(eq(orderItems.orderId, orderId));

    await Promise.all(items.map((item) => db.update(parts)
        .set({ stockLevel: sql`${parts.stockLevel} + ${item.quantity}` })
        .where(eq(parts.id, item.partId))));
}

export async function getGoodsReceipts() {
    try {
        const result = await db.select()
            .from(goodsReceipts)
            .orderBy(desc(goodsReceipts.receivedAt));

        const receiptIds = result.map((receipt) => receipt.id);
        if (receiptIds.length === 0) {
            return result;
        }

        const inspections = await db.select({
            receiptId: qcInspections.receiptId,
            status: qcInspections.status,
            notes: qcInspections.notes,
            createdAt: qcInspections.createdAt,
        })
            .from(qcInspections)
            .where(inArray(qcInspections.receiptId, receiptIds))
            .orderBy(desc(qcInspections.createdAt));

        const latestInspectionByReceipt = new Map<string, typeof inspections[number]>();
        for (const inspection of inspections) {
            if (!latestInspectionByReceipt.has(inspection.receiptId)) {
                latestInspectionByReceipt.set(inspection.receiptId, inspection);
            }
        }

        const staleReceipts = result.filter((receipt) => {
            const latestInspection = latestInspectionByReceipt.get(receipt.id);
            if (!latestInspection) {
                return false;
            }

            const latestNotes = latestInspection.notes || null;
            const currentNotes = receipt.inspectionNotes || null;

            return latestInspection.status !== receipt.inspectionStatus || latestNotes !== currentNotes;
        });

        if (staleReceipts.length > 0) {
            await Promise.all(staleReceipts.map((receipt) => {
                const latestInspection = latestInspectionByReceipt.get(receipt.id);
                if (!latestInspection) {
                    return Promise.resolve();
                }

                return db.update(goodsReceipts)
                    .set({
                        inspectionStatus: latestInspection.status,
                        inspectionNotes: latestInspection.notes || null,
                    })
                    .where(eq(goodsReceipts.id, receipt.id));
            }));
        }

        return result.map((receipt) => {
            const latestInspection = latestInspectionByReceipt.get(receipt.id);
            return {
                ...receipt,
                inspectionStatus: latestInspection?.status || receipt.inspectionStatus,
                inspectionNotes: latestInspection?.notes || receipt.inspectionNotes,
            };
        });
    } catch (error) {
        console.error("Failed to fetch goods receipts:", error);
        return [];
    }
}

export async function createGoodsReceipt(data: { orderId: string, notes?: string }) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const [receipt] = await db.insert(goodsReceipts).values({
            orderId: data.orderId,
            receivedById: (session.user as any).id,
            notes: data.notes
        }).returning();

        // Update Order Status to fulfilled if needed
        await db.update(procurementOrders)
            .set({ status: 'fulfilled' })
            .where(eq(procurementOrders.id, data.orderId));

        // Kick financial workflow re-check after GRN creation.
        try {
            const { validateThreeWayMatch } = await import('./orders');
            await validateThreeWayMatch(data.orderId);
        } catch (error) {
            console.warn('Three-way match trigger failed after GRN create:', error);
        }

        // Audit Log
        await db.insert(auditLogs).values({
            userId: (session.user as any).id,
            action: 'CREATE',
            entityType: 'goods_receipt',
            entityId: receipt.id,
            details: `Goods receipt created for order ${data.orderId}`
        });

        revalidatePath('/sourcing/goods-receipts');
        revalidatePath('/sourcing/orders');
        revalidatePath('/sourcing/invoices');
        revalidatePath('/transactions');
        return { success: true, data: receipt };
    } catch (error) {
        console.error("Failed to create goods receipt:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
export async function deleteGoodsReceipt(id: string) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        await db.delete(goodsReceipts).where(eq(goodsReceipts.id, id));
        revalidatePath("/sourcing/goods-receipts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete goods receipt:", error);
        return { success: false, error: "Failed to delete" };
    }
}

export async function updateGoodsReceiptInspection(data: {
    receiptId: string;
    status: 'pending' | 'passed' | 'failed' | 'conditional';
    notes?: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [receipt] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, data.receiptId)).limit(1);
        if (!receipt) {
            return { success: false, error: "Receipt not found" };
        }

        const siblingReceipts = await db.select({ id: goodsReceipts.id })
            .from(goodsReceipts)
            .where(eq(goodsReceipts.orderId, receipt.orderId));

        const priorPassedInspections = siblingReceipts.length > 0
            ? await db.select({ count: sql<number>`COUNT(*)::int` })
                .from(qcInspections)
                .where(and(
                    inArray(qcInspections.receiptId, siblingReceipts.map((row) => row.id)),
                    eq(qcInspections.status, 'passed')
                ))
            : [{ count: 0 }];

        const hadPassedReceipt = receipt.inspectionStatus === 'passed' || (priorPassedInspections[0]?.count || 0) > 0;

        await db.transaction(async (tx) => {
            await tx.update(goodsReceipts)
                .set({
                    inspectionStatus: data.status,
                    inspectionNotes: data.notes || null,
                })
                .where(eq(goodsReceipts.id, data.receiptId));

            await tx.insert(qcInspections).values({
                receiptId: data.receiptId,
                inspectorId: (session.user as any).id,
                status: data.status,
                visualInspectionPassed: data.status === 'passed' ? 'yes' : 'no',
                quantityVerified: data.status === 'passed' ? 'yes' : 'no',
                documentMatch: data.status === 'passed' ? 'yes' : 'no',
                notes: data.notes,
            });

            await tx.insert(auditLogs).values({
                userId: (session.user as any).id,
                action: 'UPDATE',
                entityType: 'goods_receipt',
                entityId: data.receiptId,
                details: `Inspection updated to ${data.status}${data.notes ? `: ${data.notes}` : ''}`
            });

            if (data.status === 'passed') {
                await tx.update(procurementOrders)
                    .set({ status: 'fulfilled' })
                    .where(eq(procurementOrders.id, receipt.orderId));
            }
        });

        if (data.status === 'passed' && !hadPassedReceipt) {
            await incrementInventoryForOrder(receipt.orderId);
        }

        try {
            const { validateThreeWayMatch } = await import('./orders');
            await validateThreeWayMatch(receipt.orderId);
        } catch (error) {
            console.warn('Three-way match trigger failed after inspection update:', error);
        }

        revalidatePath('/sourcing/goods-receipts');
        revalidatePath(`/sourcing/orders/${receipt.orderId}`);
        revalidatePath('/sourcing/invoices');
        revalidatePath('/transactions');

        return { success: true };
    } catch (error) {
        console.error("Failed to update goods receipt inspection:", error);
        return { success: false, error: "Failed to update inspection" };
    }
}
