'use server';

import { db } from "@/db";
import { complianceObligations, supplierRequests, suppliers, users, notifications, workflowTasks } from "@/db/schema";
import { eq, and, desc, asc, lte, gte, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// COMPLIANCE INTELLIGENCE - Deadline-driven compliance management
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

export async function createComplianceObligation(data: {
    title: string;
    description?: string;
    supplierId?: string;
    contractId?: string;
    category: string;
    ownerId?: string;
    documentRequired?: string;
    expiresAt?: Date;
    reminderDaysBefore?: number;
    policyPack?: string;
    region?: string;
}) {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const [obligation] = await db.insert(complianceObligations).values({
        title: data.title,
        description: data.description,
        supplierId: data.supplierId,
        contractId: data.contractId,
        category: data.category,
        ownerId: data.ownerId,
        documentRequired: data.documentRequired || 'yes',
        expiresAt: data.expiresAt,
        reminderDaysBefore: data.reminderDaysBefore || 30,
        policyPack: data.policyPack,
        region: data.region,
    }).returning();

    // Auto-create a workflow task for the owner
    if (data.ownerId) {
        await db.insert(workflowTasks).values({
            title: `Review compliance: ${data.title}`,
            description: `Ensure compliance obligation is met${data.expiresAt ? ` before ${data.expiresAt.toISOString().split('T')[0]}` : ''}`,
            entityType: 'compliance_obligation',
            entityId: obligation.id,
            priority: 'high',
            assigneeId: data.ownerId,
            createdById: user.id as string,
            dueDate: data.expiresAt,
        });
    }

    // Create supplier request if supplier-specific
    if (data.supplierId && data.documentRequired === 'yes') {
        await db.insert(supplierRequests).values({
            supplierId: data.supplierId,
            requestType: 'compliance_attestation',
            title: `Submit evidence: ${data.title}`,
            description: data.description || `Please submit the required compliance documentation for: ${data.title}`,
            status: 'sent',
            dueDate: data.expiresAt,
            linkedObligationId: obligation.id,
            createdById: user.id as string,
        });
    }

    revalidatePath('/admin/compliance');
    return obligation;
}

export async function getComplianceObligations(filters?: {
    status?: string;
    category?: string;
    supplierId?: string;
    policyPack?: string;
}) {
    await requireAuth();

    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(complianceObligations.status, filters.status as any));
    if (filters?.category) conditions.push(eq(complianceObligations.category, filters.category));
    if (filters?.supplierId) conditions.push(eq(complianceObligations.supplierId, filters.supplierId));
    if (filters?.policyPack) conditions.push(eq(complianceObligations.policyPack, filters.policyPack));

    const obligations = await db.select({
        id: complianceObligations.id,
        title: complianceObligations.title,
        description: complianceObligations.description,
        category: complianceObligations.category,
        status: complianceObligations.status,
        supplierId: complianceObligations.supplierId,
        supplierName: suppliers.name,
        ownerId: complianceObligations.ownerId,
        ownerName: users.name,
        documentRequired: complianceObligations.documentRequired,
        documentUrl: complianceObligations.documentUrl,
        evidenceSubmittedAt: complianceObligations.evidenceSubmittedAt,
        expiresAt: complianceObligations.expiresAt,
        policyPack: complianceObligations.policyPack,
        region: complianceObligations.region,
        createdAt: complianceObligations.createdAt,
    }).from(complianceObligations)
      .leftJoin(suppliers, eq(complianceObligations.supplierId, suppliers.id))
      .leftJoin(users, eq(complianceObligations.ownerId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(complianceObligations.expiresAt));

    return obligations;
}

export async function getComplianceDashboard() {
    await requireAuth();

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiringCount] = await db.select({
        count: sql<number>`count(*)::int`,
    }).from(complianceObligations)
      .where(and(
          lte(complianceObligations.expiresAt, thirtyDaysFromNow),
          gte(complianceObligations.expiresAt, now),
          eq(complianceObligations.status, 'active')
      ));

    const [expiredCount] = await db.select({
        count: sql<number>`count(*)::int`,
    }).from(complianceObligations)
      .where(and(
          lte(complianceObligations.expiresAt, now),
          inArray(complianceObligations.status, ['active', 'expiring_soon'])
      ));

    const [missingEvidenceCount] = await db.select({
        count: sql<number>`count(*)::int`,
    }).from(complianceObligations)
      .where(and(
          eq(complianceObligations.documentRequired, 'yes'),
          sql`${complianceObligations.documentUrl} IS NULL`,
          inArray(complianceObligations.status, ['active', 'expiring_soon'])
      ));

    const byCategory = await db.select({
        category: complianceObligations.category,
        total: sql<number>`count(*)::int`,
        compliant: sql<number>`count(*) filter (where ${complianceObligations.documentUrl} is not null)::int`,
    }).from(complianceObligations)
      .where(inArray(complianceObligations.status, ['active', 'expiring_soon']))
      .groupBy(complianceObligations.category);

    const byPolicyPack = await db.select({
        policyPack: complianceObligations.policyPack,
        total: sql<number>`count(*)::int`,
    }).from(complianceObligations)
      .where(sql`${complianceObligations.policyPack} IS NOT NULL`)
      .groupBy(complianceObligations.policyPack);

    return {
        expiringSoon: expiringCount?.count || 0,
        expired: expiredCount?.count || 0,
        missingEvidence: missingEvidenceCount?.count || 0,
        byCategory,
        byPolicyPack,
    };
}

export async function updateComplianceStatus(obligationId: string, status: 'active' | 'expiring_soon' | 'expired' | 'waived' | 'not_applicable') {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(complianceObligations)
        .set({ status, updatedAt: new Date() })
        .where(eq(complianceObligations.id, obligationId))
        .returning();

    revalidatePath('/admin/compliance');
    return updated;
}

export async function submitComplianceEvidence(obligationId: string, documentUrl: string) {
    const user = await requireAuth();

    const [updated] = await db.update(complianceObligations)
        .set({
            documentUrl,
            evidenceSubmittedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(complianceObligations.id, obligationId))
        .returning();

    // Notify obligation owner
    if (updated.ownerId) {
        await db.insert(notifications).values({
            userId: updated.ownerId,
            title: 'Compliance Evidence Submitted',
            message: `Evidence submitted for: ${updated.title}`,
            type: 'success',
            link: `/admin/compliance`,
        });
    }

    revalidatePath('/admin/compliance');
    revalidatePath('/portal');
    return updated;
}

export async function checkExpiringObligations() {
    const now = new Date();
    const expiringObligations = await db.select({
        id: complianceObligations.id,
        title: complianceObligations.title,
        ownerId: complianceObligations.ownerId,
        expiresAt: complianceObligations.expiresAt,
        reminderDaysBefore: complianceObligations.reminderDaysBefore,
        lastReminderSentAt: complianceObligations.lastReminderSentAt,
    }).from(complianceObligations)
      .where(and(
          inArray(complianceObligations.status, ['active', 'expiring_soon']),
          sql`${complianceObligations.expiresAt} IS NOT NULL`
      ));

    let remindersCreated = 0;
    for (const obligation of expiringObligations) {
        if (!obligation.expiresAt || !obligation.ownerId) continue;

        const daysUntilExpiry = Math.ceil((obligation.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const reminderThreshold = obligation.reminderDaysBefore || 30;

        if (daysUntilExpiry <= reminderThreshold && daysUntilExpiry > 0) {
            // Only send if not already reminded in last 7 days
            if (obligation.lastReminderSentAt) {
                const daysSinceLastReminder = Math.ceil((now.getTime() - obligation.lastReminderSentAt.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceLastReminder < 7) continue;
            }

            await db.update(complianceObligations)
                .set({ status: 'expiring_soon', lastReminderSentAt: now, updatedAt: now })
                .where(eq(complianceObligations.id, obligation.id));

            await db.insert(notifications).values({
                userId: obligation.ownerId,
                title: 'Compliance Expiring Soon',
                message: `"${obligation.title}" expires in ${daysUntilExpiry} days.`,
                type: 'warning',
                link: `/admin/compliance`,
            });

            remindersCreated++;
        } else if (daysUntilExpiry <= 0) {
            await db.update(complianceObligations)
                .set({ status: 'expired', updatedAt: now })
                .where(eq(complianceObligations.id, obligation.id));
        }
    }

    return { remindersCreated, checkedCount: expiringObligations.length };
}
