'use server';

import { db } from "@/db";
import { workflowTasks, users, notifications, requisitions, rfqs, procurementOrders, invoices, contracts } from "@/db/schema";
import { eq, and, desc, asc, lte, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'escalated';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
type TaskEntityType = 'requisition' | 'rfq' | 'order' | 'invoice' | 'contract' | 'supplier' | 'compliance_obligation' | 'agent_recommendation';
type TaskCondition = ReturnType<typeof eq>;
const ACTIVE_TASK_STATUSES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'escalated'];

// ============================================================================
// WORKFLOW TASK ENGINE - First-class tasks across procurement objects
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

async function reconcileStaleWorkflowTasks() {
    const activeTasks = await db.select({
        id: workflowTasks.id,
        entityType: workflowTasks.entityType,
        entityId: workflowTasks.entityId,
    }).from(workflowTasks)
        .where(inArray(workflowTasks.status, ACTIVE_TASK_STATUSES));

    if (activeTasks.length === 0) return 0;

    const requisitionIds = activeTasks.filter((task) => task.entityType === 'requisition').map((task) => task.entityId);
    const rfqIds = activeTasks.filter((task) => task.entityType === 'rfq').map((task) => task.entityId);
    const orderIds = activeTasks.filter((task) => task.entityType === 'order').map((task) => task.entityId);
    const invoiceIds = activeTasks.filter((task) => task.entityType === 'invoice').map((task) => task.entityId);
    const contractIds = activeTasks.filter((task) => task.entityType === 'contract').map((task) => task.entityId);

    const completionMap = new Map<string, string>();

    if (requisitionIds.length > 0) {
        const rows = await db.select({
            id: requisitions.id,
            status: requisitions.status,
        }).from(requisitions)
            .where(inArray(requisitions.id, requisitionIds));

        rows.forEach((row) => {
            if (['approved', 'rejected', 'converted_to_po'].includes(row.status || '')) {
                completionMap.set(`requisition:${row.id}`, `Auto-resolved after requisition moved to ${row.status}.`);
            }
        });
    }

    if (rfqIds.length > 0) {
        const rows = await db.select({
            id: rfqs.id,
            status: rfqs.status,
        }).from(rfqs)
            .where(inArray(rfqs.id, rfqIds));

        rows.forEach((row) => {
            if (['closed', 'cancelled'].includes(row.status || '')) {
                completionMap.set(`rfq:${row.id}`, `Auto-resolved after RFQ moved to ${row.status}.`);
            }
        });
    }

    if (orderIds.length > 0) {
        const rows = await db.select({
            id: procurementOrders.id,
            status: procurementOrders.status,
        }).from(procurementOrders)
            .where(inArray(procurementOrders.id, orderIds));

        rows.forEach((row) => {
            if (['fulfilled', 'cancelled'].includes(row.status || '')) {
                completionMap.set(`order:${row.id}`, `Auto-resolved after order moved to ${row.status}.`);
            }
        });
    }

    if (invoiceIds.length > 0) {
        const rows = await db.select({
            id: invoices.id,
            status: invoices.status,
        }).from(invoices)
            .where(inArray(invoices.id, invoiceIds));

        rows.forEach((row) => {
            if (row.status === 'paid') {
                completionMap.set(`invoice:${row.id}`, `Auto-resolved after invoice moved to paid.`);
            }
        });
    }

    if (contractIds.length > 0) {
        const rows = await db.select({
            id: contracts.id,
            status: contracts.status,
        }).from(contracts)
            .where(inArray(contracts.id, contractIds));

        rows.forEach((row) => {
            if (['expired', 'terminated'].includes(row.status || '')) {
                completionMap.set(`contract:${row.id}`, `Auto-resolved after contract moved to ${row.status}.`);
            }
        });
    }

    const updates = activeTasks.filter((task) => completionMap.has(`${task.entityType}:${task.entityId}`));
    for (const task of updates) {
        await db.update(workflowTasks)
            .set({
                status: 'completed',
                completedAt: new Date(),
                completionEvidence: completionMap.get(`${task.entityType}:${task.entityId}`),
                updatedAt: new Date(),
            })
            .where(eq(workflowTasks.id, task.id));
    }

    return updates.length;
}

export async function createWorkflowTask(data: {
    title: string;
    description?: string;
    entityType: 'requisition' | 'rfq' | 'order' | 'invoice' | 'contract' | 'supplier' | 'compliance_obligation' | 'agent_recommendation';
    entityId: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    assigneeId?: string;
    dueDate?: Date;
    slaDeadline?: Date;
    nextAction?: string;
}) {
    const user = await requireAuth();

    const [task] = await db.insert(workflowTasks).values({
        title: data.title,
        description: data.description,
        entityType: data.entityType,
        entityId: data.entityId,
        priority: data.priority || 'medium',
        assigneeId: data.assigneeId,
        createdById: user.id as string,
        dueDate: data.dueDate,
        slaDeadline: data.slaDeadline,
        nextAction: data.nextAction,
    }).returning();

    // Notify assignee if different from creator
    if (data.assigneeId && data.assigneeId !== user.id) {
        await db.insert(notifications).values({
            userId: data.assigneeId,
            title: 'New Task Assigned',
            message: `You have been assigned: ${data.title}`,
            type: 'info',
            link: `/admin/tasks`,
        });
    }

    revalidatePath('/admin/tasks');
    return task;
}

export async function getInboxTasks(filters?: {
    status?: string;
    priority?: string;
    entityType?: string;
}) {
    const user = await requireAuth();
    await reconcileStaleWorkflowTasks();
    const conditions: TaskCondition[] = [eq(workflowTasks.assigneeId, user.id as string)];

    const statusValues: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'cancelled', 'escalated'];
    const priorityValues: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
    const entityValues: TaskEntityType[] = ['requisition', 'rfq', 'order', 'invoice', 'contract', 'supplier', 'compliance_obligation', 'agent_recommendation'];

    if (filters?.status && statusValues.includes(filters.status as TaskStatus)) {
        conditions.push(eq(workflowTasks.status, filters.status as TaskStatus));
    }
    if (filters?.priority && priorityValues.includes(filters.priority as TaskPriority)) {
        conditions.push(eq(workflowTasks.priority, filters.priority as TaskPriority));
    }
    if (filters?.entityType && entityValues.includes(filters.entityType as TaskEntityType)) {
        conditions.push(eq(workflowTasks.entityType, filters.entityType as TaskEntityType));
    }

    const tasks = await db.select({
        id: workflowTasks.id,
        title: workflowTasks.title,
        description: workflowTasks.description,
        entityType: workflowTasks.entityType,
        entityId: workflowTasks.entityId,
        status: workflowTasks.status,
        priority: workflowTasks.priority,
        dueDate: workflowTasks.dueDate,
        slaDeadline: workflowTasks.slaDeadline,
        nextAction: workflowTasks.nextAction,
        assigneeId: workflowTasks.assigneeId,
        createdAt: workflowTasks.createdAt,
        escalatedAt: workflowTasks.escalatedAt,
    }).from(workflowTasks)
      .where(and(...conditions))
      .orderBy(
          desc(sql`CASE ${workflowTasks.priority} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END`),
          asc(workflowTasks.dueDate)
      );

    return tasks;
}

export async function getAllTasks(filters?: {
    status?: string;
    priority?: string;
    entityType?: string;
    assigneeId?: string;
}) {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');
    await reconcileStaleWorkflowTasks();

    const conditions: TaskCondition[] = [];

    const statusValues: TaskStatus[] = ['open', 'in_progress', 'blocked', 'completed', 'cancelled', 'escalated'];
    const priorityValues: TaskPriority[] = ['low', 'medium', 'high', 'critical'];
    const entityValues: TaskEntityType[] = ['requisition', 'rfq', 'order', 'invoice', 'contract', 'supplier', 'compliance_obligation', 'agent_recommendation'];

    if (filters?.status && statusValues.includes(filters.status as TaskStatus)) conditions.push(eq(workflowTasks.status, filters.status as TaskStatus));
    if (filters?.priority && priorityValues.includes(filters.priority as TaskPriority)) conditions.push(eq(workflowTasks.priority, filters.priority as TaskPriority));
    if (filters?.entityType && entityValues.includes(filters.entityType as TaskEntityType)) conditions.push(eq(workflowTasks.entityType, filters.entityType as TaskEntityType));
    if (filters?.assigneeId) conditions.push(eq(workflowTasks.assigneeId, filters.assigneeId));

    const tasks = await db.select({
        id: workflowTasks.id,
        title: workflowTasks.title,
        description: workflowTasks.description,
        entityType: workflowTasks.entityType,
        entityId: workflowTasks.entityId,
        status: workflowTasks.status,
        priority: workflowTasks.priority,
        dueDate: workflowTasks.dueDate,
        slaDeadline: workflowTasks.slaDeadline,
        nextAction: workflowTasks.nextAction,
        assigneeId: workflowTasks.assigneeId,
        assigneeName: users.name,
        createdAt: workflowTasks.createdAt,
        escalatedAt: workflowTasks.escalatedAt,
    }).from(workflowTasks)
      .leftJoin(users, eq(workflowTasks.assigneeId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
          desc(sql`CASE ${workflowTasks.priority} WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END`),
          asc(workflowTasks.dueDate)
      );

    return tasks;
}

export async function updateTaskStatus(taskId: string, status: 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'escalated', evidence?: string) {
    await requireAuth();

    const updateData: { status: TaskStatus; updatedAt: Date; completedAt?: Date; completionEvidence?: string } = { status, updatedAt: new Date() };
    if (status === 'completed') {
        updateData.completedAt = new Date();
        if (evidence) updateData.completionEvidence = evidence;
    }

    const [updated] = await db.update(workflowTasks)
        .set(updateData)
        .where(eq(workflowTasks.id, taskId))
        .returning();

    revalidatePath('/admin/tasks');
    return updated;
}

export async function assignTask(taskId: string, assigneeId: string) {
    const user = await requireAuth();

    const [updated] = await db.update(workflowTasks)
        .set({ assigneeId, updatedAt: new Date() })
        .where(eq(workflowTasks.id, taskId))
        .returning();

    if (assigneeId !== user.id) {
        await db.insert(notifications).values({
            userId: assigneeId,
            title: 'Task Assigned',
            message: `You have been assigned: ${updated.title}`,
            type: 'info',
            link: `/admin/tasks`,
        });
    }

    revalidatePath('/admin/tasks');
    return updated;
}

export async function escalateTask(taskId: string, escalateToId: string, reason: string) {
    await requireAuth();

    const [updated] = await db.update(workflowTasks)
        .set({
            status: 'escalated',
            escalatedAt: new Date(),
            escalatedToId: escalateToId,
            escalationReason: reason,
            updatedAt: new Date(),
        })
        .where(eq(workflowTasks.id, taskId))
        .returning();

    await db.insert(notifications).values({
        userId: escalateToId,
        title: 'Task Escalated to You',
        message: `Task escalated: ${updated.title} — ${reason}`,
        type: 'warning',
        link: `/admin/tasks`,
    });

    revalidatePath('/admin/tasks');
    return updated;
}

export async function getOverdueTasks() {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');
    await reconcileStaleWorkflowTasks();

    const now = new Date();
    const tasks = await db.select({
        id: workflowTasks.id,
        title: workflowTasks.title,
        entityType: workflowTasks.entityType,
        entityId: workflowTasks.entityId,
        status: workflowTasks.status,
        priority: workflowTasks.priority,
        dueDate: workflowTasks.dueDate,
        slaDeadline: workflowTasks.slaDeadline,
        assigneeId: workflowTasks.assigneeId,
        assigneeName: users.name,
    }).from(workflowTasks)
      .leftJoin(users, eq(workflowTasks.assigneeId, users.id))
      .where(and(
          lte(workflowTasks.dueDate, now),
          inArray(workflowTasks.status, ['open', 'in_progress', 'blocked'])
      ))
      .orderBy(asc(workflowTasks.dueDate));

    return tasks;
}

export async function getTasksByEntity(entityType: string, entityId: string) {
    await reconcileStaleWorkflowTasks();
    const entityValues: TaskEntityType[] = ['requisition', 'rfq', 'order', 'invoice', 'contract', 'supplier', 'compliance_obligation', 'agent_recommendation'];
    if (!entityValues.includes(entityType as TaskEntityType)) return [];

    const tasks = await db.select({
        id: workflowTasks.id,
        title: workflowTasks.title,
        description: workflowTasks.description,
        status: workflowTasks.status,
        priority: workflowTasks.priority,
        dueDate: workflowTasks.dueDate,
        assigneeId: workflowTasks.assigneeId,
        assigneeName: users.name,
        nextAction: workflowTasks.nextAction,
        createdAt: workflowTasks.createdAt,
    }).from(workflowTasks)
      .leftJoin(users, eq(workflowTasks.assigneeId, users.id))
      .where(and(
          eq(workflowTasks.entityType, entityType as TaskEntityType),
          eq(workflowTasks.entityId, entityId)
      ))
      .orderBy(desc(workflowTasks.createdAt));

    return tasks;
}

export async function getTaskSummary() {
    const user = await requireAuth();
    await reconcileStaleWorkflowTasks();

    const summary = await db.select({
        status: workflowTasks.status,
        count: sql<number>`count(*)::int`,
    }).from(workflowTasks)
      .where(eq(workflowTasks.assigneeId, user.id as string))
      .groupBy(workflowTasks.status);

    const overdue = await db.select({
        count: sql<number>`count(*)::int`,
    }).from(workflowTasks)
      .where(and(
          eq(workflowTasks.assigneeId, user.id as string),
          lte(workflowTasks.dueDate, new Date()),
          inArray(workflowTasks.status, ['open', 'in_progress', 'blocked'])
      ));

    return {
        byStatus: Object.fromEntries(summary.map(s => [s.status, s.count])),
        overdueCount: overdue[0]?.count || 0,
    };
}
