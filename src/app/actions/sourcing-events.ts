'use server';

import { db } from "@/db";
import { sourcingEvents, sourcingMessages, rfqs, rfqSuppliers, suppliers, users, notifications, workflowTasks } from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getRFQNegotiationWorkbench } from "./cost-intelligence";

// ============================================================================
// SOURCING EVENT ORCHESTRATION - Full event management for RFQs
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

export async function createSourcingEvent(data: {
    rfqId: string;
    bidDeadline?: Date;
    qaDeadline?: Date;
    evaluationDeadline?: Date;
    scoringModel?: Record<string, number>;
    noBidHandling?: string;
}) {
    const user = await requireAuth();
    if (user.role !== 'admin' && user.role !== 'user') throw new Error('Access denied');

    const [event] = await db.insert(sourcingEvents).values({
        rfqId: data.rfqId,
        status: 'draft',
        bidDeadline: data.bidDeadline,
        qaDeadline: data.qaDeadline,
        evaluationDeadline: data.evaluationDeadline,
        scoringModel: data.scoringModel ? JSON.stringify(data.scoringModel) : null,
        noBidHandling: data.noBidHandling || 'extend_deadline',
        ownerId: user.id as string,
    }).returning();

    revalidatePath('/sourcing/rfqs');
    return event;
}

export async function launchSourcingEvent(eventId: string) {
    const user = await requireAuth();

    const [event] = await db.update(sourcingEvents)
        .set({
            status: 'launched',
            launchedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(sourcingEvents.id, eventId))
        .returning();

    // Update linked RFQ to open
    await db.update(rfqs)
        .set({ status: 'open' })
        .where(eq(rfqs.id, event.rfqId));

    // Notify all invited suppliers
    const invitedSuppliers = await db.select({
        supplierId: rfqSuppliers.supplierId,
    }).from(rfqSuppliers)
      .where(eq(rfqSuppliers.rfqId, event.rfqId));

    for (const inv of invitedSuppliers) {
        const supplierUsers = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.supplierId, inv.supplierId));

        for (const su of supplierUsers) {
            await db.insert(notifications).values({
                userId: su.id,
                title: 'Sourcing Event Launched',
                message: `A new sourcing event has been launched. Please submit your bid${event.bidDeadline ? ` by ${event.bidDeadline.toISOString().split('T')[0]}` : ''}.`,
                type: 'info',
                link: `/portal/rfqs/${event.rfqId}`,
            });
        }
    }

    revalidatePath('/sourcing/rfqs');
    return event;
}

export async function updateSourcingEventStatus(eventId: string, status: 'draft' | 'launched' | 'supplier_qa' | 'bid_submitted' | 'bid_locked' | 'evaluation' | 'negotiation' | 'awarded' | 'closed' | 'cancelled') {
    const user = await requireAuth();

    const updateData: any = { status, updatedAt: new Date() };

    const [updated] = await db.update(sourcingEvents)
        .set(updateData)
        .where(eq(sourcingEvents.id, eventId))
        .returning();

    // Create workflow tasks for key state transitions
    const taskMap: Record<string, string> = {
        evaluation: 'Evaluate bids and prepare scoring comparison',
        negotiation: 'Conduct negotiations with shortlisted suppliers',
        awarded: 'Prepare award memo and notify suppliers',
    };

    if (taskMap[status] && updated.ownerId) {
        await db.insert(workflowTasks).values({
            title: `Sourcing Event: ${status.replace(/_/g, ' ')}`,
            description: taskMap[status],
            entityType: 'rfq',
            entityId: updated.rfqId,
            priority: 'high',
            assigneeId: updated.ownerId,
            createdById: user.id as string,
            dueDate: updated.evaluationDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }

    revalidatePath('/sourcing/rfqs');
    return updated;
}

export async function getSourcingEvent(rfqId: string) {
    await requireAuth();

    const events = await db.select({
        id: sourcingEvents.id,
        rfqId: sourcingEvents.rfqId,
        status: sourcingEvents.status,
        launchedAt: sourcingEvents.launchedAt,
        bidDeadline: sourcingEvents.bidDeadline,
        qaDeadline: sourcingEvents.qaDeadline,
        evaluationDeadline: sourcingEvents.evaluationDeadline,
        scoringModel: sourcingEvents.scoringModel,
        awardMemo: sourcingEvents.awardMemo,
        awardedSupplierId: sourcingEvents.awardedSupplierId,
        awardedAt: sourcingEvents.awardedAt,
        awardJustification: sourcingEvents.awardJustification,
        scenarioComparison: sourcingEvents.scenarioComparison,
        noBidHandling: sourcingEvents.noBidHandling,
        ownerId: sourcingEvents.ownerId,
        ownerName: users.name,
        createdAt: sourcingEvents.createdAt,
    }).from(sourcingEvents)
      .leftJoin(users, eq(sourcingEvents.ownerId, users.id))
      .where(eq(sourcingEvents.rfqId, rfqId))
      .orderBy(desc(sourcingEvents.createdAt))
      .limit(1);

    return events[0] || null;
}

export async function prepareRFQNegotiation(rfqId: string) {
    const user = await requireAuth();
    if (user.role === 'supplier') throw new Error('Access denied');

    const workbench = await getRFQNegotiationWorkbench(rfqId);
    if (!workbench.hasQuotes || !workbench.recommendedSupplier) {
        return { success: false as const, error: 'At least one submitted quote is required before negotiation can start.' };
    }

    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const scenarioComparison = workbench.supplierRankings.map((supplier) => ({
        name: supplier.supplierName,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        totalScore: supplier.totalScore,
        breakdown: {
            price: supplier.priceScore,
            delivery: supplier.deliveryScore,
            performance: supplier.performanceScore,
            risk: 100 - supplier.riskScore,
        },
        totalCost: supplier.quoteAmount,
        deliveryWeeks: supplier.deliveryWeeks || 0,
        riskScore: supplier.riskScore,
    }));

    return await db.transaction(async (tx) => {
        const [existingEvent] = await tx.select({
            id: sourcingEvents.id,
            ownerId: sourcingEvents.ownerId,
            launchedAt: sourcingEvents.launchedAt,
        }).from(sourcingEvents)
          .where(eq(sourcingEvents.rfqId, rfqId))
          .limit(1);

        let eventId = existingEvent?.id || null;

        if (existingEvent) {
            const [updated] = await tx.update(sourcingEvents)
                .set({
                    status: 'negotiation',
                    launchedAt: existingEvent.launchedAt || new Date(),
                    evaluationDeadline: dueDate,
                    scoringModel: JSON.stringify({ price: 45, delivery: 15, performance: 20, risk: 12, collaboration: 8 }),
                    scenarioComparison: JSON.stringify(scenarioComparison),
                    ownerId: existingEvent.ownerId || (user.id as string),
                    updatedAt: new Date(),
                })
                .where(eq(sourcingEvents.id, existingEvent.id))
                .returning({ id: sourcingEvents.id });

            eventId = updated.id;
        } else {
            const [created] = await tx.insert(sourcingEvents).values({
                rfqId,
                status: 'negotiation',
                launchedAt: new Date(),
                evaluationDeadline: dueDate,
                scoringModel: JSON.stringify({ price: 45, delivery: 15, performance: 20, risk: 12, collaboration: 8 }),
                scenarioComparison: JSON.stringify(scenarioComparison),
                ownerId: user.id as string,
            }).returning({ id: sourcingEvents.id });

            eventId = created.id;
        }

        await tx.update(rfqs)
            .set({ status: 'open' })
            .where(eq(rfqs.id, rfqId));

        const [existingTask] = await tx.select({
            id: workflowTasks.id,
            status: workflowTasks.status,
            title: workflowTasks.title,
        }).from(workflowTasks)
          .where(and(
              eq(workflowTasks.entityType, 'rfq'),
              eq(workflowTasks.entityId, rfqId)
          ))
          .orderBy(desc(workflowTasks.createdAt))
          .limit(1);

        const taskDescription = [
            `Priority: ${workbench.negotiationPriority.toUpperCase()}.`,
            `Recommended supplier: ${workbench.recommendedSupplier.supplierName} (${workbench.recommendedSupplier.quoteAmount.toLocaleString()}).`,
            `Modeled should-cost gap: ${workbench.shouldCostGap.toLocaleString()}. Competitive leverage available: ${workbench.competitiveSavings.toLocaleString()}.`,
            ...workbench.actionPlan,
        ].join(' ');

        let taskId = existingTask?.id || null;
        if (existingTask && existingTask.status !== 'completed' && existingTask.status !== 'cancelled') {
            const [updatedTask] = await tx.update(workflowTasks)
                .set({
                    title: `Negotiate RFQ: ${workbench.rfqTitle}`,
                    description: taskDescription,
                    status: 'open',
                    priority: workbench.negotiationPriority === 'critical'
                        ? 'critical'
                        : workbench.negotiationPriority === 'high'
                            ? 'high'
                            : 'medium',
                    assigneeId: user.id as string,
                    dueDate,
                })
                .where(eq(workflowTasks.id, existingTask.id))
                .returning({ id: workflowTasks.id });

            taskId = updatedTask.id;
        } else {
            const [createdTask] = await tx.insert(workflowTasks).values({
                title: `Negotiate RFQ: ${workbench.rfqTitle}`,
                description: taskDescription,
                entityType: 'rfq',
                entityId: rfqId,
                status: 'open',
                priority: workbench.negotiationPriority === 'critical'
                    ? 'critical'
                    : workbench.negotiationPriority === 'high'
                        ? 'high'
                        : 'medium',
                assigneeId: user.id as string,
                createdById: user.id as string,
                dueDate,
            }).returning({ id: workflowTasks.id });

            taskId = createdTask.id;
        }

        const adminUsers = await tx.select({ id: users.id })
            .from(users)
            .where(eq(users.role, 'admin'));

        for (const admin of adminUsers) {
            if (admin.id === user.id) continue;
            await tx.insert(notifications).values({
                userId: admin.id,
                title: 'RFQ Ready For Negotiation',
                message: `${workbench.rfqTitle} moved into negotiation with ${workbench.quoteCount} quoted suppliers and ${workbench.shouldCostGap.toLocaleString()} modeled savings still open.`,
                type: 'info',
                link: `/sourcing/rfqs/${rfqId}`,
            });
        }

        revalidatePath('/sourcing/rfqs');
        revalidatePath(`/sourcing/rfqs/${rfqId}`);
        revalidatePath('/admin/tasks');

        return {
            success: true as const,
            eventId,
            taskId,
            shouldCostGap: workbench.shouldCostGap,
            competitiveSavings: workbench.competitiveSavings,
        };
    });
}

export async function awardSourcingEvent(eventId: string, supplierId: string, justification: string, awardMemo?: string) {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(sourcingEvents)
        .set({
            status: 'awarded',
            awardedSupplierId: supplierId,
            awardedAt: new Date(),
            awardJustification: justification,
            awardMemo: awardMemo || null,
            updatedAt: new Date(),
        })
        .where(eq(sourcingEvents.id, eventId))
        .returning();

    // Notify awarded supplier
    const supplierUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.supplierId, supplierId));

    for (const su of supplierUsers) {
        await db.insert(notifications).values({
            userId: su.id,
            title: 'Sourcing Award',
            message: `Congratulations! You have been awarded the sourcing event.`,
            type: 'success',
            link: `/portal/rfqs/${updated.rfqId}`,
        });
    }

    revalidatePath('/sourcing/rfqs');
    return updated;
}

export async function saveScenarioComparison(eventId: string, scenarios: Array<{
    name: string;
    supplierId: string;
    supplierName: string;
    totalScore: number;
    breakdown: Record<string, number>;
    totalCost: number;
    deliveryWeeks: number;
    riskScore: number;
}>) {
    const [updated] = await db.update(sourcingEvents)
        .set({
            scenarioComparison: JSON.stringify(scenarios),
            updatedAt: new Date(),
        })
        .where(eq(sourcingEvents.id, eventId))
        .returning();

    revalidatePath('/sourcing/rfqs');
    return updated;
}

// ── Sourcing Messages ──

export async function sendSourcingMessage(data: {
    rfqId: string;
    supplierId?: string;
    messageType: 'question' | 'answer' | 'clarification' | 'general' | 'system';
    subject?: string;
    content: string;
    parentMessageId?: string;
}) {
    const user = await requireAuth();

    const [message] = await db.insert(sourcingMessages).values({
        rfqId: data.rfqId,
        supplierId: data.supplierId,
        senderId: user.id as string,
        messageType: data.messageType,
        subject: data.subject,
        content: data.content,
        parentMessageId: data.parentMessageId,
    }).returning();

    revalidatePath(`/sourcing/rfqs/${data.rfqId}`);
    revalidatePath(`/portal/rfqs/${data.rfqId}`);
    return message;
}

export async function getSourcingMessages(rfqId: string) {
    await requireAuth();

    const messages = await db.select({
        id: sourcingMessages.id,
        rfqId: sourcingMessages.rfqId,
        supplierId: sourcingMessages.supplierId,
        supplierName: suppliers.name,
        senderId: sourcingMessages.senderId,
        senderName: users.name,
        messageType: sourcingMessages.messageType,
        subject: sourcingMessages.subject,
        content: sourcingMessages.content,
        parentMessageId: sourcingMessages.parentMessageId,
        isRead: sourcingMessages.isRead,
        createdAt: sourcingMessages.createdAt,
    }).from(sourcingMessages)
      .leftJoin(suppliers, eq(sourcingMessages.supplierId, suppliers.id))
      .leftJoin(users, eq(sourcingMessages.senderId, users.id))
      .where(eq(sourcingMessages.rfqId, rfqId))
      .orderBy(asc(sourcingMessages.createdAt));

    return messages;
}

export async function markMessagesRead(rfqId: string) {
    const user = await requireAuth();

    await db.update(sourcingMessages)
        .set({ isRead: 'yes' })
        .where(and(
            eq(sourcingMessages.rfqId, rfqId),
            sql`${sourcingMessages.senderId} != ${user.id}`
        ));

    revalidatePath(`/sourcing/rfqs/${rfqId}`);
}
