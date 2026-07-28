'use server'

import { signIn, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { TotpService } from "@/lib/totp";
import QRCode from "qrcode";
import { consumeRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { enforceServerActionRateLimit } from "@/lib/server-action-rate-limit";

import { isRedirectError } from "next/dist/client/components/redirect-error";

export type AuthenticateResult =
    | { status: 'success'; redirectUrl: string }
    | { status: 'require-2fa' }
    | { status: 'setup-2fa'; qrCodeUrl: string; secret?: string }
    | { status: 'error'; message: string };

function normalizeIdentifier(identifier: FormDataEntryValue | null) {
    return String(identifier || '').trim().toLowerCase();
}

function emailEquals(identifier: string) {
    return sql`lower(${users.email}) = ${identifier}`;
}

async function getAuthClientIp() {
    const headerList = await headers();
    const forwarded = headerList.get('x-forwarded-for');
    const forwardedIp = forwarded?.split(',')[0]?.trim();
    return forwardedIp || headerList.get('x-real-ip') || 'unknown';
}

export async function authenticate(
    prevState: AuthenticateResult | undefined,
    formData: FormData,
): Promise<AuthenticateResult> {
    try {
        const identifier = normalizeIdentifier(formData.get('identifier'));
        const password = String(formData.get('password') || '');
        const code = String(formData.get('code') || '');
        const roleMode = ((formData.get('roleMode') as string) || 'user') as 'admin' | 'user' | 'supplier';

        if (!identifier || !password) {
            return { status: 'error', message: 'Enter your email address and password.' };
        }

        const clientIp = await getAuthClientIp();
        const [identifierRateCheck, ipRateCheck] = await Promise.all([
            consumeRateLimit('auth', `identifier:${identifier}`),
            consumeRateLimit('auth', `ip:${clientIp}`),
        ]);

        if (!identifierRateCheck.allowed || !ipRateCheck.allowed) {
            return { status: 'error', message: 'Too many login attempts. Please try again later.' };
        }

        // Determine post-login redirect based on user's role
        let redirectTo = '/';
        try {
            const [userRecord] = await db
                .select({ role: users.role })
                .from(users)
                .where(emailEquals(identifier))
                .limit(1);

            if (userRecord?.role && userRecord.role !== roleMode) {
                if (roleMode === 'admin') {
                    return { status: 'error', message: 'Use the Admin Console only with an administrator account.' };
                }
                if (roleMode === 'supplier') {
                    return { status: 'error', message: 'Use the Supplier Portal only with a supplier account.' };
                }
                return { status: 'error', message: 'Use the Internal Workspace only with an internal user account.' };
            }

            if (userRecord?.role === 'admin') redirectTo = '/admin';
            else if (userRecord?.role === 'supplier') redirectTo = '/portal';
        } catch { /* fallback to '/' */ }

        const redirectUrl = await signIn('credentials', {
            identifier,
            password,
            code,
            redirect: false,
            redirectTo,
        });

        if (typeof redirectUrl === 'string') {
            return { status: 'success', redirectUrl };
        }

        return { status: 'error', message: 'Authentication failed. Please try again.' };
    } catch (error: unknown) {
        if (isRedirectError(error)) {
            throw error;
        }

        // Avoid JSON.stringify(error.cause) as it can cause circular reference crashes
        console.warn("[AUTH ACTION] Sign-in failure detected");

        const err = error as Error & { cause?: unknown };
        const errorMsg = err.message || '';
        // Safer way to access cause-bound messages
        let causeMsg = '';
        if (err.cause && typeof err.cause === 'object') {
            const cause = err.cause as Record<string, unknown>;
            const causeErr = cause.err as Error | undefined;
            causeMsg = causeErr?.message || (cause.message as string) || '';
        }

        const authErr = error as AuthError & { type?: string };
        const errType = (authErr.type as string) || '';

        if (errType === 'require-2fa' || errorMsg.includes('require-2fa') || causeMsg.includes('require-2fa')) {
            return { status: 'require-2fa' };
        }

        if (errType === 'setup-2fa' || errorMsg.includes('setup-2fa') || causeMsg.includes('setup-2fa')) {
            // Set up 2FA server-side using the identifier — no session needed here
            // because the password was already been verified in authorize() before this error was thrown.
            const identifier = normalizeIdentifier(formData.get('identifier'));
            const setupResult = await setupTwoFactorForLogin(identifier);
            if (setupResult.success && setupResult.qrCodeUrl) {
                return {
                    status: 'setup-2fa',
                    qrCodeUrl: setupResult.qrCodeUrl,
                    secret: setupResult.secret,
                };
            }
            return { status: 'setup-2fa', qrCodeUrl: '', secret: undefined };
        }

        if (error instanceof AuthError) {
            const type = error.type as string;
            if (type === 'CredentialsSignin') {
                return { status: 'error', message: 'Invalid credentials. Please verify your email address and password.' };
            }
            return { status: 'error', message: `Authentication Error: ${type}` };
        }

        return { status: 'error', message: err.message || 'An unexpected error occurred. Please try again.' };
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
            .where(emailEquals(identifier))
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

        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, { width: 200 });
        return {
            success: true as const,
            qrCodeUrl,
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

        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, { width: 200 });
        return {
            success: true,
            secret,
            qrCodeUrl,
        };
    } catch (error) {
        console.error("Failed to setup 2FA:", error);
        return { success: false, error: "Failed to setup 2FA" };
    }
}


export async function verifyAndEnableTwoFactor(token: string, identifier?: string) {
    const clientIp = await getAuthClientIp();
    const rateLimitKey = identifier ? `2fa-verify:${normalizeIdentifier(identifier)}` : `2fa-verify:session`;

    const [identifierRateCheck, ipRateCheck] = await Promise.all([
        consumeRateLimit('auth', rateLimitKey),
        consumeRateLimit('auth', `ip:${clientIp}`),
    ]);

    if (!identifierRateCheck.allowed || !ipRateCheck.allowed) {
        return { success: false, error: "Too many verification attempts. Please try again later." };
    }

    let userId: string;

    if (identifier) {
        // Called during login flow — no session yet; password was already verified by authorize()
        const [user] = await db.select({ id: users.id }).from(users).where(emailEquals(identifier)).limit(1);
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

    // ── Server-side password validation ───────────────────────────────────────
    if (!newPassword || newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long" };
    }

    // Complexity: at least one uppercase letter, one digit, one special character
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (!hasUppercase || !hasDigit || !hasSpecial) {
        return {
            success: false,
            error: "Password must contain at least one uppercase letter, one number, and one special character.",
        };
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

        // Prevent immediate re-use of the current password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return { success: false, error: "New password must be different from your current password" };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

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

    // Rate-limit profile updates to prevent enumeration or abuse
    const rateLimitResult = await enforceServerActionRateLimit('updateProfile', session.user.id, { mode: 'write' });
    if (rateLimitResult) {
        return { success: false, error: rateLimitResult.message };
    }

    try {
        const name = formData.get("name") as string;
        const newEmail = (formData.get("email") as string)?.trim().toLowerCase();
        const employeeId = formData.get("employeeId") as string;

        // Guard: if the user is changing their email, ensure it is not already
        // taken by another account. Without this check an attacker could overwrite
        // another user's email and then trigger a password-reset to take over the
        // account.
        if (newEmail && newEmail !== session.user.email?.toLowerCase()) {
            const [existingWithEmail] = await db
                .select({ id: users.id })
                .from(users)
                .where(and(
                    sql`lower(${users.email}) = ${newEmail}`,
                    ne(users.id, session.user.id),
                ))
                .limit(1);

            if (existingWithEmail) {
                return { success: false, error: "That email address is already in use by another account." };
            }
        }

        await db.update(users)
            .set({ name, email: newEmail || undefined, employeeId })
            .where(eq(users.id, session.user.id));

        revalidatePath("/profile");
        return { success: true, message: "Profile updated successfully" };
    } catch (error) {
        console.error("Failed to update profile:", error);
        return { success: false, error: "Failed to update profile" };
    }
}
