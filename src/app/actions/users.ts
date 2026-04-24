'use server'

import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, users } from "@/db/schema";
import { eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sendEmail, generateWelcomeEmail } from "@/lib/services/email";
import { logActivity } from "./activity";

type UserRole = 'admin' | 'user' | 'supplier';

async function requireAdmin() {
    const session = await auth();
    if (session?.user?.role !== 'admin') {
        return null;
    }

    return session;
}

async function validateSupplierAssignment(role: UserRole, supplierId: string | null) {
    if (role !== 'supplier') {
        return { success: true as const, supplierId: null, supplierName: null };
    }

    if (!supplierId) {
        return { success: false as const, error: "Supplier login accounts must be linked to a supplier record." };
    }

    const [supplier] = await db
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

    if (!supplier) {
        return { success: false as const, error: "Selected supplier could not be found." };
    }

    return { success: true as const, supplierId: supplier.id, supplierName: supplier.name };
}

export async function getUsers() {
    try {
        const session = await requireAdmin();
        if (!session) {
            return [];
        }

        return await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                employeeId: users.employeeId,
                department: users.department,
                role: users.role,
                supplierId: users.supplierId,
                supplierName: suppliers.name,
                createdAt: users.createdAt,
            })
            .from(users)
            .leftJoin(suppliers, eq(users.supplierId, suppliers.id))
            .orderBy(users.createdAt);
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}

export async function getDepartmentLeads() {
    try {
        return await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            department: users.department,
        })
            .from(users)
            .where(ne(users.department, ""));
    } catch (error) {
        console.error("Failed to fetch department leads:", error);
        return [];
    }
}

export async function createUser(formData: FormData) {
    const session = await requireAdmin();
    if (!session) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const employeeIdRaw = (formData.get("employeeId") as string) || "";
        const departmentRaw = (formData.get("department") as string) || "";
        const password = formData.get("password") as string;
        const role = ((formData.get("role") as UserRole) || "user");
        const supplierIdRaw = (formData.get("supplierId") as string) || "";

        const employeeId = employeeIdRaw.trim() === "" ? null : employeeIdRaw.trim();
        const supplierId = supplierIdRaw.trim() === "" ? null : supplierIdRaw.trim();
        const department = departmentRaw.trim() === "" ? null : departmentRaw.trim();
        const supplierValidation = await validateSupplierAssignment(role, supplierId);
        if (!supplierValidation.success) {
            return { success: false, error: supplierValidation.error };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [newUser] = await db.insert(users).values({
            name,
            email,
            employeeId,
            department,
            password: hashedPassword,
            role,
            supplierId: supplierValidation.supplierId,
        }).returning();

        await logActivity(
            'CREATE',
            'user',
            newUser.id,
            `Created new ${role} account: ${name} (${email})${supplierValidation.supplierName ? ` linked to ${supplierValidation.supplierName}` : ''}`
        );

        const welcome = generateWelcomeEmail(name, email || employeeId || 'N/A', password);
        const welcomeResult = await sendEmail({
            to: email,
            subject: welcome.subject,
            body: welcome.body,
        });
        if (!welcomeResult.success) {
            console.error(`[EMAIL] Failed to send welcome email to ${email}: ${welcomeResult.error}`);
        }

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to create user:", error);
        return { success: false, error: "Failed to create user" };
    }
}

export async function updateUser(id: string, formData: FormData) {
    const session = await auth();
    const currentUser = session?.user;

    if (currentUser?.role !== 'admin' && currentUser?.id !== id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const employeeIdRaw = (formData.get("employeeId") as string) || "";
        const departmentRaw = (formData.get("department") as string) || "";
        const password = (formData.get("password") as string) || "";
        const requestedRole = formData.get("role") as UserRole | null;
        const supplierIdRaw = (formData.get("supplierId") as string) || "";

        const employeeId = employeeIdRaw.trim() === "" ? null : employeeIdRaw.trim();
        const department = departmentRaw.trim() === "" ? null : departmentRaw.trim();
        const supplierId = supplierIdRaw.trim() === "" ? null : supplierIdRaw.trim();

        type UpdateUserData = {
            name?: string;
            email?: string;
            employeeId?: string | null;
            department?: string | null;
            password?: string;
            role?: UserRole;
            supplierId?: string | null;
        };

        const updateData: UpdateUserData = {
            name,
            email,
            employeeId,
            department,
        };

        if (currentUser?.role === 'admin' && requestedRole) {
            const supplierValidation = await validateSupplierAssignment(requestedRole, supplierId);
            if (!supplierValidation.success) {
                return { success: false, error: supplierValidation.error };
            }

            updateData.role = requestedRole;
            updateData.supplierId = supplierValidation.supplierId;
        }

        if (password && password.length >= 6) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await db.update(users)
            .set(updateData)
            .where(eq(users.id, id));

        await logActivity('UPDATE', 'user', id, `Updated user account: ${name || 'unknown'} (${email || 'unknown'})`);

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to update user:", error);
        return { success: false, error: "Failed to update user" };
    }
}

export async function deleteUser(id: string) {
    const session = await requireAdmin();
    const currentUser = session?.user;

    if (!session || currentUser?.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    if (currentUser.id === id) {
        return { success: false, error: "You cannot delete your own admin account while logged in." };
    }

    try {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        if (!user) {
            return { success: false, error: "User not found." };
        }

        if (user.role === 'admin') {
            const adminCountResult = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(users)
                .where(eq(users.role, 'admin'));

            if ((adminCountResult[0]?.count ?? 0) <= 1) {
                return { success: false, error: "At least one admin account must remain active." };
            }
        }

        await db.delete(users).where(eq(users.id, id));
        await logActivity('DELETE', 'user', id, `Deleted user: ${user.name} (${user.email})`);

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user" };
    }
}
