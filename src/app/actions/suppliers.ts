'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, supplierPerformanceLogs, documents, rfqSuppliers, type Supplier } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

export async function calculateABCAnalysis() {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        return await TelemetryService.time("SupplierManagement", "ABCAnalysis", async () => {
            const allSuppliers = await db.select().from(suppliers);
            const allOrders = await db.select().from(procurementOrders);

            // ... (keep existing logic) ...
            const spendMap = new Map<string, number>();
            allOrders.forEach(order => {
                const amount = parseFloat(order.totalAmount || "0");
                spendMap.set(order.supplierId, (spendMap.get(order.supplierId) || 0) + amount);
            });

            const sortedSuppliers = allSuppliers
                .map(s => ({ id: s.id, spend: spendMap.get(s.id) || 0 }))
                .sort((a, b) => b.spend - a.spend);

            const totalSpend = Array.from(spendMap.values()).reduce((a, b) => a + b, 0);
            if (totalSpend === 0) return { success: true, message: "No spend data found." };

            return await db.transaction(async (tx) => {
                let cumulativeSpend = 0;
                for (const s of sortedSuppliers) {
                    cumulativeSpend += s.spend;
                    const percentage = (cumulativeSpend / totalSpend) * 100;

                    let classification: 'A' | 'B' | 'C' = 'C';
                    if (percentage <= 70) classification = 'A';
                    else if (percentage <= 90) classification = 'B';

                    await tx.update(suppliers)
                        .set({ abcClassification: classification })
                        .where(eq(suppliers.id, s.id));
                }
                return { success: true };
            });

            await TelemetryService.trackEvent("SupplierManagement", "abc_analysis_completed", { totalSpend });
            revalidatePath("/suppliers");
            return { success: true };
        });
    } catch (error) {
        await TelemetryService.trackError("SupplierManagement", "abc_analysis_failed", error);
        console.error("ABC Analysis failed:", error);
        return { success: false, error: "Analysis failed" };
    }
}

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
    abcClassification?: 'A' | 'B' | 'C' | 'X' | 'Y' | 'Z' | 'None';
    carbonFootprintScope1?: number;
    carbonFootprintScope2?: number;
    carbonFootprintScope3?: number;
    conflictMineralsStatus?: 'compliant' | 'non_compliant' | 'unknown';
    isoCertifications?: string[];
    esgEnvironmentScore?: number;
    esgSocialScore?: number;
    esgGovernanceScore?: number;
    financialHealthRating?: string;
    tierLevel?: 'tier_1' | 'tier_2' | 'tier_3' | 'critical';
    modernSlaveryStatement?: string;
}

export async function updateSupplier(id: string, data: Partial<UpdateSupplierData>) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        await db.update(suppliers)
            .set({
                ...data,
                carbonFootprintScope1: data.carbonFootprintScope1?.toString(),
                carbonFootprintScope2: data.carbonFootprintScope2?.toString(),
                carbonFootprintScope3: data.carbonFootprintScope3?.toString(),
                lastAuditDate: data.performanceScore !== undefined ? new Date() : (data as any).lastAuditDate
            })
            .where(eq(suppliers.id, id));

        if (data.status) await logActivity('UPDATE', 'supplier', id, `Status updated to ${data.status}`);
        if (data.lifecycleStatus) await logActivity('UPDATE', 'supplier', id, `Lifecycle updated to ${data.lifecycleStatus.toUpperCase()}`);
        if (data.performanceScore !== undefined) await logActivity('UPDATE', 'supplier', id, `Performance score updated to ${data.performanceScore}`);

        // Trigger ESG Recalculation if sub-scores are updated
        if (data.esgEnvironmentScore !== undefined || data.esgSocialScore !== undefined || data.esgGovernanceScore !== undefined) {
            await calculateSupplierESG(id);
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
            abcClassification: "None",
            conflictMineralsStatus: "unknown",
            tierLevel: (formData.get("tier") as any) || "tier_3",
            isoCertifications: formData.getAll("iso") as string[],
            esgEnvironmentScore: parseInt(formData.get("esg_env") as string) || 0,
            esgSocialScore: parseInt(formData.get("esg_soc") as string) || 0,
            esgGovernanceScore: parseInt(formData.get("esg_gov") as string) || 0,
            modernSlaveryStatement: formData.get("modern_slavery") === "on" ? "yes" : "no",
        }).returning();

        await logActivity('CREATE', 'supplier', newSupplier.id, `New supplier onboarded: ${name}`);

        // Trigger ESG Recalculation
        await calculateSupplierESG(newSupplier.id);

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to add supplier:", error);
        return { success: false, error: "Failed to add supplier" };
    }
}

export async function getSupplierPerformanceMetrics(supplierId: string) {
    try {
        const [supplierInfo] = await db
            .select({
                performanceScore: suppliers.performanceScore,
                onTimeDeliveryRate: suppliers.onTimeDeliveryRate,
                defectRate: suppliers.defectRate,
                collaborationScore: suppliers.collaborationScore,
                responsivenessScore: suppliers.responsivenessScore,
            })
            .from(suppliers)
            .where(eq(suppliers.id, supplierId))
            .limit(1);

        if (!supplierInfo) return null;

        const logs = await db
            .select()
            .from(supplierPerformanceLogs)
            .where(eq(supplierPerformanceLogs.supplierId, supplierId))
            .orderBy(desc(supplierPerformanceLogs.recordedAt))
            .limit(10);

        return {
            ...supplierInfo,
            performanceLogs: logs
        };
    } catch (error) {
        console.error("Failed to fetch performance metrics:", error);
        return null;
    }
}

/**
 * ESG CALCULATION LOGIC (Point 10 Transparency)
 * Weights: Environment (40%), Social (30%), Governance (30%)
 */
export async function calculateSupplierESG(supplierId: string) {
    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) return null;

        const env = supplier.esgEnvironmentScore || 0;
        const soc = supplier.esgSocialScore || 0;
        const gov = supplier.esgGovernanceScore || 0;

        const totalEsg = Math.round((env * 0.4) + (soc * 0.3) + (gov * 0.3));

        await db.update(suppliers)
            .set({ esgScore: totalEsg })
            .where(eq(suppliers.id, supplierId));

        return totalEsg;
    } catch (error) {
        console.error("ESG Calculation failed:", error);
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
        return await db.transaction(async (tx) => {
            // 1. Record history
            const [log] = await tx.insert(supplierPerformanceLogs).values({
                supplierId: data.supplierId,
                deliveryRate: data.deliveryRate.toString(),
                qualityScore: data.qualityScore.toString(),
                collaborationScore: data.collaborationScore,
                notes: data.notes
            }).returning();

            // 2. Update current snapshots on supplier
            await tx.update(suppliers).set({
                onTimeDeliveryRate: data.deliveryRate.toString(),
                defectRate: (100 - data.qualityScore).toString(),
                collaborationScore: data.collaborationScore,
                performanceScore: Math.round((data.deliveryRate + data.qualityScore + data.collaborationScore) / 3)
            }).where(eq(suppliers.id, data.supplierId));

            await logActivity('CREATE', 'performance_log', log.id, `Manual performance audit recorded for supplier ${data.supplierId}`);

            revalidatePath(`/suppliers/${data.supplierId}`);
            revalidatePath("/suppliers");
            return { success: true };
        });
    } catch (error) {
        console.error("Failed to record performance:", error);
        return { success: false, error: "Failed to save log" };
    }
}

export async function deleteSupplier(id: string) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // 1. Check for blocking dependencies
        const existingOrders = await db.select().from(procurementOrders).where(eq(procurementOrders.supplierId, id)).limit(1);
        if (existingOrders.length > 0) {
            return {
                success: false,
                error: "Cannot delete supplier with existing orders. Please mark as Inactive instead."
            };
        }

        const existingRfqs = await db.select().from(rfqSuppliers).where(eq(rfqSuppliers.supplierId, id)).limit(1);
        if (existingRfqs.length > 0) {
            return {
                success: false,
                error: "Cannot delete supplier involved in active RFQs."
            };
        }

        // 2. Delete Safe Dependencies
        // Delete documents
        await db.delete(documents).where(eq(documents.supplierId, id));
        // Delete performance logs
        await db.delete(supplierPerformanceLogs).where(eq(supplierPerformanceLogs.supplierId, id));

        // 3. Delete Supplier
        const [deleted] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();

        if (deleted) {
            await logActivity('DELETE', 'supplier', id, `Supplier deleted: ${deleted.name}`);
        }

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete supplier:", error);
        return { success: false, error: "Failed to delete supplier" };
    }
}