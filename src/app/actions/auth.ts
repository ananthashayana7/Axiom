'use server'

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
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

        // Note: We'll modify the login flow to handle a "require-2fa" status
        // For now, this is the standard sign-in
        await signIn('credentials', {
            identifier,
            password,
            code, // We need to pass the code to the authorize callback
            redirectTo: '/',
        });
    } catch (error: any) {
        if (isRedirectError(error)) {
            throw error;
        }

        console.log("[AUTH ACTION] Caught error type:", typeof error, "isAuthError:", error instanceof AuthError);
        console.log("[AUTH ACTION] Error Message:", error.message);
        console.log("[AUTH ACTION] Error Cause:", JSON.stringify(error.cause, null, 2));

        // Robust check for the internal 2FA signal
        const errorMsg = error.message || '';
        const causeMsg = error.cause?.err?.message || error.cause?.message || '';

        if (errorMsg.includes('require-2fa') || causeMsg.includes('require-2fa')) {
            console.log("[AUTH ACTION] Require 2FA signal detected");
            return 'require-2fa';
        }

        if (errorMsg.includes('setup-2fa') || causeMsg.includes('setup-2fa')) {
            console.log("[AUTH ACTION] Setup 2FA signal detected");
            return 'setup-2fa';
        }

        if (error instanceof AuthError) {
            console.log("[AUTH ACTION] AuthError detected:", error.type);
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }

        return 'An unexpected error occurred. Please try again.';
    }
}

export async function setupTwoFactor() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const secret = TotpService.generateSecret();
        const email = session.user.email || 'user';
        const otpauthUrl = TotpService.getOtpAuthUrl(secret, email);

        // Temporarily store the secret until verified
        await db.update(users)
            .set({ twoFactorSecret: secret, isTwoFactorEnabled: false })
            .where(eq(users.id, session.user.id));

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

export async function verifyAndEnableTwoFactor(token: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
        if (!user || !user.twoFactorSecret) {
            return { success: false, error: "2FA not initialized" };
        }

        const isValid = TotpService.verifyToken(user.twoFactorSecret, token);
        if (!isValid) {
            return { success: false, error: "Invalid verification code" };
        }

        await db.update(users)
            .set({ isTwoFactorEnabled: true })
            .where(eq(users.id, session.user.id));

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
