'use server'

import { db } from "@/db";
import { suppliers, auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";

export async function getRiskComplianceStats() {
    const session = await auth();
    if (!session) return null;

    try {
        const allSuppliers = await db.select().from(suppliers);

        // MCDA (Multi-Criteria Decision Analysis) weighting
        // Risk = (0.4 * Operational) + (0.3 * Financial) + (0.3 * ESG)

        const stats = {
            totalSuppliers: allSuppliers.length,
            avgRisk: Math.round(allSuppliers.reduce((acc, s) => acc + (s.riskScore || 0), 0) / allSuppliers.length) || 0,
            highRiskCount: allSuppliers.filter(s => (s.riskScore || 0) > 60).length,
            esgAvg: Math.round(allSuppliers.reduce((acc, s) => acc + (s.esgScore || 0), 0) / allSuppliers.length) || 0,
            isoComplianceRate: Math.round((allSuppliers.filter(s => (s.isoCertifications?.length || 0) > 0).length / allSuppliers.length) * 100) || 0,

            // ESG Breakdown
            avgEnv: Math.round(allSuppliers.reduce((acc, s) => acc + (s.esgEnvironmentScore || 0), 0) / allSuppliers.length) || 0,
            avgSoc: Math.round(allSuppliers.reduce((acc, s) => acc + (s.esgSocialScore || 0), 0) / allSuppliers.length) || 0,
            avgGov: Math.round(allSuppliers.reduce((acc, s) => acc + (s.esgGovernanceScore || 0), 0) / allSuppliers.length) || 0,

            tiers: {
                tier_1: allSuppliers.filter(s => s.tierLevel === 'tier_1' || s.tierLevel === 'critical').length,
                tier_2: allSuppliers.filter(s => s.tierLevel === 'tier_2').length,
                tier_3: allSuppliers.filter(s => s.tierLevel === 'tier_3' || !s.tierLevel).length,
            },

            // Map Data
            locations: allSuppliers
                .filter(s => s.latitude && s.longitude)
                .map(s => ({
                    id: s.id,
                    name: s.name,
                    lat: Number(s.latitude),
                    lng: Number(s.longitude),
                    riskScore: s.riskScore || 0,
                    city: s.city,
                    country: s.countryCode
                }))
        };

        return stats;
    } catch (error) {
        console.error("Risk stats fetch failed:", error);
        return null;
    }
}

export type MitigationPlanType = 'secondary_source' | 'audit_request' | 'stockpile' | 'suspend';

export async function mitigateRisk(supplierId: string, plan: MitigationPlanType, reason: string) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        // In a real app, this might trigger a workflow or emails
        // Here we just log it for audit/compliance
        await db.update(suppliers)
            .set({
                lifecycleStatus: plan === 'suspend' ? 'suspended' : 'onboarding',
                lastRiskAudit: new Date()
            })
            .where(eq(suppliers.id, supplierId));

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: 'MITIGATE',
            entityType: 'supplier',
            entityId: supplierId,
            details: `Risk mitigation plan [${plan.toUpperCase()}] activated. Reason: ${reason}`
        });

        return {
            success: true,
            message: `Mitigation plan [${plan.toUpperCase()}] active. Audit trail recorded.`
        };
    } catch (error) {
        console.error("Mitigation activation failed:", error);
        return { success: false, error: "System failure during mitigation activation" };
    }
}

/**
 * Returns the supplier rows needed by the Risk Dashboard page.
 * Replaces the direct `db.select().from(suppliers)` that was in the page file.
 */
export async function getSupplierRiskProfiles() {
    const session = await auth();
    if (!session?.user?.id) return [];
    const role = session.user.role;
    if (role !== 'admin' && role !== 'user') return [];

    try {
        return await db.select({
            id: suppliers.id,
            name: suppliers.name,
            riskScore: suppliers.riskScore,
            esgScore: suppliers.esgScore,
            financialScore: suppliers.financialScore,
            latitude: suppliers.latitude,
            longitude: suppliers.longitude,
            countryCode: suppliers.countryCode,
        }).from(suppliers);
    } catch {
        return [];
    }
}

/**
 * Returns all supplier ESG / carbon data needed by the Sustainability page.
 * Replaces the direct `db.select().from(suppliers)` in that page file.
 */
export async function getSustainabilityData() {
    const session = await auth();
    if (!session?.user?.id) return [];
    const role = session.user.role;
    if (role === 'supplier') return [];

    try {
        return await db.select().from(suppliers).orderBy(desc(suppliers.esgScore));
    } catch {
        return [];
    }
}
