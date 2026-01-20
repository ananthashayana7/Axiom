'use server'

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', {
            ...Object.fromEntries(formData),
            redirectTo: '/',
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
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
