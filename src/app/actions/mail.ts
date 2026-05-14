'use server'

import { sendEmail } from "@/lib/services/email";
import { auth } from "@/auth";
import { createNotification } from "./notifications";
import { db } from "@/db";
import { comments, suppliers, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { logActivity } from "./activity";
import { revalidatePath } from "next/cache";

function buildAppBaseUrl() {
    return process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * FIX: sendUserEmail now requires subject + body so no email is ever
 * sent with a blank subject or canned generic body.
 * Previously: sendUserEmail(to, userName) — auto-sent a canned message.
 * Now:        sendUserEmail(to, userName, subject, body) — user composes first.
 */
export async function sendUserEmail(
    to: string,
    userName: string,
    subject: string,
    body: string,
) {
    const session = await auth();
    if (!session) {
        return { success: false, error: "Not authenticated" };
    }


    if (!subject?.trim()) return { success: false, error: "Subject is required" };
    if (!body?.trim())    return { success: false, error: "Message body is required" };

    try {
        const result = await sendEmail({
            to,
            subject: subject.trim(),
            body: [
                `Dear ${userName},`,
                ``,
                body.trim(),
                ``,
                `Best Regards`,
                `Axiom`,
            ].join('\n'),
        });
        if (!result.success) {
            console.error("Failed to send user email:", result.error);
            return { success: false, error: result.error || "Failed to send email" };
        }
        return { success: true };
    } catch (error) {
        console.error("Failed to send user email:", error);
        return { success: false, error: "Failed to send email" };
    }
}

export async function sendEscalationPing(data: {
    leadId: string;
    leadName: string;
    leadEmail: string;
    department: string;
}) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    const senderName = session.user.name || session.user.email || "Axiom user";
    const senderEmail = session.user.email || undefined;
    const appBaseUrl = buildAppBaseUrl();
    const commandCenterUrl = `${appBaseUrl}/`;
    const exceptionQueueUrl = `${appBaseUrl}/sourcing/exceptions`;
    const requestedAt = new Date().toISOString();
    const recipientName = data.leadName.trim();

    const notification = await createNotification({
        userId: data.leadId,
        title: `High-priority escalation from ${senderName}`,
        message: `${senderName} requested immediate review. Open Axiom and review the live queue now.`,
        type: 'warning',
        link: '/sourcing/exceptions',
    });

    const emailResult = await sendEmail({
        to: data.leadEmail,
        replyTo: senderEmail,
        subject: `Axiom high-priority escalation for ${recipientName}`,
        body: [
            `Hello ${recipientName},`,
            ``,
            `This is a high-priority Axiom escalation that has been routed to you.`,
            ``,
            `Axiom escalation channels are used only for immediate issues that need owner attention. This is not a routine FYI or general notification.`,
            ``,
            `${senderName} triggered this escalation from the Axiom command center and requested direct review of the live operational queue.`,
            ``,
            `What to do now:`,
            `- Open Axiom and review the current alert / exception queue.`,
            `- Triage any blocked item that needs leadership, finance, procurement, or cross-functional intervention.`,
            `- Reply directly to the requester if the next action needs to happen outside the app.`,
            ``,
            `Axiom command center: ${commandCenterUrl}`,
            `Exception management queue: ${exceptionQueueUrl}`,
            ``,
            `If you are active in Axiom, the same escalation has also been posted as an in-app alert.`,
            ``,
            `Requested by: ${senderName}`,
            `Reply to: ${senderEmail || 'No reply email available'}`,
            `Triggered at (UTC): ${requestedAt}`,
            ``,
            `Regards,`,
            `Axiom Procurement Platform`,
        ].join('\n'),
    });

    await logActivity(
        'ESCALATE',
        'user',
        data.leadId,
        `Escalation ping sent to ${recipientName}. ${emailResult.success ? 'Email delivered.' : 'Email pending SMTP configuration or retry.'}`,
    );

    if (!notification.success && !emailResult.success) {
        return {
            success: false,
            error: emailResult.error || notification.error || "Failed to dispatch escalation ping",
        };
    }

    return {
        success: true,
        notificationDelivered: notification.success,
        emailDelivered: emailResult.success,
        warning: !emailResult.success ? emailResult.error : undefined,
    };
}

export async function sendSupplierMessage(data: {
    supplierId: string;
    subject: string;
    body: string;
    contextType?: 'part' | 'rfq' | 'order';
    contextId?: string;
    contextLabel?: string;
}) {
    const session = await auth();
    if (!session?.user?.id || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || !body) {
        return { success: false, error: "Subject and message are required." };
    }

    const [supplier] = await db
        .select({
            id: suppliers.id,
            name: suppliers.name,
            contactEmail: suppliers.contactEmail,
        })
        .from(suppliers)
        .where(eq(suppliers.id, data.supplierId))
        .limit(1);

    if (!supplier) {
        return { success: false, error: "Supplier not found." };
    }

    // Fetch portal users for this supplier so we can send in-app notifications
    const supplierPortalUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.role, 'supplier'), eq(users.supplierId, supplier.id)));

    const senderName = session.user.name || session.user.email || "Axiom procurement";
    const senderEmail = session.user.email || undefined;
    const threadReference = `SUP-${supplier.id.slice(0, 8).toUpperCase()}`;
    const portalUrl = `${buildAppBaseUrl()}/portal/profile`;
    const hasContext = Boolean(data.contextType && data.contextId);
    const contextLabel = data.contextLabel?.trim();
    const threadContextLines = hasContext
        ? [
            `Context: ${contextLabel || `${data.contextType} workflow`}`,
            `Reference: ${data.contextType?.toUpperCase()}-${data.contextId?.slice(0, 8).toUpperCase()}`,
            ``,
        ]
        : [];
    const threadBody = [
        ...threadContextLines,
        `Subject: ${subject}`,
        ``,
        body,
    ].join('\n');

    // Log primary supplier message thread
    await db.insert(comments).values({
        userId: session.user.id,
        entityType: 'supplier_message',
        entityId: supplier.id,
        text: threadBody,
    });

    // Log context-specific thread entry if applicable
    if (hasContext && data.contextType && data.contextId) {
        await db.insert(comments).values({
            userId: session.user.id,
            entityType: `${data.contextType}_supplier_message`,
            entityId: data.contextId,
            text: [
                `Supplier: ${supplier.name}`,
                `Subject: ${subject}`,
                `Thread: ${threadReference}`,
                ``,
                body,
            ].join('\n'),
        });
    }

    // Send in-app notifications to portal users
    const notificationResults = await Promise.allSettled(
        supplierPortalUsers.map((user) =>
            createNotification({
                userId: user.id,
                title: `New message from ${senderName}`,
                message: `${subject} — open Axiom to review the supplier thread.`,
                type: 'info',
                link: '/portal/profile',
            }),
        ),
    );

    const deliveredPortalNotifications = notificationResults.filter(
        (result) => result.status === 'fulfilled' && result.value.success,
    ).length;

    // Send outbound email (graceful when SMTP not configured)
    const emailResult = await sendEmail({
        to: supplier.contactEmail,
        replyTo: senderEmail,
        subject: `[Axiom] ${subject}`,
        body: [
            `Hello ${supplier.name},`,
            ``,
            `${senderName} sent a procurement message from Axiom.`,
            ``,
            `Subject: ${subject}`,
            ``,
            body,
            ``,
            `Axiom thread reference: ${threadReference}`,
            `Open the shared supplier thread: ${portalUrl}`,
            ``,
            `Regards,`,
            `Axiom Procurement Intelligence`,
        ].join('\n'),
    });

    await logActivity(
        'MESSAGE',
        'supplier',
        supplier.id,
        `Sent supplier message "${subject}" to ${supplier.contactEmail}. Thread ${threadReference}. ${emailResult.success ? 'Email delivered.' : 'Email pending SMTP configuration or retry.'}`,
    );

    if (hasContext && data.contextType && data.contextId) {
        await logActivity(
            'MESSAGE',
            data.contextType,
            data.contextId,
            `Sent supplier message to ${supplier.name} regarding ${contextLabel || data.contextType}. Subject: "${subject}". Thread ${threadReference}.`,
        );
    }

    revalidatePath(`/suppliers/${supplier.id}`);
    revalidatePath("/suppliers");
    revalidatePath("/portal/profile");
    if (data.contextType === 'part') {
        revalidatePath("/sourcing/parts");
    }
    if (data.contextType === 'rfq' && data.contextId) {
        revalidatePath(`/sourcing/rfqs/${data.contextId}`);
    }
    if (data.contextType === 'order' && data.contextId) {
        revalidatePath(`/sourcing/orders/${data.contextId}`);
    }

    return {
        success: true,
        portalRecipients: deliveredPortalNotifications,
        emailDelivered: emailResult.success,
        warning: emailResult.success ? undefined : emailResult.error,
        threadReference,
    };
}

export async function getContextualSupplierMessages(
    contextType: 'part' | 'rfq' | 'order',
    contextId: string,
) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') {
        return [];
    }

    try {
        return await db.select({
            id: comments.id,
            text: comments.text,
            createdAt: comments.createdAt,
            userName: users.name,
        })
            .from(comments)
            .innerJoin(users, eq(comments.userId, users.id))
            .where(and(
                eq(comments.entityType, `${contextType}_supplier_message`),
                eq(comments.entityId, contextId),
            ))
            .orderBy(desc(comments.createdAt));
    } catch (error) {
        console.error("Failed to fetch contextual supplier messages:", error);
        return [];
    }
}