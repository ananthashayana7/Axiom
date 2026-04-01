'use server'

import { db } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";
import { logActivity } from "./activity";
import crypto from "crypto";

// ─── Webhook CRUD ─────────────────────────────────────────────────────

export async function getWebhooks() {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return [];

    try {
        return await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
    } catch (error) {
        console.error("Failed to fetch webhooks:", error);
        return [];
    }
}

export async function createWebhook(data: {
    url: string;
    events: string[];
    description?: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can manage webhooks" };
    }

    try {
        // Generate a signing secret
        const secret = crypto.randomBytes(32).toString('hex');

        const [webhook] = await db.insert(webhooks).values({
            url: data.url,
            events: data.events,
            secret,
            description: data.description,
            createdById: session.user.id,
            isActive: 'yes',
        }).returning();

        await logActivity('CREATE', 'webhook', webhook.id, `Webhook created for ${data.url} — Events: ${data.events.join(', ')}`);

        return { success: true, data: { id: webhook.id, secret } };
    } catch (error) {
        console.error("Failed to create webhook:", error);
        return { success: false, error: "Failed to create webhook" };
    }
}

export async function deleteWebhook(id: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can manage webhooks" };
    }

    try {
        await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, id));
        await db.delete(webhooks).where(eq(webhooks.id, id));
        await logActivity('DELETE', 'webhook', id, `Webhook deleted`);
        return { success: true };
    } catch (error) {
        console.error("Failed to delete webhook:", error);
        return { success: false, error: "Failed to delete webhook" };
    }
}

// ─── Webhook Triggering ────────────────────────────────────────────────

export async function triggerWebhook(event: string, payload: Record<string, unknown>) {
    try {
        // Find all active webhooks that subscribe to this event
        const activeWebhooks = await db
            .select()
            .from(webhooks)
            .where(eq(webhooks.isActive, 'yes'));

        const matchingWebhooks = activeWebhooks.filter(w =>
            w.events.includes(event)
        );

        if (matchingWebhooks.length === 0) return;

        const deliveries = matchingWebhooks.map(webhook => ({
            webhookId: webhook.id,
            event,
            payload: JSON.stringify({
                event,
                timestamp: new Date().toISOString(),
                data: payload,
            }),
            status: 'pending' as const,
            attempts: 0,
        }));

        await db.insert(webhookDeliveries).values(deliveries);

        // Update lastTriggeredAt
        for (const webhook of matchingWebhooks) {
            await db.update(webhooks)
                .set({ lastTriggeredAt: new Date() })
                .where(eq(webhooks.id, webhook.id));
        }
    } catch (error) {
        console.error("[Webhook] Trigger failed:", error);
    }
}

// ─── Webhook Delivery History ──────────────────────────────────────────

export async function getWebhookDeliveries(webhookId: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return [];

    try {
        return await db.select()
            .from(webhookDeliveries)
            .where(eq(webhookDeliveries.webhookId, webhookId))
            .orderBy(desc(webhookDeliveries.createdAt))
            .limit(50);
    } catch (error) {
        console.error("Failed to fetch deliveries:", error);
        return [];
    }
}
