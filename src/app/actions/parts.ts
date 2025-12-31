'use server'

import { db } from "@/db";
import { parts } from "@/db/schema";
import { revalidatePath } from "next/cache";

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
