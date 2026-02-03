'use server'

import { db } from "@/db";
import { parts, orderItems, rfqItems, requisitions, type Part } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { logActivity } from "./activity";
import { auth } from "@/auth";

export async function getParts(): Promise<Part[]> {
    try {
        const allParts = await db.select().from(parts).orderBy(parts.createdAt).limit(50);
        return allParts;
    } catch (error) {
        console.error("Failed to fetch parts:", error);
        return [];
    }
}

export async function addPart(formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const sku = formData.get("sku") as string;
        const category = formData.get("category") as string;
        const stockLevel = parseInt(formData.get("stock") as string) || 0;
        const price = formData.get("price") as string || '0';
        const marketTrend = formData.get("marketTrend") as string || 'stable';
        const reorderPoint = parseInt(formData.get("reorderPoint") as string) || 50;
        const minStockLevel = parseInt(formData.get("minStockLevel") as string) || 20;

        const [newPart] = await db.insert(parts).values({
            name,
            sku,
            category,
            stockLevel,
            price,
            marketTrend,
            reorderPoint,
            minStockLevel,
        }).returning();

        await logActivity('CREATE', 'part', newPart.id, `Created new part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to add part:", error);
        return { success: false, error: "Failed to add part" };
    }
}

export async function updatePart(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const sku = formData.get("sku") as string;
        const category = formData.get("category") as string;
        const stockLevel = parseInt(formData.get("stock") as string) || 0;
        const price = formData.get("price") as string;
        const marketTrend = formData.get("marketTrend") as string;
        const reorderPoint = parseInt(formData.get("reorderPoint") as string);
        const minStockLevel = parseInt(formData.get("minStockLevel") as string);

        await db.update(parts)
            .set({
                name,
                sku,
                category,
                stockLevel,
                price,
                marketTrend,
                reorderPoint,
                minStockLevel,
            })
            .where(eq(parts.id, id));

        await logActivity('UPDATE', 'part', id, `Updated part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update part:", error);
        return { success: false, error: "Failed to update part" };
    }
}

export async function deletePart(id: string) {
    try {
        // 1. Check for Active Dependencies
        const inOrders = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.partId, id)).limit(1);
        if (inOrders.length > 0) {
            return { success: false, error: "Cannot delete: Part exists in Procurement Orders." };
        }

        const inRfqs = await db.select({ id: rfqItems.id }).from(rfqItems).where(eq(rfqItems.partId, id)).limit(1);
        if (inRfqs.length > 0) {
            return { success: false, error: "Cannot delete: Part is listed in active RFQs." };
        }

        const [part] = await db.select().from(parts).where(eq(parts.id, id));
        if (part) {
            await db.delete(parts).where(eq(parts.id, id));
            await logActivity('DELETE', 'part', id, `Deleted part: ${part.name} (${part.sku})`);
        }
        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete part:", error);
        return { success: false, error: "Failed to delete part" };
    }
}

export async function deleteAllParts() {
    try {
        await db.delete(parts);
        await logActivity('DELETE', 'part', 'all', 'Cleared entire parts inventory');
        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to clear inventory:", error);
        return { success: false, error: "Failed to clear inventory" };
    }
}

export async function processLowStockAlerts() {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const lowStockParts = await db.select()
            .from(parts)
            .where(sql`${parts.stockLevel} <= ${parts.reorderPoint}`);

        if (lowStockParts.length === 0) {
            return { success: true, count: 0, message: "No low stock items found." };
        }

        let createdCount = 0;
        for (const part of lowStockParts) {
            const reorderQty = (part.reorderPoint || 50) * 2 - part.stockLevel;

            await db.insert(requisitions).values({
                title: `Auto-Reorder: ${part.name}`,
                description: `System generated reorder for SKU: ${part.sku}. Current stock: ${part.stockLevel}, Target: ${(part.reorderPoint || 50) * 2}.`,
                department: part.category,
                status: 'draft',
                requestedById: (session.user as any).id,
                estimatedAmount: (reorderQty * parseFloat(part.price || "0")).toString()
            });

            await logActivity('CREATE', 'requisition', 'auto', `Auto-generated requisition for ${part.name} due to low stock (${part.stockLevel})`);
            createdCount++;
        }

        revalidatePath("/sourcing/requisitions");
        return { success: true, count: createdCount, message: `Successfully generated ${createdCount} requisitions.` };
    } catch (error) {
        console.error("Auto-reorder failed:", error);
        return { success: false, error: "Failed to process reorders." };
    }
}