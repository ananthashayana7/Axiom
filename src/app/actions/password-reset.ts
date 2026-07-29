'use server'

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail, generatePasswordResetEmail } from '@/lib/services/email';
import { generateVerificationToken, getVerificationTokenExpiresAt } from '@/lib/email-verification';
import bcrypt from 'bcryptjs';

/**
 * Request password reset for a user by email
 */
export async function requestPasswordReset(email: string) {
    try {
        const normalizedEmail = email.trim().toLowerCase();

        // Find user by email
        const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (!user) {
            // Don't reveal whether email exists for security
            return { success: true, message: 'If an account exists with this email, you will receive a password reset link.' };
        }

        // Generate reset token
        const resetToken = generateVerificationToken();
        const resetTokenExpiresAt = new Date();
        resetTokenExpiresAt.setHours(resetTokenExpiresAt.getHours() + 1); // Expire in 1 hour

        // Save reset token to database
        await db.update(users)
            .set({
                resetToken,
                resetTokenExpiresAt,
            })
            .where(eq(users.id, user.id));

        // Generate reset link
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
        const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

        // Send reset email
        const emailData = generatePasswordResetEmail(user.name, resetLink);
        await sendEmail({
            to: user.email,
            subject: emailData.subject,
            body: emailData.body,
        });

        return { success: true, message: 'If an account exists with this email, you will receive a password reset link.' };
    } catch (error) {
        console.error('Failed to request password reset:', error);
        return { success: false, error: 'Failed to process password reset request. Please try again.' };
    }
}

/**
 * Verify reset token and reset password
 */
export async function resetPassword(token: string, newPassword: string) {
    try {
        if (!token?.trim()) {
            return { success: false, error: 'Reset token is required' };
        }

        if (!newPassword || newPassword.length < 8) {
            return { success: false, error: 'Password must be at least 8 characters' };
        }

        // Validate password complexity
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumbers = /\d/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            return {
                success: false,
                error: 'Password must contain uppercase, lowercase, numbers, and special characters',
            };
        }

        // Find user by reset token
        const [user] = await db.select({ id: users.id, email: users.email, resetTokenExpiresAt: users.resetTokenExpiresAt })
            .from(users)
            .where(eq(users.resetToken, token))
            .limit(1);

        if (!user) {
            return { success: false, error: 'Invalid or expired reset token' };
        }

        // Check if token is still valid
        if (!user.resetTokenExpiresAt || new Date() > new Date(user.resetTokenExpiresAt)) {
            // Clear expired token
            await db.update(users)
                .set({ resetToken: null, resetTokenExpiresAt: null })
                .where(eq(users.id, user.id));
            return { success: false, error: 'Reset token has expired. Please request a new one.' };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset token
        await db.update(users)
            .set({
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiresAt: null,
            })
            .where(eq(users.id, user.id));

        return { success: true, message: 'Password reset successfully. You can now log in with your new password.' };
    } catch (error) {
        console.error('Failed to reset password:', error);
        return { success: false, error: 'Failed to reset password. Please try again.' };
    }
}
