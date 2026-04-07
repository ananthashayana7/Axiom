'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "@/db";
import { approvalPolicies, matchingTolerances, suppliers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// APPROVAL POLICIES & MATCHING TOLERANCES - Enterprise governance
// ============================================================================

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    if (session.user.role !== 'admin') throw new Error('Admin access required');
    return session.user;
}

// ── Approval Policies ──

type PolicyConditions = Record<string, string | number | boolean | string[]>;

export async function createApprovalPolicy(data: {
    name: string;
    description?: string;
    entityType: string;
    policyType: 'amount' | 'category' | 'supplier_risk' | 'contract_coverage' | 'combined';
    conditions: PolicyConditions;
    approverIds?: string[];
    approverRole?: string;
    escalationTimeoutHours?: number;
    priority?: number;
}) {
    await requireAdmin();

    const [policy] = await db.insert(approvalPolicies).values({
        name: data.name,
        description: data.description,
        entityType: data.entityType,
        policyType: data.policyType,
        conditions: JSON.stringify(data.conditions),
        approverIds: data.approverIds,
        approverRole: data.approverRole,
        escalationTimeoutHours: data.escalationTimeoutHours || 48,
        priority: data.priority || 0,
    }).returning();

    revalidatePath('/admin/settings');
    return policy;
}

export async function getApprovalPolicies(entityType?: string) {
    await requireAdmin();

    const conditions = [eq(approvalPolicies.isActive, 'yes')];
    if (entityType) conditions.push(eq(approvalPolicies.entityType, entityType));

    const policies = await db.select()
        .from(approvalPolicies)
        .where(and(...conditions))
        .orderBy(desc(approvalPolicies.priority));

    return policies.map(p => ({
        ...p,
        conditions: p.conditions ? JSON.parse(p.conditions) : {},
    }));
}

export async function evaluateApprovalPolicy(entityType: string, context: {
    amount?: number;
    category?: string;
    supplierRiskScore?: number;
    hasContract?: boolean;
}) {
    const policies = await db.select()
        .from(approvalPolicies)
        .where(and(
            eq(approvalPolicies.entityType, entityType),
            eq(approvalPolicies.isActive, 'yes')
        ))
        .orderBy(desc(approvalPolicies.priority));

    for (const policy of policies) {
        const conditions = policy.conditions ? JSON.parse(policy.conditions) : {};
        let matches = true;

        if (conditions.minAmount !== undefined && context.amount !== undefined) {
            if (context.amount < conditions.minAmount) matches = false;
        }
        if (conditions.maxAmount !== undefined && context.amount !== undefined) {
            if (context.amount > conditions.maxAmount) matches = false;
        }
        if (conditions.categories && context.category) {
            if (!conditions.categories.includes(context.category)) matches = false;
        }
        if (conditions.riskThreshold !== undefined && context.supplierRiskScore !== undefined) {
            if (context.supplierRiskScore < conditions.riskThreshold) matches = false;
        }
        if (conditions.requireContract !== undefined && context.hasContract !== undefined) {
            if (conditions.requireContract && !context.hasContract) matches = false;
        }

        if (matches) {
            return {
                policyId: policy.id,
                policyName: policy.name,
                approverIds: policy.approverIds,
                approverRole: policy.approverRole,
                escalationTimeoutHours: policy.escalationTimeoutHours,
            };
        }
    }

    // Default fallback: require admin approval
    return {
        policyId: null,
        policyName: 'Default Admin Approval',
        approverIds: null,
        approverRole: 'admin',
        escalationTimeoutHours: 48,
    };
}

export async function updateApprovalPolicy(policyId: string, data: Partial<{
    name: string;
    description: string;
    conditions: PolicyConditions;
    approverIds: string[];
    approverRole: string;
    escalationTimeoutHours: number;
    isActive: string;
    priority: number;
}>) {
    await requireAdmin();

    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.conditions) updateData.conditions = JSON.stringify(data.conditions);

    const [updated] = await db.update(approvalPolicies)
        .set(updateData)
        .where(eq(approvalPolicies.id, policyId))
        .returning();

    revalidatePath('/admin/settings');
    return updated;
}

// ── Matching Tolerances ──

export async function createMatchingTolerance(data: {
    name: string;
    description?: string;
    category?: string;
    supplierId?: string;
    priceTolerancePercent?: number;
    quantityTolerancePercent?: number;
    allowPartialDelivery?: string;
    exceptionReasons?: string[];
}) {
    await requireAdmin();

    const [tolerance] = await db.insert(matchingTolerances).values({
        name: data.name,
        description: data.description,
        category: data.category,
        supplierId: data.supplierId,
        priceTolerancePercent: data.priceTolerancePercent ? String(data.priceTolerancePercent) : '2.00',
        quantityTolerancePercent: data.quantityTolerancePercent ? String(data.quantityTolerancePercent) : '5.00',
        allowPartialDelivery: data.allowPartialDelivery || 'yes',
        exceptionReasons: data.exceptionReasons ? JSON.stringify(data.exceptionReasons) : null,
    }).returning();

    revalidatePath('/admin/settings');
    return tolerance;
}

export async function getMatchingTolerances() {
    await requireAdmin();

    const tolerances = await db.select({
        id: matchingTolerances.id,
        name: matchingTolerances.name,
        description: matchingTolerances.description,
        category: matchingTolerances.category,
        supplierId: matchingTolerances.supplierId,
        supplierName: suppliers.name,
        priceTolerancePercent: matchingTolerances.priceTolerancePercent,
        quantityTolerancePercent: matchingTolerances.quantityTolerancePercent,
        allowPartialDelivery: matchingTolerances.allowPartialDelivery,
        exceptionReasons: matchingTolerances.exceptionReasons,
        isActive: matchingTolerances.isActive,
        createdAt: matchingTolerances.createdAt,
    }).from(matchingTolerances)
      .leftJoin(suppliers, eq(matchingTolerances.supplierId, suppliers.id))
      .where(eq(matchingTolerances.isActive, 'yes'))
      .orderBy(desc(matchingTolerances.createdAt));

    return tolerances;
}

export async function getToleranceForContext(category?: string, supplierId?: string) {
    // Find most specific tolerance: supplier-specific > category > global
    const tolerances = await db.select()
        .from(matchingTolerances)
        .where(eq(matchingTolerances.isActive, 'yes'));

    // Priority: supplier+category > supplier > category > global
    let best = null;
    let bestScore = -1;

    for (const t of tolerances) {
        let score = 0;
        if (t.supplierId && t.supplierId === supplierId) score += 2;
        else if (t.supplierId && t.supplierId !== supplierId) continue;
        if (t.category && t.category === category) score += 1;
        else if (t.category && t.category !== category) continue;
        if (score > bestScore) {
            best = t;
            bestScore = score;
        }
    }

    if (best) {
        return {
            priceTolerancePercent: Number(best.priceTolerancePercent),
            quantityTolerancePercent: Number(best.quantityTolerancePercent),
            allowPartialDelivery: best.allowPartialDelivery === 'yes',
            exceptionReasons: best.exceptionReasons ? JSON.parse(best.exceptionReasons) : [],
        };
    }

    // Default tolerances
    return {
        priceTolerancePercent: 2.0,
        quantityTolerancePercent: 5.0,
        allowPartialDelivery: true,
        exceptionReasons: [],
    };
}
