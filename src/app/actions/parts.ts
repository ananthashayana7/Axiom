'use server'

import { db } from "@/db";
import { parts } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

export async function getParts() {
    try {
        const allParts = await db.select().from(parts).orderBy(parts.createdAt);
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

        await db.insert(parts).values({
            name,
            sku,
            category,
            stockLevel,
        });


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

        await db.update(parts)
            .set({
                name,
                sku,
                category,
                stockLevel,
            })
            .where(eq(parts.id, id));

        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update part:", error);
        return { success: false, error: "Failed to update part" };
    }
}

export async function deletePart(id: string) {
    try {
        await db.delete(parts).where(eq(parts.id, id));
        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete part:", error);
        return { success: false, error: "Failed to delete part" };
    }
}
