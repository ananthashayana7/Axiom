'use server'

import { signIn, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { TotpService } from "@/lib/totp";

import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        const identifier = formData.get('identifier') as string;
        const password = formData.get('password') as string;
        const code = formData.get('code') as string;

        // Determine post-login redirect based on user's role
        let redirectTo = '/';
        try {
            const [userRecord] = await db
                .select({ role: users.role })
                .from(users)
                .where(ilike(users.email, identifier))
                .limit(1);
            if (userRecord?.role === 'admin') redirectTo = '/admin';
            else if (userRecord?.role === 'supplier') redirectTo = '/portal';
        } catch { /* fallback to '/' */ }

        await signIn('credentials', {
            identifier,
            password,
            code,
            redirectTo,
        });
    } catch (error) {
        if (isRedirectError(error)) {
            throw error;
        }

        // Avoid JSON.stringify(error.cause) as it can cause circular reference crashes
        console.warn("[AUTH ACTION] Sign-in failure detected");

        const errorMsg = error.message || '';
        // Safer way to access cause-bound messages
        let causeMsg = '';
        if (error.cause && typeof error.cause === 'object') {
            const cause = error.cause as any;
            causeMsg = cause.err?.message || cause.message || '';
        }

        if (errorMsg.includes('require-2fa') || causeMsg.includes('require-2fa')) {
            return 'require-2fa';
        }

        if (errorMsg.includes('setup-2fa') || causeMsg.includes('setup-2fa')) {
            // Set up 2FA server-side using the identifier — no session needed here
            // because the password was already verified in authorize() before this error was thrown.
            const identifier = formData.get('identifier') as string;
            const setupResult = await setupTwoFactorForLogin(identifier);
            if (setupResult.success && setupResult.qrCodeUrl) {
                // Embed QR code URL and secret (for manual entry fallback) in the return value
                return `setup-2fa:${setupResult.qrCodeUrl}|${setupResult.secret || ''}`;
            }
            return 'setup-2fa';
        }

        if (error instanceof AuthError) {
            const type = error.type as string;
            if (type === 'CredentialsSignin') {
                return 'Invalid credentials. Please verify your email address and password.';
            }
            return `Authentication Error: ${type}`;
        }

        return error.message || 'An unexpected error occurred. Please try again.';
    }
}

/**
 * Sets up 2FA for a user identified by email during the login flow,
 * without requiring an active session (password has already been verified by authorize()).
 * If the user already has a stored secret (from a previous incomplete setup), reuse it
 * instead of generating a new one — this prevents the "setup shows again" bug.
 */
async function setupTwoFactorForLogin(identifier: string) {
    try {
        const [user] = await db
            .select({ id: users.id, email: users.email, twoFactorSecret: users.twoFactorSecret, isTwoFactorEnabled: users.isTwoFactorEnabled })
            .from(users)
            .where(ilike(users.email, identifier))
            .limit(1);

        if (!user) return { success: false as const };

        // If 2FA is already fully enabled, don't overwrite — user should be using require-2fa flow
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
            return { success: false as const };
        }

        // Reuse existing secret from a previous incomplete setup, or generate a new one
        const secret = user.twoFactorSecret || TotpService.generateSecret();
        const otpauthUrl = TotpService.getOtpAuthUrl(secret, user.email);

        // Only write to DB if we generated a new secret
        if (!user.twoFactorSecret) {
            await db.update(users)
                .set({ twoFactorSecret: secret })
                .where(eq(users.id, user.id));
        }

        return {
            success: true as const,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
            secret,
        };
    } catch (error) {
        console.error("Failed to set up 2FA during login:", error);
        return { success: false as const };
    }
}

export async function setupTwoFactor() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        // Guard: don't overwrite an already-enabled 2FA setup
        const [existingUser] = await db.select({
            isTwoFactorEnabled: users.isTwoFactorEnabled,
            twoFactorSecret: users.twoFactorSecret,
        }).from(users).where(eq(users.id, session.user.id));

        if (existingUser?.isTwoFactorEnabled && existingUser?.twoFactorSecret) {
            return { success: false, error: "2FA is already enabled. Disable it first to reconfigure." };
        }

        // Reuse existing secret from incomplete setup, or generate fresh one
        const secret = existingUser?.twoFactorSecret || TotpService.generateSecret();
        const email = session.user.email || 'user';
        const otpauthUrl = TotpService.getOtpAuthUrl(secret, email);

        // Only write to DB if we generated a new secret
        if (!existingUser?.twoFactorSecret) {
            await db.update(users)
                .set({ twoFactorSecret: secret })
                .where(eq(users.id, session.user.id));
        }

        return {
            success: true,
            secret,
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`
        };
    } catch (error) {
        console.error("Failed to setup 2FA:", error);
        return { success: false, error: "Failed to setup 2FA" };
    }
}


export async function verifyAndEnableTwoFactor(token: string, identifier?: string) {
    let userId: string;

    if (identifier) {
        // Called during login flow — no session yet; password was already verified by authorize()
        const [user] = await db.select({ id: users.id }).from(users).where(ilike(users.email, identifier)).limit(1);
        if (!user) return { success: false, error: "User not found" };
        userId = user.id;
    } else {
        // Called from settings page — requires an active session
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }
        userId = session.user.id;
    }

    try {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (!user || !user.twoFactorSecret) {
            return { success: false, error: "2FA not initialized" };
        }

        const isValid = TotpService.verifyToken(user.twoFactorSecret, token);
        if (!isValid) {
            return { success: false, error: "Invalid verification code" };
        }

        await db.update(users)
            .set({ isTwoFactorEnabled: true })
            .where(eq(users.id, userId));

        revalidatePath("/admin/settings");
        return { success: true, message: "Two-factor authentication enabled successfully" };
    } catch (error) {
        console.error("Failed to verify 2FA:", error);
        return { success: false, error: "Failed to verify 2FA" };
    }
}

export async function disableTwoFactor() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        await db.update(users)
            .set({ twoFactorSecret: null, isTwoFactorEnabled: false })
            .where(eq(users.id, session.user.id));

        revalidatePath("/admin/settings");
        return { success: true, message: "Two-factor authentication disabled" };
    } catch (error) {
        console.error("Failed to disable 2FA:", error);
        return { success: false, error: "Failed to disable 2FA" };
    }
}

export async function changePassword(currentPassword: string, newPassword: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    // Server-side password validation
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long" };
    }

    try {
        // Get current user
        const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Verify current password
        const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordsMatch) {
            return { success: false, error: "Current password is incorrect" };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, session.user.id));

        revalidatePath("/profile");
        return { success: true, message: "Password changed successfully" };
    } catch (error) {
        console.error("Failed to change password:", error);
        return { success: false, error: "Failed to change password" };
    }
}

export async function getUserProfile() {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }

    try {
        const [user] = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            employeeId: users.employeeId,
            role: users.role,
            twoFactorEnabled: users.isTwoFactorEnabled,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.id, session.user.id));

        return user;
    } catch (error) {
        console.error("Failed to get user profile:", error);
        return null;
    }
}

export async function updateProfile(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const employeeId = formData.get("employeeId") as string;

        await db.update(users)
            .set({ name, email, employeeId })
            .where(eq(users.id, session.user.id));

        revalidatePath("/profile");
        return { success: true, message: "Profile updated successfully" };
    } catch (error) {
        console.error("Failed to update profile:", error);
        return { success: false, error: "Failed to update profile" };
    }
}
