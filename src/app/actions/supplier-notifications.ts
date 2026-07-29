'use server'

import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/services/email';
import {
    generateSupplierUnderReviewEmail,
    generateSupplierApprovedEmail,
    generateSupplierRejectedEmail,
} from '@/lib/services/email';
import { logActivity } from './activity';

type SupplierStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
type SupplierLifecycleStatus = 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';

export async function notifySupplierStatusChange(
    supplierId: string,
    newStatus: SupplierStatus,
    newLifecycleStatus: SupplierLifecycleStatus,
    reason?: string
) {
    try {
        const [supplier] = await db.select()
            .from(suppliers)
            .where(eq(suppliers.id, supplierId))
            .limit(1);

        if (!supplier) {
            console.error(`Supplier not found: ${supplierId}`);
            return { success: false, error: 'Supplier not found' };
        }

        // Don't send notifications for unverified emails
        if (!supplier.emailVerified) {
            return { success: true, notified: false, reason: 'Email not yet verified' };
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
        const portalLink = `${baseUrl}/portal`;
        let emailData;
        let shouldNotify = false;

        // Determine which notification to send based on status change
        if (newLifecycleStatus === 'onboarding' && newStatus === 'inactive') {
            // Status changed to under review
            emailData = generateSupplierUnderReviewEmail(supplier.name, portalLink);
            shouldNotify = true;
        } else if (newLifecycleStatus === 'active' && newStatus === 'active') {
            // Supplier approved - but we need a temp password
            // This is handled separately in the approval flow, so we'll skip here
            return { success: true, notified: false, reason: 'Handled in approval flow' };
        } else if (newStatus === 'terminated' || newStatus === 'suspended') {
            // Supplier rejected or suspended
            emailData = generateSupplierRejectedEmail(supplier.name, reason);
            shouldNotify = true;
        }

        if (!shouldNotify || !emailData) {
            return { success: true, notified: false, reason: 'No notification needed for this status' };
        }

        // Send the email
        await sendEmail({
            to: supplier.contactEmail,
            subject: emailData.subject,
            body: emailData.body,
        });

        // Log the activity
        await logActivity(
            'status_notification_sent',
            'supplier',
            supplierId,
            `Notification sent for status change to ${newStatus} (${newLifecycleStatus})`,
        );

        return { success: true, notified: true };
    } catch (error) {
        console.error('Failed to notify supplier of status change:', error);
        return { success: false, error: 'Failed to send notification' };
    }
}

/**
 * Notify supplier when their portal credentials are activated
 */
export async function notifySupplierApproved(
    supplierId: string,
    portalEmail: string,
    temporaryPassword: string
) {
    try {
        const [supplier] = await db.select()
            .from(suppliers)
            .where(eq(suppliers.id, supplierId))
            .limit(1);

        if (!supplier) {
            console.error(`Supplier not found: ${supplierId}`);
            return { success: false, error: 'Supplier not found' };
        }

        if (!supplier.emailVerified) {
            return { success: false, error: 'Supplier email not verified' };
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
        const portalLink = `${baseUrl}/portal`;

        const emailData = generateSupplierApprovedEmail(
            supplier.name,
            portalLink,
            temporaryPassword
        );

        await sendEmail({
            to: supplier.contactEmail,
            subject: emailData.subject,
            body: emailData.body,
        });

        await logActivity(
            'approval_notification_sent',
            'supplier',
            supplierId,
            `Supplier notified of approval and portal activation (email: ${portalEmail})`,
        );

        return { success: true };
    } catch (error) {
        console.error('Failed to notify supplier approval:', error);
        return { success: false, error: 'Failed to send approval notification' };
    }
}
