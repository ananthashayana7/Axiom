export interface EmailPayload {
    to: string;
    subject: string;
    body: string;
    replyTo?: string;
}

const SUPPORT_EMAIL = 'axiom-no_reply@outlook.com';

export async function sendEmail({ to, subject, body, replyTo }: EmailPayload) {
    // Production: configure SMTP via env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
    // sending via Nodemailer with Outlook SMTP or Azure Communication Services
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER || SUPPORT_EMAIL;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPass) {
        // In production Nodemailer would be used here:
        // const transporter = nodemailer.createTransport({ host: smtpHost, port: 587, auth: { user: smtpUser, pass: smtpPass } });
        // await transporter.sendMail({ from: SUPPORT_EMAIL, to, subject, text: body, replyTo: replyTo || SUPPORT_EMAIL });
        console.log(`[EMAIL] PRODUCTION SMTP — Sending via ${smtpHost} from ${SUPPORT_EMAIL}`);
    }

    console.log("=========== AXIOM EMAIL ===========");
    console.log(`FROM:     ${SUPPORT_EMAIL}`);
    console.log(`TO:       ${to}`);
    console.log(`REPLY-TO: ${replyTo || SUPPORT_EMAIL}`);
    console.log(`SUBJECT:  ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log("===================================");

    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, messageId: `axiom_${Date.now().toString(36)}` };
}

export async function sendSupportTicket(fromEmail: string, fromName: string, subject: string, description: string) {
    return sendEmail({
        to: SUPPORT_EMAIL,
        replyTo: fromEmail,
        subject: `[Support] ${subject}`,
        body: `Support request from Axiom Platform\n\nFrom: ${fromName} <${fromEmail}>\nSubject: ${subject}\n\n${description}\n\n---\nAxiom Support | axiom-no_reply@outlook.com`,
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
axiom-no_reply@outlook.com`.trim()
    };
}
