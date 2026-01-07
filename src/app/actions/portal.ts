'use server'

import { db } from "@/db";
import { rfqSuppliers, rfqs, procurementOrders, rfqItems, parts, documents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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

import { sql } from "drizzle-orm";

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
        const vendorOrders = await db.query.procurementOrders.findMany({
            where: eq(procurementOrders.supplierId, supplierId),
            with: {
                items: {
                    with: {
                        part: true
                    }
                }
            },
            orderBy: [desc(procurementOrders.createdAt)]
        });

        return vendorOrders;
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
