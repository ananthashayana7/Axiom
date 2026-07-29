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

export function generateSupplierPortalWelcomeEmail(name: string, email: string, tempPassword: string) {
    return {
        subject: `Axiom supplier portal access approved for ${name}`,
        body: `Hello ${name},

Your supplier onboarding has been approved in Axiom, and your portal access is now ready.

Portal login:
Email: ${email}
Temporary Password: ${tempPassword}

What to do next:
- Sign in to the Axiom supplier portal
- Complete 2FA setup on first login
- Review open requests, documents, and active orders in your portal workspace

This credential is intended for immediate activation. Please sign in and change your password after setup.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim(),
    };
}

export function generateSupplierEmailVerificationEmail(name: string, verificationLink: string) {
    return {
        subject: `Verify your email for Axiom Supplier Registration`,
        body: `Hello ${name},

Thank you for registering with Axiom! To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours. If you did not create this account, you can safely ignore this email.

Once your email is verified, an Axiom administrator will review your registration and guide you through the onboarding process.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim(),
    };
}

export function generateSupplierUnderReviewEmail(name: string, supplierPortalLink: string) {
    return {
        subject: `Your Axiom supplier registration is under review`,
        body: `Hello ${name},

Thank you for verifying your email! Your supplier registration has been received and is now under review by our Axiom team.

What to expect next:
- Our team will review your company information and certifications
- You may be asked to provide additional documentation or evidence
- We'll keep you updated on the progress via email
- Typical review time: 1-2 business days

You can track your onboarding progress anytime by visiting:
${supplierPortalLink}

If you have any questions during this process, please don't hesitate to reach out to us.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim(),
    };
}

export function generateSupplierApprovedEmail(name: string, portalLink: string, tempPassword: string) {
    return {
        subject: `Welcome! Your Axiom supplier account is now active`,
        body: `Hello ${name},

Congratulations! Your supplier registration has been approved, and your Axiom portal account is now active.

Portal access:
${portalLink}
Email: ${name}
Temporary Password: ${tempPassword}

What you can do now:
- Browse active purchase orders and requests
- Submit proposals and quotes
- Upload compliance documents
- Track delivery schedules and performance metrics
- Collaborate with our procurement team

Important: Please sign in immediately and change your temporary password for security.

If you need any assistance, our support team is available at pma.axiom.support@gmail.com

Best regards,
The Axiom Team`.trim(),
    };
}

export function generateSupplierRejectedEmail(name: string, reason?: string) {
    return {
        subject: `Update on your Axiom supplier registration`,
        body: `Hello ${name},

Thank you for your interest in joining the Axiom Procurement Network.

After careful review, we are unable to proceed with your application at this time.${reason ? `\n\nReason: ${reason}` : ''}

If you would like more information about this decision or would like to reapply in the future, please contact our team at pma.axiom.support@gmail.com.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim(),
    };
}

export function generatePasswordResetEmail(name: string, resetLink: string) {
    return {
        subject: `Reset your Axiom password`,
        body: `Hello ${name},

We received a request to reset your Axiom password. Click the link below to create a new password:

${resetLink}

This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.

For security reasons, never share this link with anyone.

Best regards,
The Axiom Team
pma.axiom.support@gmail.com`.trim(),
    };
}
