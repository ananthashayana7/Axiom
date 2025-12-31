'use server'

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";

export async function getUsers() {
    try {
        const allUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
        }).from(users).orderBy(users.createdAt);
        return allUsers;
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

export async function createUser(formData: FormData) {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const role = (formData.get("role") as 'admin' | 'user') || 'user';

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(users).values({
            name,
            email,
            password: hashedPassword,
            role,
        });

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to create user:", error);
        return { success: false, error: "Failed to create user" };
    }
}

export async function updateUser(id: string, formData: FormData) {
    const session = await auth();
    const currentUser = session?.user as any;

    // Only admin can update others; users can update themselves
    if (currentUser?.role !== 'admin' && currentUser?.id !== id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const role = formData.get("role") as 'admin' | 'user';

        const updateData: any = { name, email };

        // Only admins can change roles
        if (currentUser?.role === 'admin' && role) {
            updateData.role = role;
        }

        if (password && password.length >= 6) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await db.update(users)
            .set(updateData)
            .where(eq(users.id, id));

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to update user:", error);
        return { success: false, error: "Failed to update user" };
    }
}

export async function deleteUser(id: string) {
    const session = await auth();
    const currentUser = session?.user as any;

    if (currentUser?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    // Prevent self-deletion of the only admin
    if (currentUser.id === id) {
        return { success: false, error: "You cannot delete your own admin account while logged in." };
    }

    try {
        await db.delete(users).where(eq(users.id, id));
        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user" };
    }
}
