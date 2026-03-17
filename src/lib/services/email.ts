import nodemailer from 'nodemailer';

export interface EmailPayload {
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
}

export interface EmailSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

const SUPPORT_EMAIL = 'pma.axiom.support@gmail.com';

export async function sendEmail({ to, subject, body, replyTo }: EmailPayload) {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const rawPort = Number(process.env.SMTP_PORT || 587);
    const smtpPort = Number.isFinite(rawPort) && rawPort > 0 && rawPort <= 65_535 ? rawPort : 587;
    const smtpUser = process.env.SMTP_USER || SUPPORT_EMAIL;
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
    const smtpFrom = process.env.SMTP_FROM || SUPPORT_EMAIL;

    if (!smtpPass) {
        console.warn("[EMAIL] SMTP not configured. Provide SMTP_PASS (or SMTP_PASSWORD). Set SMTP_HOST if you use a provider other than the default smtp.gmail.com (other SMTP_* values are optional).");
        return {
            success: false,
            error: 'SMTP_NOT_CONFIGURED',
        } as EmailSendResult;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
            connectionTimeout: 15_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        });

        // Fail fast if the SMTP connection/auth is not accepted
        await transporter.verify();

        const info = await transporter.sendMail({
            from: smtpFrom,
            to,
            replyTo: replyTo || smtpFrom,
            subject,
            text: body,
        });

        console.log(`[EMAIL] SENT | host=${smtpHost} | from=${smtpFrom} | to=${to} | messageId=${info.messageId}`);
        return {
            success: true,
            messageId: info.messageId,
        } as EmailSendResult;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP error';
        const context = `host=${smtpHost} port=${smtpPort} secure=${smtpSecure}`;
        console.error(`[EMAIL] SEND_FAILED | ${context} | to=${to} | subject=${subject} | error=${errorMessage}`);
        return {
            success: false,
            error: `SMTP connection failed: ${errorMessage}`,
        } as EmailSendResult;
    }
}

export async function sendSupportTicket(fromEmail: string, fromName: string, subject: string, description: string) {
    return sendEmail({
        to: SUPPORT_EMAIL,
        replyTo: fromEmail,
        subject: `[Support] ${subject}`,
        body: `Support request from Axiom Platform\n\nFrom: ${fromName} <${fromEmail}>\nSubject: ${subject}\n\n${description}\n\n---\nAxiom Support | pma.axiom.support@gmail.com`,
    });
}

export function generateWelcomeEmail(name: string, email: string, tempPassword: string) {
    return {
        subject: `Welcome to Axiom, ${name}!`,
        body: `Hello ${name},

Welcome to Axiom Procurement Platform! Your account has been created.

Login credentials:
Email: ${email}
Temporary Password: ${tempPassword}

Please log in and change your password immediately.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim()
    };
}
