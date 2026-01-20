export interface EmailPayload {
    to: string;
    subject: string;
    body: string;
}

export async function sendEmail({ to, subject, body }: EmailPayload) {
    // In a real production app, you would use SendGrid, AWS SES, or Nodemailer
    // For this development phase, we'll log the email and simulate a successful dispatch
    console.log("==========================================");
    console.log(`SENDING EMAIL TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log("==========================================");

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 500));

    return { success: true, messageId: `msg_${Math.random().toString(36).substring(7)}` };
}

export function generateWelcomeEmail(name: string, email: string, tempPassword: string) {
    return {
        subject: `Welcome to Axiom, ${name}!`,
        body: `
Hello ${name},

Welcome to Axiom Procurement Platform! An account has been created for you.

Your login credentials are:
Email/Employee ID: ${email}
Temporary Password: ${tempPassword}

Please log in at http://localhost:3000/login and change your password immediately.

Best regards,
The Axiom Team
        `.trim()
    };
}
