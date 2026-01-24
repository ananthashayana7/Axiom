'use server'

import { db } from "@/db";
import { parts, orderItems, rfqItems, type Part } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { logActivity } from "./activity";

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

        const [newPart] = await db.insert(parts).values({
            name,
            sku,
            category,
            stockLevel,
            price,
            marketTrend,
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

        await db.update(parts)
            .set({
                name,
                sku,
                category,
                stockLevel,
                price,
                marketTrend,
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