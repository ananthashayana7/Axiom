'use server'

import { sendEmail } from "@/lib/services/email";
import { auth } from "@/auth";
import { createNotification } from "./notifications";

export async function sendUserEmail(to: string, userName: string) {
    const session = await auth();
    if (!session) {
        return { success: false, error: "Not authenticated" };
    }

    const senderName = session.user?.name || "Axiom Admin";

    try {
        const result = await sendEmail({
            to,
            subject: `Message from ${senderName} via Axiom`,
            body: `
Dear ${userName},

You have received a notification from ${senderName} via the Axiom Procurement Platform.

Message content:
--------------------------------------------------
Please follow up on the latest requisition/supplier updates on your dashboard.
--------------------------------------------------

This is an automated message sent from a no-reply address. Please do not reply directly to this email.

Best regards,
The Axiom Team
            `.trim()
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

    const notification = await createNotification({
        userId: data.leadId,
        title: `Escalation request from ${senderName}`,
        message: `${senderName} requested help from ${data.department}. Please review the escalation in Axiom.`,
        type: 'warning',
        link: '/',
    });

    const emailResult = await sendEmail({
        to: data.leadEmail,
        replyTo: senderEmail,
        subject: `Axiom escalation: ${data.department}`,
        body: `
Hello ${data.leadName},

${senderName} triggered an escalation for ${data.department} from the Axiom command center.

Please log in to Axiom and review the latest alert queue for this department.

Requested by: ${senderName}
Reply to: ${senderEmail || 'No reply email available'}

Regards,
Axiom Procurement Platform
        `.trim(),
    });

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
