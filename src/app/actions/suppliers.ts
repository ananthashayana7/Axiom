'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, supplierPerformanceLogs, type Supplier } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";

export async function getSuppliers(): Promise<Supplier[]> {
    const session = await auth();
    if (!session) return [];

    try {
        const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.createdAt);
        return allSuppliers;
    } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
    const session = await auth();
    if (!session) return null;

    // Supplier users can only view themselves
    const userRole = (session.user as any).role;
    const userSupplierId = (session.user as any).supplierId;
    if (userRole === 'supplier' && userSupplierId !== id) return null;

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
    performanceScore?: number;
    esgScore?: number;
    financialScore?: number;
    lifecycleStatus?: 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';
    status?: 'active' | 'inactive' | 'blacklisted';
}

export async function updateSupplier(id: string, data: Partial<UpdateSupplierData>) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        await db.update(suppliers)
            .set({
                ...data,
                lastAuditDate: data.performanceScore !== undefined ? new Date() : undefined
            })
            .where(eq(suppliers.id, id));

        if (data.status) await logActivity('UPDATE', 'supplier', id, `Status updated to ${data.status}`);
        if (data.lifecycleStatus) await logActivity('UPDATE', 'supplier', id, `Lifecycle updated to ${data.lifecycleStatus.toUpperCase()}`);
        if (data.performanceScore !== undefined) await logActivity('UPDATE', 'supplier', id, `Performance score updated to ${data.performanceScore}`);

        revalidatePath(`/suppliers/${id}`);
        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to update supplier:", error);
        return { success: false, error: "Failed to update supplier" };
    }
}

export async function addSupplier(formData: FormData) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const name = formData.get("name") as string;
        const contactEmail = formData.get("email") as string;
        const riskScore = parseInt(formData.get("risk") as string) || 0;
        const esgScore = parseInt(formData.get("esg") as string) || 0;
        const financialScore = parseInt(formData.get("financial") as string) || 0;
        const performanceScore = parseInt(formData.get("performance") as string) || 80;

        const [newSupplier] = await db.insert(suppliers).values({
            name,
            contactEmail,
            riskScore,
            esgScore,
            financialScore,
            performanceScore,
            status: "active",
            lifecycleStatus: "prospect",
        }).returning();

        await logActivity('CREATE', 'supplier', newSupplier.id, `New supplier onboarded: ${name}`);

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to add supplier:", error);
        return { success: false, error: "Failed to add supplier" };
    }
}

export async function getSupplierPerformanceMetrics(supplierId: string) {
    try {
        const metrics = await db.query.suppliers.findFirst({
            where: eq(suppliers.id, supplierId),
            columns: {
                performanceScore: true,
                onTimeDeliveryRate: true,
                defectRate: true,
                collaborationScore: true,
                responsivenessScore: true,
            },
            with: {
                performanceLogs: {
                    orderBy: desc(supplierPerformanceLogs.recordedAt),
                    limit: 10
                }
            }
        });
        return metrics;
    } catch (error) {
        console.error("Failed to fetch performance metrics:", error);
        return null;
    }
}

export async function recordPerformanceLog(data: {
    supplierId: string;
    deliveryRate: number;
    qualityScore: number;
    collaborationScore: number;
    notes?: string;
}) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // 1. Record history
        const [log] = await db.insert(supplierPerformanceLogs).values({
            supplierId: data.supplierId,
            deliveryRate: data.deliveryRate.toString(),
            qualityScore: data.qualityScore.toString(),
            collaborationScore: data.collaborationScore,
            notes: data.notes
        }).returning();

        // 2. Update current snapshots on supplier
        await db.update(suppliers).set({
            onTimeDeliveryRate: data.deliveryRate.toString(),
            defectRate: (100 - data.qualityScore).toString(),
            collaborationScore: data.collaborationScore,
            performanceScore: Math.round((data.deliveryRate + data.qualityScore + data.collaborationScore) / 3)
        }).where(eq(suppliers.id, data.supplierId));

        await logActivity('CREATE', 'performance_log', log.id, `Manual performance audit recorded for supplier ${data.supplierId}`);

        revalidatePath(`/suppliers/${data.supplierId}`);
        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to record performance:", error);
        return { success: false, error: "Failed to save log" };
    }
}