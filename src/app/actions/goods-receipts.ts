'use server'

import { db } from "@/db";
import { goodsReceipts, procurementOrders, auditLogs } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";

export async function getGoodsReceipts() {
    try {
        const result = await db.select()
            .from(goodsReceipts)
            .orderBy(desc(goodsReceipts.receivedAt));
        return result;
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
        return { success: true, data: receipt };
    } catch (error) {
        console.error("Failed to create goods receipt:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
export async function deleteGoodsReceipt(id: string) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        await db.delete(goodsReceipts).where(eq(goodsReceipts.id, id));
        revalidatePath("/sourcing/goods-receipts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete goods receipt:", error);
        return { success: false, error: "Failed to delete" };
    }
}
