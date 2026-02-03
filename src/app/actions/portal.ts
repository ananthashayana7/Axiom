'use server'

import { db } from "@/db";
import { rfqSuppliers, rfqs, procurementOrders, rfqItems, parts, documents, suppliers, orderItems } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function getSupplierStats() {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;

    if (!supplierId) return null;

    try {
        const invitedRFQsCount = await db.select({ count: sql`count(*)` })
            .from(rfqSuppliers)
            .where(and(eq(rfqSuppliers.supplierId, supplierId), eq(rfqSuppliers.status, 'invited')));

        const activeOrdersCount = await db.select({ count: sql`count(*)` })
            .from(procurementOrders)
            .where(and(eq(procurementOrders.supplierId, supplierId), eq(procurementOrders.status, 'sent')));

        return {
            invitedRFQs: Number((invitedRFQsCount[0] as any)?.count || 0),
            activeOrders: Number((activeOrdersCount[0] as any)?.count || 0),
        };
    } catch (error) {
        console.error("Portal stats error:", error);
        return null;
    }
}



export async function getSupplierRFQs() {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;

    if (!supplierId) return [];

    try {
        const vendorRfqs = await db.select({
            id: rfqs.id,
            title: rfqs.title,
            status: rfqSuppliers.status,
            createdAt: rfqs.createdAt,
            rfqId: rfqs.id
        })
            .from(rfqSuppliers)
            .innerJoin(rfqs, eq(rfqSuppliers.rfqId, rfqs.id))
            .where(eq(rfqSuppliers.supplierId, supplierId))
            .orderBy(desc(rfqs.createdAt));

        return vendorRfqs;
    } catch (error) {
        console.error("Portal RFQs error:", error);
        return [];
    }
}

export async function getSupplierOrders() {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;

    if (!supplierId) return [];

    try {
        const orders = await db.select({
            id: procurementOrders.id,
            status: procurementOrders.status,
            totalAmount: procurementOrders.totalAmount,
            createdAt: procurementOrders.createdAt,
        })
            .from(procurementOrders)
            .where(eq(procurementOrders.supplierId, supplierId))
            .orderBy(desc(procurementOrders.createdAt));

        const orderIds = orders.map(o => o.id);

        if (orderIds.length === 0) return [];

        const allItemsRaw = await db.select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            partName: parts.name,
            partSku: parts.sku
        })
            .from(orderItems)
            .leftJoin(parts, eq(orderItems.partId, parts.id))
            .where(sql`${orderItems.orderId} IN ${orderIds}`);

        const allItems = allItemsRaw.map(i => ({
            ...i,
            part: { name: i.partName, sku: i.partSku }
        }));

        return orders.map(order => ({
            ...order,
            items: allItems.filter(item => item.orderId === order.id)
        }));
    } catch (error) {
        console.error("Portal Orders error:", error);
        return [];
    }
}

export async function getSupplierDocuments() {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;

    if (!supplierId) return [];

    try {
        const vendorDocs = await db.select()
            .from(documents)
            .where(eq(documents.supplierId, supplierId))
            .orderBy(desc(documents.createdAt));

        return vendorDocs;
    } catch (error) {
        console.error("Portal Docs error:", error);
        return [];
    }
}

export async function uploadSupplierDocument(formData: FormData) {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;

    if (!supplierId) throw new Error("Unauthorized");

    const name = formData.get('name') as string;
    const type = formData.get('type') as any;

    try {
        await db.insert(documents).values({
            supplierId,
            name,
            type,
            url: `https://storage.example.com/axiom/${supplierId}/${Date.now()}_${name.replace(/\s+/g, '_')}`,
        });

        await logActivity('UPLOAD', 'document', supplierId, `Supplier uploaded a new ${type} document: ${name}`);

        revalidatePath('/portal/documents');
        return { success: true };
    } catch (error) {
        console.error("Upload error:", error);
        return { success: false, error: "Failed to save document record." };
    }
}
export async function getSupplierProfile() {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;
    if (!supplierId) return null;

    try {
        const [profile] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        return profile;
    } catch (error) {
        console.error("Profile fetch error:", error);
        return null;
    }
}

export async function updateSupplierProfile(formData: FormData) {
    const session = await auth();
    const supplierId = (session?.user as any)?.supplierId;
    if (!supplierId) return { success: false, error: "Unauthorized" };

    const contactEmail = formData.get('contactEmail') as string;
    const city = formData.get('city') as string;

    try {
        await db.update(suppliers).set({
            contactEmail,
            city,
            updatedAt: new Date()
        }).where(eq(suppliers.id, supplierId));

        await logActivity('UPDATE', 'supplier', supplierId, `Supplier updated their profile contact info.`);

        revalidatePath('/portal/profile');
        return { success: true };
    } catch (error) {
        console.error("Profile update error:", error);
        return { success: false, error: "Failed to update profile." };
    }
}
