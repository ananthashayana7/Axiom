'use server'

import { db } from "@/db";
import { contacts } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getContacts() {
    const session = await auth();
    if (!session) return [];
    try {
        return await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    } catch (error) {
        console.error("Failed to fetch contacts:", error);
        return [];
    }
}

export async function createContact(data: {
    name: string; email: string; phone?: string; company?: string; jobTitle?: string;
    region?: string; country?: string; continent?: string; currency?: string; notes?: string;
    status?: 'active' | 'inactive' | 'on_hold';
}) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    try {
        const [contact] = await db.insert(contacts).values({
            ...data,
            createdBy: session.user.id,
        }).returning();
        revalidatePath('/contacts');
        return { success: true, data: contact };
    } catch (error) {
        console.error("Failed to create contact:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create contact" };
    }
}

export async function updateContactStatus(id: string, status: 'active' | 'inactive' | 'on_hold') {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    try {
        await db.update(contacts).set({ status }).where(eq(contacts.id, id));
        revalidatePath('/contacts');
        return { success: true };
    } catch {
        return { success: false, error: "Failed to update" };
    }
}

export async function deleteContact(id: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };
    try {
        await db.delete(contacts).where(eq(contacts.id, id));
        revalidatePath('/contacts');
        return { success: true };
    } catch {
        return { success: false, error: "Failed to delete" };
    }
}
