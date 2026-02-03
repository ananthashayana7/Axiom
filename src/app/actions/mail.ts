'use server'

import { sendEmail } from "@/lib/services/email";
import { auth } from "@/auth";

export async function sendUserEmail(to: string, userName: string) {
    const session = await auth();
    if (!session) {
        return { success: false, error: "Not authenticated" };
    }

    const senderName = session.user?.name || "Axiom Admin";

    try {
        await sendEmail({
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
        return { success: true };
    } catch (error) {
        console.error("Failed to send user email:", error);
        return { success: false, error: "Failed to send email" };
    }
}
