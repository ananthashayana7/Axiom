'use server'

import { db } from "@/db";
import { notifications, type Notification } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";

export async function getNotifications() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const userNotifs = await db.select()
            .from(notifications)
            .where(eq(notifications.userId, session.user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(50);

        return userNotifs;
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
    }
}

export async function createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    link?: string;
}) {
    try {
        await db.insert(notifications).values({
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type || 'info',
            link: data.link,
        });

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Failed to create notification:", error);
        return { success: false, error: "Failed to create notification" };
    }
}

export async function markNotificationAsRead(id: string) {
    try {
        await db.update(notifications)
            .set({ isRead: 'yes' })
            .where(eq(notifications.id, id));

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark notification as read:", error);
        return { success: false, error: "Failed to mark notification as read" };
    }
}

export async function markAllNotificationsAsRead() {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    try {
        await db.update(notifications)
            .set({ isRead: 'yes' })
            .where(eq(notifications.userId, session.user.id));

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Failed to mark all notifications as read:", error);
        return { success: false };
    }
}
