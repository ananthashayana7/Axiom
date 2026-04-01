'use server';

import { db } from "@/db";
import { agentRecommendations, users, notifications, workflowTasks, auditLogs } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// AI PRODUCTIZATION - Typed recommendations with execute/dismiss/approve flows
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

export async function createTypedRecommendation(data: {
    agentName: string;
    recommendationType: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    estimatedSavings?: number;
    confidence: number;
    businessImpact: string;
    explanation: string;
    executionPayload?: Record<string, any>;
    entityType?: string;
    entityId?: string;
    ownerId?: string;
    dueDate?: Date;
    expiresAt?: Date;
}) {
    const [rec] = await db.insert(agentRecommendations).values({
        agentName: data.agentName,
        recommendationType: data.recommendationType,
        title: data.title,
        description: data.description,
        impact: data.impact,
        estimatedSavings: data.estimatedSavings ? String(data.estimatedSavings) : null,
        confidence: data.confidence,
        businessImpact: data.businessImpact,
        explanation: data.explanation,
        executionPayload: data.executionPayload ? JSON.stringify(data.executionPayload) : null,
        entityType: data.entityType,
        entityId: data.entityId,
        ownerId: data.ownerId,
        dueDate: data.dueDate,
        expiresAt: data.expiresAt,
        status: 'pending',
    }).returning();

    // Notify owner if set
    if (data.ownerId) {
        await db.insert(notifications).values({
            userId: data.ownerId,
            title: 'AI Recommendation',
            message: `${data.agentName}: ${data.title}`,
            type: data.impact === 'critical' ? 'warning' : 'info',
            link: '/admin/agents',
        });
    }

    return rec;
}

export async function getRecommendations(filters?: {
    status?: string;
    agentName?: string;
    entityType?: string;
    entityId?: string;
    impact?: string;
}) {
    await requireAuth();

    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(agentRecommendations.status, filters.status as any));
    if (filters?.agentName) conditions.push(eq(agentRecommendations.agentName, filters.agentName));
    if (filters?.entityType) conditions.push(eq(agentRecommendations.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(agentRecommendations.entityId, filters.entityId));
    if (filters?.impact) conditions.push(eq(agentRecommendations.impact, filters.impact as any));

    const recs = await db.select({
        id: agentRecommendations.id,
        agentName: agentRecommendations.agentName,
        recommendationType: agentRecommendations.recommendationType,
        title: agentRecommendations.title,
        description: agentRecommendations.description,
        impact: agentRecommendations.impact,
        estimatedSavings: agentRecommendations.estimatedSavings,
        confidence: agentRecommendations.confidence,
        businessImpact: agentRecommendations.businessImpact,
        explanation: agentRecommendations.explanation,
        executionPayload: agentRecommendations.executionPayload,
        entityType: agentRecommendations.entityType,
        entityId: agentRecommendations.entityId,
        ownerId: agentRecommendations.ownerId,
        ownerName: users.name,
        dueDate: agentRecommendations.dueDate,
        status: agentRecommendations.status,
        dismissalReason: agentRecommendations.dismissalReason,
        outcomeTracking: agentRecommendations.outcomeTracking,
        reviewedAt: agentRecommendations.reviewedAt,
        executedAt: agentRecommendations.executedAt,
        expiresAt: agentRecommendations.expiresAt,
        createdAt: agentRecommendations.createdAt,
    }).from(agentRecommendations)
      .leftJoin(users, eq(agentRecommendations.ownerId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
          desc(sql`CASE ${agentRecommendations.impact} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END`),
          desc(agentRecommendations.createdAt)
      );

    return recs;
}

export async function getEntityRecommendations(entityType: string, entityId: string) {
    await requireAuth();

    const recs = await db.select({
        id: agentRecommendations.id,
        agentName: agentRecommendations.agentName,
        title: agentRecommendations.title,
        description: agentRecommendations.description,
        impact: agentRecommendations.impact,
        confidence: agentRecommendations.confidence,
        explanation: agentRecommendations.explanation,
        businessImpact: agentRecommendations.businessImpact,
        estimatedSavings: agentRecommendations.estimatedSavings,
        status: agentRecommendations.status,
        createdAt: agentRecommendations.createdAt,
    }).from(agentRecommendations)
      .where(and(
          eq(agentRecommendations.entityType, entityType),
          eq(agentRecommendations.entityId, entityId),
          inArray(agentRecommendations.status, ['pending', 'approved'])
      ))
      .orderBy(desc(agentRecommendations.createdAt));

    return recs;
}

export async function approveRecommendation(recommendationId: string) {
    const user = await requireAuth();

    const [updated] = await db.update(agentRecommendations)
        .set({
            status: 'approved',
            reviewedBy: user.id as string,
            reviewedAt: new Date(),
        })
        .where(eq(agentRecommendations.id, recommendationId))
        .returning();

    // Audit log
    await db.insert(auditLogs).values({
        userId: user.id as string,
        action: 'APPROVE',
        entityType: 'agent_recommendation',
        entityId: recommendationId,
        details: JSON.stringify({
            agentName: updated.agentName,
            title: updated.title,
            impact: updated.impact,
        }),
    });

    revalidatePath('/admin/agents');
    return updated;
}

export async function executeRecommendation(recommendationId: string) {
    const user = await requireAuth();

    const [updated] = await db.update(agentRecommendations)
        .set({
            status: 'approved',
            executedAt: new Date(),
            reviewedBy: user.id as string,
            reviewedAt: new Date(),
        })
        .where(eq(agentRecommendations.id, recommendationId))
        .returning();

    // Create a workflow task to track execution
    await db.insert(workflowTasks).values({
        title: `Execute: ${updated.title}`,
        description: updated.description,
        entityType: (updated.entityType as any) || 'agent_recommendation',
        entityId: updated.entityId || recommendationId,
        priority: updated.impact === 'critical' ? 'critical' : updated.impact === 'high' ? 'high' : 'medium',
        assigneeId: updated.ownerId || (user.id as string),
        createdById: user.id as string,
        dueDate: updated.dueDate,
    });

    // Audit log
    await db.insert(auditLogs).values({
        userId: user.id as string,
        action: 'EXECUTE',
        entityType: 'agent_recommendation',
        entityId: recommendationId,
        details: JSON.stringify({
            agentName: updated.agentName,
            title: updated.title,
            executionPayload: updated.executionPayload,
        }),
    });

    revalidatePath('/admin/agents');
    return updated;
}

export async function dismissRecommendation(recommendationId: string, reason: string) {
    const user = await requireAuth();

    const [updated] = await db.update(agentRecommendations)
        .set({
            status: 'dismissed',
            dismissalReason: reason,
            reviewedBy: user.id as string,
            reviewedAt: new Date(),
        })
        .where(eq(agentRecommendations.id, recommendationId))
        .returning();

    // Audit log
    await db.insert(auditLogs).values({
        userId: user.id as string,
        action: 'DISMISS',
        entityType: 'agent_recommendation',
        entityId: recommendationId,
        details: JSON.stringify({
            agentName: updated.agentName,
            title: updated.title,
            reason,
        }),
    });

    revalidatePath('/admin/agents');
    return updated;
}

export async function trackRecommendationOutcome(recommendationId: string, outcome: {
    expectedOutcome: string;
    actualOutcome: string;
    delta?: string;
}) {
    const user = await requireAuth();

    const [updated] = await db.update(agentRecommendations)
        .set({
            outcomeTracking: JSON.stringify(outcome),
        })
        .where(eq(agentRecommendations.id, recommendationId))
        .returning();

    revalidatePath('/admin/agents');
    return updated;
}

export async function getRecommendationStats() {
    await requireAuth();

    const byAgent = await db.select({
        agentName: agentRecommendations.agentName,
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'pending')::int`,
        approved: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'approved')::int`,
        dismissed: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'dismissed')::int`,
        avgConfidence: sql<number>`avg(${agentRecommendations.confidence})::int`,
        totalSavings: sql<string>`coalesce(sum(${agentRecommendations.estimatedSavings}), '0')`,
    }).from(agentRecommendations)
      .groupBy(agentRecommendations.agentName);

    const [overall] = await db.select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'pending')::int`,
        approved: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'approved')::int`,
        dismissed: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'dismissed')::int`,
        expired: sql<number>`count(*) filter (where ${agentRecommendations.status} = 'expired')::int`,
    }).from(agentRecommendations);

    return { byAgent, overall };
}
