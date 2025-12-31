'use server'

import { db } from "@/db";
import { suppliers, procurementOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function getSuppliers() {
    try {
        const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.createdAt);
        return allSuppliers;
    } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getSupplierById(id: string) {
    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
        return supplier || null;
    } catch (error) {
        console.error("Failed to fetch supplier:", error);
        return null;
    }
}

export async function getSupplierOrders(supplierId: string) {
    try {
        const orders = await db.select().from(procurementOrders).where(eq(procurementOrders.supplierId, supplierId));
        return orders;
    } catch (error) {
        console.error("Failed to fetch supplier orders:", error);
        return [];
    }
}

interface UpdateSupplierData {
    name?: string;
    contactEmail?: string;
    riskScore?: number;
    status?: 'active' | 'inactive' | 'blacklisted';
}

export async function updateSupplier(id: string, data: UpdateSupplierData) {
    try {
        await db.update(suppliers)
            .set({ status: data.status })
            .where(eq(suppliers.id, id));

        if (data.status) {
            await logActivity('UPDATE', 'supplier', id, `Status updated to ${data.status}`);
        }

        revalidatePath(`/suppliers/${id}`);
        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to update supplier:", error);
        return { success: false, error: "Failed to update supplier" };
    }
}

export async function addSupplier(formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const contactEmail = formData.get("email") as string;
        const riskScore = parseInt(formData.get("risk") as string) || 0;

        await db.insert(suppliers).values({
            name,
            contactEmail,
            riskScore,
            status: "active",
        });

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to add supplier:", error);
        return { success: false, error: "Failed to add supplier" };
    }
}
