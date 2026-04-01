'use server';

import { db } from "@/db";
import { supplierActionPlans, supplierRequests, suppliers, users, notifications, workflowTasks } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// SUPPLIER INTELLIGENCE - Action plans, requests, segmentation, lifecycle
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

// ── Supplier Action Plans ──

export async function createActionPlan(data: {
    supplierId: string;
    title: string;
    description?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    planType: string;
    ownerId?: string;
    dueDate?: Date;
    steps?: Array<{ title: string; description: string; status: string; dueDate?: string }>;
}) {
    const user = await requireAuth();
    if ((user as any).role !== 'admin') throw new Error('Admin access required');

    const [plan] = await db.insert(supplierActionPlans).values({
        supplierId: data.supplierId,
        title: data.title,
        description: data.description,
        severity: data.severity,
        planType: data.planType,
        ownerId: data.ownerId,
        dueDate: data.dueDate,
        steps: data.steps ? JSON.stringify(data.steps) : null,
        status: 'active',
        createdById: user.id as string,
    }).returning();

    // Auto-create workflow task for the owner
    if (data.ownerId) {
        await db.insert(workflowTasks).values({
            title: `Action Plan: ${data.title}`,
            description: `Manage supplier action plan for remediation/development`,
            entityType: 'supplier',
            entityId: data.supplierId,
            priority: data.severity === 'critical' ? 'critical' : data.severity === 'high' ? 'high' : 'medium',
            assigneeId: data.ownerId,
            createdById: user.id as string,
            dueDate: data.dueDate,
        });
    }

    revalidatePath('/admin/suppliers');
    return plan;
}

export async function getSupplierActionPlans(supplierId: string) {
    await requireAuth();

    const plans = await db.select({
        id: supplierActionPlans.id,
        title: supplierActionPlans.title,
        description: supplierActionPlans.description,
        severity: supplierActionPlans.severity,
        status: supplierActionPlans.status,
        planType: supplierActionPlans.planType,
        ownerId: supplierActionPlans.ownerId,
        ownerName: users.name,
        dueDate: supplierActionPlans.dueDate,
        steps: supplierActionPlans.steps,
        linkedEvidence: supplierActionPlans.linkedEvidence,
        completedAt: supplierActionPlans.completedAt,
        createdAt: supplierActionPlans.createdAt,
    }).from(supplierActionPlans)
      .leftJoin(users, eq(supplierActionPlans.ownerId, users.id))
      .where(eq(supplierActionPlans.supplierId, supplierId))
      .orderBy(desc(supplierActionPlans.createdAt));

    return plans;
}

export async function updateActionPlanStatus(planId: string, status: 'draft' | 'active' | 'in_progress' | 'completed' | 'cancelled') {
    const user = await requireAuth();

    const updateData: any = { status, updatedAt: new Date() };
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db.update(supplierActionPlans)
        .set(updateData)
        .where(eq(supplierActionPlans.id, planId))
        .returning();

    revalidatePath('/admin/suppliers');
    return updated;
}

export async function updateActionPlanSteps(planId: string, steps: Array<{ title: string; description: string; status: string; dueDate?: string }>) {
    const [updated] = await db.update(supplierActionPlans)
        .set({ steps: JSON.stringify(steps), updatedAt: new Date() })
        .where(eq(supplierActionPlans.id, planId))
        .returning();

    revalidatePath('/admin/suppliers');
    return updated;
}

// ── Supplier Requests ──

export async function createSupplierRequest(data: {
    supplierId: string;
    requestType: 'document_request' | 'corrective_action' | 'compliance_attestation' | 'commercial_clarification' | 'onboarding' | 'periodic_review';
    title: string;
    description?: string;
    dueDate?: Date;
    linkedObligationId?: string;
}) {
    const user = await requireAuth();
    if ((user as any).role !== 'admin' && (user as any).role !== 'user') throw new Error('Access denied');

    const [request] = await db.insert(supplierRequests).values({
        supplierId: data.supplierId,
        requestType: data.requestType,
        title: data.title,
        description: data.description,
        status: 'sent',
        dueDate: data.dueDate,
        linkedObligationId: data.linkedObligationId,
        createdById: user.id as string,
    }).returning();

    // Notify supplier users
    const supplierUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.supplierId, data.supplierId));

    for (const su of supplierUsers) {
        await db.insert(notifications).values({
            userId: su.id,
            title: 'New Request',
            message: `You have a new ${data.requestType.replace(/_/g, ' ')}: ${data.title}`,
            type: 'info',
            link: `/portal`,
        });
    }

    revalidatePath('/admin/suppliers');
    revalidatePath('/portal');
    return request;
}

export async function getSupplierRequests(supplierId: string) {
    await requireAuth();

    const requests = await db.select({
        id: supplierRequests.id,
        requestType: supplierRequests.requestType,
        title: supplierRequests.title,
        description: supplierRequests.description,
        status: supplierRequests.status,
        dueDate: supplierRequests.dueDate,
        responseText: supplierRequests.responseText,
        responseDocumentUrl: supplierRequests.responseDocumentUrl,
        respondedAt: supplierRequests.respondedAt,
        createdAt: supplierRequests.createdAt,
    }).from(supplierRequests)
      .where(eq(supplierRequests.supplierId, supplierId))
      .orderBy(desc(supplierRequests.createdAt));

    return requests;
}

export async function getPortalRequests() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    const user = session.user as any;
    if (user.role !== 'supplier' || !user.supplierId) throw new Error('Supplier access required');

    const requests = await db.select({
        id: supplierRequests.id,
        requestType: supplierRequests.requestType,
        title: supplierRequests.title,
        description: supplierRequests.description,
        status: supplierRequests.status,
        dueDate: supplierRequests.dueDate,
        responseText: supplierRequests.responseText,
        createdAt: supplierRequests.createdAt,
    }).from(supplierRequests)
      .where(eq(supplierRequests.supplierId, user.supplierId))
      .orderBy(desc(supplierRequests.createdAt));

    return requests;
}

export async function respondToSupplierRequest(requestId: string, responseText: string, documentUrl?: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const [updated] = await db.update(supplierRequests)
        .set({
            status: 'submitted',
            responseText,
            responseDocumentUrl: documentUrl,
            respondedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(supplierRequests.id, requestId))
        .returning();

    // Notify the creator
    if (updated.createdById) {
        await db.insert(notifications).values({
            userId: updated.createdById,
            title: 'Supplier Response Received',
            message: `Response received for: ${updated.title}`,
            type: 'success',
        });
    }

    revalidatePath('/portal');
    revalidatePath('/admin/suppliers');
    return updated;
}

export async function verifySupplierRequest(requestId: string, approved: boolean) {
    const user = await requireAuth();
    if ((user as any).role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(supplierRequests)
        .set({
            status: approved ? 'verified' : 'rejected',
            verifiedById: user.id as string,
            verifiedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(supplierRequests.id, requestId))
        .returning();

    revalidatePath('/admin/suppliers');
    return updated;
}

// ── Supplier Segmentation ──

export async function updateSupplierSegment(supplierId: string, segment: 'strategic' | 'bottleneck' | 'leverage' | 'routine' | 'high_risk') {
    const user = await requireAuth();
    if ((user as any).role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(suppliers)
        .set({ segment })
        .where(eq(suppliers.id, supplierId))
        .returning();

    revalidatePath('/admin/suppliers');
    return updated;
}

export async function getSupplierSegmentation() {
    await requireAuth();

    const segmentation = await db.select({
        segment: suppliers.segment,
        count: sql<number>`count(*)::int`,
        avgPerformance: sql<number>`avg(${suppliers.performanceScore})::int`,
        avgRisk: sql<number>`avg(${suppliers.riskScore})::int`,
    }).from(suppliers)
      .where(sql`${suppliers.segment} IS NOT NULL`)
      .groupBy(suppliers.segment);

    return segmentation;
}

// ── Supplier Lifecycle ──

export async function updateSupplierLifecycle(supplierId: string, lifecycleStatus: 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated') {
    const user = await requireAuth();
    if ((user as any).role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(suppliers)
        .set({ lifecycleStatus })
        .where(eq(suppliers.id, supplierId))
        .returning();

    // Create task for lifecycle gate review
    const gateActions: Record<string, string> = {
        onboarding: 'Complete onboarding checklist and qualification review',
        active: 'Verify all onboarding requirements before activation',
        suspended: 'Investigate suspension reason and create remediation plan',
        terminated: 'Complete termination checklist and notify stakeholders',
    };

    if (gateActions[lifecycleStatus]) {
        await db.insert(workflowTasks).values({
            title: `Lifecycle Gate: ${updated.name} → ${lifecycleStatus}`,
            description: gateActions[lifecycleStatus],
            entityType: 'supplier',
            entityId: supplierId,
            priority: lifecycleStatus === 'terminated' ? 'high' : 'medium',
            assigneeId: user.id as string,
            createdById: user.id as string,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
    }

    revalidatePath('/admin/suppliers');
    return updated;
}
