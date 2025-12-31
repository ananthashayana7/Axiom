'use server'

import { db } from "@/db";
import { auditLogs, comments, notifications, users } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
    if (!session || (session.user as any).role !== 'admin') return [];

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
 * Notifications
 */
export async function createNotification(userId: string, title: string, message: string) {
    try {
        await db.insert(notifications).values({
            userId,
            title,
            message,
            read: 'no',
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

export async function getNotifications() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        return await db.select()
            .from(notifications)
            .where(eq(notifications.userId, session.user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(20);
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
    }
}

export async function markNotificationRead(id: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        await db.update(notifications)
            .set({ read: 'yes' })
            .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)));
        revalidatePath("/");
    } catch (error) {
        console.error("Failed to mark notification as read:", error);
    }
}

/**
 * Comments
 */
export async function postComment(entityType: string, entityId: string, text: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        await db.insert(comments).values({
            userId: session.user.id,
            entityType,
            entityId,
            text,
        });

        // Log the comment action
        await logActivity('COMMENT', entityType, entityId, `User added a comment: ${text.substring(0, 50)}...`);

        revalidatePath(`/${entityType}s/${entityId}`); // Assumes standard paths
        return { success: true };
    } catch (error) {
        console.error("Failed to post comment:", error);
        return { success: false, error: "Failed to post comment" };
    }
}

export async function getComments(entityType: string, entityId: string) {
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
