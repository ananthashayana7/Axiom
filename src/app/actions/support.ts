'use server'

import { db } from "@/db";
import { supportTickets, users } from "@/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { sendEmail, sendSupportTicket } from "@/lib/services/email";
import { revalidatePath } from "next/cache";

export async function submitSupportTicket(data: {
    subject: string;
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Not authenticated");

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Count existing tickets this month to determine serial number
    // Use a retry loop to handle potential race conditions with concurrent submissions
    let ticketNumber = '';
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
        const existingTickets = await db.select().from(supportTickets)
            .where(
                and(
                    gte(supportTickets.createdAt, new Date(year, now.getMonth(), 1)),
                    lte(supportTickets.createdAt, new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999))
                )
            );
        const serial = String(existingTickets.length + 1 + attempts).padStart(3, '0');
        ticketNumber = `PMA-${year}-${month}-${serial}`;

        // Check if this ticket number already exists
        const [dup] = await db.select().from(supportTickets)
            .where(eq(supportTickets.ticketNumber, ticketNumber))
            .limit(1);
        if (!dup) break;
        attempts++;
    }

    const [ticket] = await db.insert(supportTickets).values({
        ticketNumber,
        submittedById: session.user.id,
        subject: data.subject,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: 'open',
    }).returning();

    const emailResult = await sendSupportTicket(
        session.user.email || 'no-reply@axiom.local',
        session.user.name || 'Axiom User',
        `${ticketNumber}: ${data.subject}`,
        `Category: ${data.category}\nPriority: ${data.priority}\n\n${data.description}`
    );

    return {
        ticket,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
    };
}

export async function getUserTickets() {
    const session = await auth();
    if (!session?.user?.id) return [];

    return db.select().from(supportTickets)
        .where(eq(supportTickets.submittedById, session.user.id))
        .orderBy(desc(supportTickets.createdAt));
}

export async function getAllTickets() {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== 'admin') throw new Error("Admin only");

    return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
}

export async function updateTicketStatus(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', resolution?: string) {
    const session = await auth();
    const actor = session?.user as { role?: string; email?: string | null; name?: string | null } | undefined;
    const role = actor?.role;
    if (role !== 'admin') throw new Error("Admin only");

    const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
    const [ticket] = await db.update(supportTickets)
        .set({
            status,
            resolution: resolution ?? null,
            resolvedAt: (status === 'resolved' || status === 'closed') ? new Date() : null,
        })
        .where(eq(supportTickets.id, id))
        .returning();

    if (existing) {
        const [submitter] = await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, existing.submittedById))
            .limit(1);

        if (submitter?.email) {
            const ticketUpdateEmail = await sendEmail({
                to: submitter.email,
                replyTo: 'pma.axiom.support@gmail.com',
                subject: `[Axiom Ticket Update] ${existing.ticketNumber} is now ${status}`,
                body: `Hello ${submitter.name || 'User'},\n\nYour support ticket has been updated.\n\nTicket: ${existing.ticketNumber}\nSubject: ${existing.subject}\nStatus: ${status}\n\nResolution: ${resolution || 'No additional notes provided.'}\n\nUpdated by: ${actor?.name || 'Axiom Support'}\n\nRegards,\nAxiom Support\npma.axiom.support@gmail.com`,
            });
            if (!ticketUpdateEmail.success) {
                console.error(`[EMAIL] Failed to notify ${submitter.email} about ticket ${existing.ticketNumber}: ${ticketUpdateEmail.error}`);
            }
        }
    }

    revalidatePath('/support');
    revalidatePath('/admin/support');

    return ticket;
}
