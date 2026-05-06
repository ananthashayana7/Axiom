'use server'

import { db } from "@/db";
import { auditLogs, comments, users } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canAccessAuditTrail } from "@/lib/rbac";

function canAccessEntity(user: { role?: string | null; supplierId?: string | null } | undefined, entityType: string, entityId: string) {
    if (!user) return false;
    if (user.role !== 'supplier') return true;

    if ((entityType === 'supplier' || entityType === 'supplier_message') && user.supplierId === entityId) {
        return true;
    }

    return false;
}

function readBooleanCell(value: unknown) {
    return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

/**
 * Audit Logging
 */
export async function logActivity(action: string, entityType: string, entityId: string, details: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        await db.insert(auditLogs).values({
            userId: session.user.id,
            action,
            entityType,
            entityId,
            details,
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}

export async function getAuditLogs(entityType?: string, entityId?: string) {
    const session = await auth();
    if (!session || !canAccessAuditTrail(session.user)) return [];

    try {
        const query = db.select({
            id: auditLogs.id,
            action: auditLogs.action,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            details: auditLogs.details,
            createdAt: auditLogs.createdAt,
            userName: users.name,
        })
            .from(auditLogs)
            .innerJoin(users, eq(auditLogs.userId, users.id))
            .orderBy(desc(auditLogs.createdAt));

        if (entityType && entityId) {
            return await query.where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)));
        }

        return await query;
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return [];
    }
}

/**
 * Comments
 */
export async function postComment(entityType: string, entityId: string, text: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!canAccessEntity(session.user, entityType, entityId)) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.insert(comments).values({
            userId: session.user.id,
            entityType,
            entityId,
            text,
        });

        // Log the comment action
        await logActivity('COMMENT', entityType, entityId, `User added a comment: ${text.substring(0, 50)}...`);

        if (entityType === 'supplier_message') {
            revalidatePath(`/suppliers/${entityId}`);
            revalidatePath("/portal/profile");
        } else {
            revalidatePath(`/${entityType}s/${entityId}`);
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to post comment:", error);
        return { success: false, error: "Failed to post comment" };
    }
}

export async function getComments(entityType: string, entityId: string) {
    const session = await auth();
    if (!session?.user) return [];
    if (!canAccessEntity(session.user, entityType, entityId)) return [];
    try {
        return await db.select({
            id: comments.id,
            text: comments.text,
            createdAt: comments.createdAt,
            userName: users.name,
        })
            .from(comments)
            .innerJoin(users, eq(comments.userId, users.id))
            .where(and(eq(comments.entityType, entityType), eq(comments.entityId, entityId)))
            .orderBy(desc(comments.createdAt));
    } catch (error) {
        console.error("Failed to fetch comments:", error);
        return [];
    }
}

export async function getAuditStoragePosture() {
    const session = await auth();
    if (!session || !canAccessAuditTrail(session.user)) return null;

    try {
        const result = await db.execute(sql`
            select
                exists(select 1 from pg_proc where proname = 'block_audit_log_mutation') as has_mutation_function,
                exists(select 1 from pg_trigger where tgname = 'audit_logs_block_mutation' and not tgisinternal) as has_mutation_trigger,
                exists(select 1 from pg_trigger where tgname = 'audit_logs_block_truncate' and not tgisinternal) as has_truncate_trigger
        `);

        const row = (result.rows?.[0] ?? {}) as Record<string, unknown>;
        const hasMutationFunction = readBooleanCell(row.has_mutation_function);
        const hasMutationTrigger = readBooleanCell(row.has_mutation_trigger);
        const hasTruncateTrigger = readBooleanCell(row.has_truncate_trigger);

        return {
            hasMutationFunction,
            hasMutationTrigger,
            hasTruncateTrigger,
            immutableEnforced: hasMutationFunction && hasMutationTrigger && hasTruncateTrigger,
        };
    } catch (error) {
        console.error("Failed to inspect audit storage posture:", error);
        return {
            hasMutationFunction: false,
            hasMutationTrigger: false,
            hasTruncateTrigger: false,
            immutableEnforced: false,
        };
    }
}

export async function getTimelineEvents(entityType: string, entityId: string) {
    const session = await auth();
    if (!session?.user) return [];
    if (!canAccessEntity(session.user, entityType, entityId)) return [];

    try {
        const logs = await db.select({
            id: auditLogs.id,
            action: auditLogs.action,
            details: auditLogs.details,
            createdAt: auditLogs.createdAt,
            userName: users.name,
        })
            .from(auditLogs)
            .innerJoin(users, eq(auditLogs.userId, users.id))
            .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
            .orderBy(desc(auditLogs.createdAt));

        return logs.filter((log) => {
            if (log.action === 'COMMENT') {
                return false;
            }

            if (session.user.role === 'supplier') {
                return log.action === 'MESSAGE';
            }

            return true;
        });
    } catch (error) {
        console.error("Failed to fetch timeline events:", error);
        return [];
    }
}
