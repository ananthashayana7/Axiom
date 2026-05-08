'use server'

import { db } from "@/db";
import { rfqSuppliers, rfqs, procurementOrders, parts, documents, suppliers, orderItems, supplierRequests } from "@/db/schema";
import { eq, and, desc, sql, inArray, gte, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { storeUploadedFile } from "@/lib/file-storage";

function parseCommaSeparatedValues(value: FormDataEntryValue | null) {
    return String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}

export async function getSupplierStats() {
    const session = await auth();
    const supplierId = session?.user?.supplierId;

    if (!supplierId) return null;

    try {
        const invitedRFQsCount = await db.select({ count: sql`count(*)` })
            .from(rfqSuppliers)
            .where(and(eq(rfqSuppliers.supplierId, supplierId), eq(rfqSuppliers.status, 'invited')));

        const activeOrdersCount = await db.select({ count: sql`count(*)` })
            .from(procurementOrders)
            .where(and(
                eq(procurementOrders.supplierId, supplierId),
                inArray(procurementOrders.status, ['approved', 'sent']),
            ));

        return {
            invitedRFQs: Number(invitedRFQsCount[0]?.count || 0),
            activeOrders: Number(activeOrdersCount[0]?.count || 0),
        };
    } catch (error) {
        console.error("Portal stats error:", error);
        return null;
    }
}



export async function getSupplierRFQs() {
    const session = await auth();
    const supplierId = session?.user?.supplierId;

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
    const supplierId = session?.user?.supplierId;

    if (!supplierId) return [];

    try {
        const orders = await db.select({
            id: procurementOrders.id,
            status: procurementOrders.status,
            totalAmount: procurementOrders.totalAmount,
            createdAt: procurementOrders.createdAt,
            estimatedArrival: procurementOrders.estimatedArrival,
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
            .where(inArray(orderItems.orderId, orderIds));

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
    const supplierId = session?.user?.supplierId;

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
    const supplierId = session?.user?.supplierId;

    if (!supplierId) throw new Error("Unauthorized");

    const name = String(formData.get('name') || '').trim();
    const type = String(formData.get('type') || 'other');
    const file = formData.get('file');

    if (!name) {
        return { success: false, error: "Document name is required." };
    }

    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: "Select a document file before uploading." };
    }

    try {
        const stored = await storeUploadedFile(file);

        await db.insert(documents).values({
            supplierId,
            name,
            type,
            url: stored.url,
        });

        await logActivity('UPLOAD', 'document', supplierId, `Supplier uploaded a new ${type} document: ${name}`);

        revalidatePath('/portal/documents');
        return { success: true };
    } catch (error) {
        console.error("Upload error:", error);
        return { success: false, error: "Failed to save document record." };
    }
}

export async function getSupplierDashboardSnapshot() {
    const session = await auth();
    const supplierId = session?.user?.supplierId;

    if (!supplierId) return null;

    try {
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const [
            invitedRFQsCount,
            activeOrdersCount,
            dueThisWeekOrdersCount,
            openRequestsCount,
            overdueRequestsCount,
            documentCountRows,
            recentRfqs,
            recentOrders,
            recentDocuments,
            recentRequests,
        ] = await Promise.all([
            db.select({ count: sql<number>`count(*)::int` })
                .from(rfqSuppliers)
                .where(and(
                    eq(rfqSuppliers.supplierId, supplierId),
                    eq(rfqSuppliers.status, 'invited'),
                )),
            db.select({ count: sql<number>`count(*)::int` })
                .from(procurementOrders)
                .where(and(
                    eq(procurementOrders.supplierId, supplierId),
                    inArray(procurementOrders.status, ['approved', 'sent']),
                )),
            db.select({ count: sql<number>`count(*)::int` })
                .from(procurementOrders)
                .where(and(
                    eq(procurementOrders.supplierId, supplierId),
                    inArray(procurementOrders.status, ['approved', 'sent']),
                    gte(procurementOrders.estimatedArrival, now),
                    lte(procurementOrders.estimatedArrival, weekEnd),
                )),
            db.select({ count: sql<number>`count(*)::int` })
                .from(supplierRequests)
                .where(and(
                    eq(supplierRequests.supplierId, supplierId),
                    inArray(supplierRequests.status, ['draft', 'sent', 'acknowledged', 'in_progress', 'overdue']),
                )),
            db.select({ count: sql<number>`count(*)::int` })
                .from(supplierRequests)
                .where(and(
                    eq(supplierRequests.supplierId, supplierId),
                    lte(supplierRequests.dueDate, now),
                    inArray(supplierRequests.status, ['draft', 'sent', 'acknowledged', 'in_progress', 'overdue']),
                )),
            db.select({ count: sql<number>`count(*)::int` })
                .from(documents)
                .where(eq(documents.supplierId, supplierId)),
            db.select({
                id: rfqs.id,
                title: rfqs.title,
                status: rfqSuppliers.status,
                createdAt: rfqs.createdAt,
            })
                .from(rfqSuppliers)
                .innerJoin(rfqs, eq(rfqSuppliers.rfqId, rfqs.id))
                .where(eq(rfqSuppliers.supplierId, supplierId))
                .orderBy(desc(rfqs.createdAt))
                .limit(5),
            db.select({
                id: procurementOrders.id,
                status: procurementOrders.status,
                totalAmount: procurementOrders.totalAmount,
                createdAt: procurementOrders.createdAt,
                estimatedArrival: procurementOrders.estimatedArrival,
            })
                .from(procurementOrders)
                .where(eq(procurementOrders.supplierId, supplierId))
                .orderBy(desc(procurementOrders.createdAt))
                .limit(5),
            db.select({
                id: documents.id,
                name: documents.name,
                type: documents.type,
                url: documents.url,
                createdAt: documents.createdAt,
            })
                .from(documents)
                .where(eq(documents.supplierId, supplierId))
                .orderBy(desc(documents.createdAt))
                .limit(3),
            db.select({
                id: supplierRequests.id,
                title: supplierRequests.title,
                requestType: supplierRequests.requestType,
                status: supplierRequests.status,
                dueDate: supplierRequests.dueDate,
                createdAt: supplierRequests.createdAt,
            })
                .from(supplierRequests)
                .where(eq(supplierRequests.supplierId, supplierId))
                .orderBy(desc(supplierRequests.createdAt))
                .limit(5),
        ]);

        const invitedRFQs = Number(invitedRFQsCount[0]?.count || 0);
        const activeOrders = Number(activeOrdersCount[0]?.count || 0);
        const dueThisWeekOrders = Number(dueThisWeekOrdersCount[0]?.count || 0);
        const openRequests = Number(openRequestsCount[0]?.count || 0);
        const overdueRequests = Number(overdueRequestsCount[0]?.count || 0);
        const documentCount = Number(documentCountRows[0]?.count || 0);
        const healthStatus = overdueRequests > 0
            ? 'attention'
            : (openRequests > 0 || invitedRFQs > 0 || dueThisWeekOrders > 0)
                ? 'watch'
                : 'healthy';

        return {
            counts: {
                invitedRFQs,
                activeOrders,
                dueThisWeekOrders,
                openRequests,
                overdueRequests,
                documentCount,
            },
            recentRfqs,
            recentOrders,
            recentDocuments,
            recentRequests,
            healthStatus,
        };
    } catch (error) {
        console.error("Portal dashboard snapshot error:", error);
        return null;
    }
}

export async function deleteSupplierDocument(documentId: string) {
    const session = await auth();
    const supplierId = session?.user?.supplierId;

    if (!supplierId) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [existing] = await db.select({
            id: documents.id,
            supplierId: documents.supplierId,
            name: documents.name,
        }).from(documents)
            .where(and(
                eq(documents.id, documentId),
                eq(documents.supplierId, supplierId),
            ))
            .limit(1);

        if (!existing) {
            return { success: false, error: "Document not found." };
        }

        await db.delete(documents).where(eq(documents.id, documentId));
        await logActivity('DELETE', 'document', documentId, `Supplier removed document: ${existing.name}`);
        revalidatePath('/portal/documents');
        return { success: true };
    } catch (error) {
        console.error("Delete document error:", error);
        return { success: false, error: "Failed to remove document." };
    }
}
export async function getSupplierProfile() {
    const session = await auth();
    const supplierId = session?.user?.supplierId;
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
    const supplierId = session?.user?.supplierId;
    if (!supplierId) return { success: false, error: "Unauthorized" };

    const contactEmail = formData.get('contactEmail') as string;
    const city = formData.get('city') as string;
    const rawCountryCode = String(formData.get('countryCode') || '').trim().toUpperCase();
    const categories = parseCommaSeparatedValues(formData.get('categoriesCsv'));
    const isoCertifications = Array.from(new Set([
        ...formData.getAll('iso').map((value) => String(value).trim()).filter(Boolean),
        ...parseCommaSeparatedValues(formData.get('customCertifications')),
    ]));
    const financialHealthRating = String(formData.get('financialHealthRating') || '').trim() || null;
    const conflictMineralsStatus = String(formData.get('conflictMineralsStatus') || 'unknown') as 'compliant' | 'non_compliant' | 'unknown';
    const modernSlaveryStatement = formData.get('modernSlaveryStatement') === 'yes' ? 'yes' : 'no';
    const isConflictMineralCompliant = formData.get('isConflictMineralCompliant') === 'yes' ? 'yes' : 'no';
    const renewableEnergyShare = Math.min(100, Math.max(0, Number(formData.get('renewableEnergyShare') || 0)));
    const carbonFootprintScope1 = String(formData.get('carbonFootprintScope1') || '').trim();
    const carbonFootprintScope2 = String(formData.get('carbonFootprintScope2') || '').trim();
    const carbonFootprintScope3 = String(formData.get('carbonFootprintScope3') || '').trim();

    if (rawCountryCode && !/^[A-Z]{2}$/.test(rawCountryCode)) {
        return { success: false, error: "Country code must be a valid 2-letter ISO code." };
    }

    try {
        const [currentSupplier] = await db.select({
            esgSocialScore: suppliers.esgSocialScore,
            esgGovernanceScore: suppliers.esgGovernanceScore,
        }).from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);

        const socialScore = currentSupplier?.esgSocialScore || 0;
        const governanceScore = currentSupplier?.esgGovernanceScore || 0;
        const calculatedEsgScore = Math.round((renewableEnergyShare * 0.4) + (socialScore * 0.3) + (governanceScore * 0.3));

        await db.update(suppliers).set({
            contactEmail,
            city,
            countryCode: rawCountryCode || null,
            categories,
            isoCertifications,
            financialHealthRating,
            conflictMineralsStatus,
            modernSlaveryStatement,
            isConflictMineralCompliant,
            esgEnvironmentScore: renewableEnergyShare,
            esgScore: calculatedEsgScore,
            carbonFootprintScope1: carbonFootprintScope1 || '0',
            carbonFootprintScope2: carbonFootprintScope2 || '0',
            carbonFootprintScope3: carbonFootprintScope3 || '0',
            updatedAt: new Date()
        }).where(eq(suppliers.id, supplierId));

        await logActivity('UPDATE', 'supplier', supplierId, `Supplier updated their portal profile, certifications, and sustainability declarations.`);

        revalidatePath('/portal/profile');
        revalidatePath('/suppliers');
        revalidatePath(`/suppliers/${supplierId}`);
        return { success: true };
    } catch (error) {
        console.error("Profile update error:", error);
        return { success: false, error: "Failed to update profile." };
    }
}
