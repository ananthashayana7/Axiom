import { sendEmail } from '../src/lib/services/email';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function test() {
    console.log('Testing SMTP connection with updated credentials...');
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASS length:', process.env.SMTP_PASS?.length);

    const result = await sendEmail({
        to: 'pma.axiom.support@gmail.com',
        subject: 'SMTP Connection Test',
        body: 'This is a test email to verify SMTP configuration after updating with App Password.'
    });

    if (result.success) {
        console.log('✅ SMTP Connection and Email Send SUCCESSFUL!');
        console.log('Message ID:', result.messageId);
    } else {
        console.error('❌ SMTP Connection FAILED!');
        console.error('Error:', result.error);
    }
}

test().catch(console.error);
