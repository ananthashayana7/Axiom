'use server'

import { db } from "@/db";
import { clearWorkspacePreservingAdmins, seedDemoWorkspace } from "@/db/demo-workspace";
import type { PreservedAdminUser } from "@/db/demo-workspace";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const WORKSPACE_PATHS_TO_REVALIDATE = [
    "/",
    "/copilot",
    "/suppliers",
    "/sourcing",
    "/sourcing/parts",
    "/sourcing/rfqs",
    "/sourcing/requisitions",
    "/sourcing/orders",
    "/sourcing/goods-receipts",
    "/sourcing/contracts",
    "/sourcing/invoices",
    "/transactions",
    "/savings",
    "/admin/analytics",
    "/admin/risk",
    "/admin/fraud-alerts",
    "/admin/financial-matching",
    "/admin/tasks",
    "/admin/compliance",
    "/admin/support",
    "/admin/telemetry",
    "/admin/audit",
    "/admin/agents",
    "/portal",
] as const;

function revalidateWorkspace() {
    revalidatePath("/", "layout");
    for (const path of WORKSPACE_PATHS_TO_REVALIDATE) {
        revalidatePath(path);
    }
}

export async function resetDatabase() {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return { success: false, error: "Unauthorized. Admin rights required." };
    }

    try {
        console.log("Resetting database initiated by:", session.user?.email);

        const preservedAdmins = await db
            .select()
            .from(users)
            .where(eq(users.role, "admin"));

        if (preservedAdmins.length === 0) {
            return { success: false, error: "Reset blocked because no admin account could be preserved." };
        }

        await clearWorkspacePreservingAdmins(preservedAdmins as PreservedAdminUser[]);
        revalidateWorkspace();
        console.log("Database reset complete.");
        return {
            success: true,
            message: `Workspace data cleared. Preserved ${preservedAdmins.length} admin account${preservedAdmins.length === 1 ? "" : "s"}.`,
        };
    } catch (error) {
        console.error("Database reset failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reset database. See server logs.",
        };
    }
}

export async function loadDemoWorkspace() {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return { success: false, error: "Unauthorized. Admin rights required." };
    }

    try {
        console.log("Demo workspace seed initiated by:", session.user?.email);

        const preservedAdmins = await db
            .select()
            .from(users)
            .where(eq(users.role, "admin"));

        if (preservedAdmins.length === 0) {
            return { success: false, error: "Demo seed blocked because no admin account could be preserved." };
        }

        const result = await seedDemoWorkspace(preservedAdmins as PreservedAdminUser[]);
        revalidateWorkspace();

        return {
            success: true,
            message: `Demo workspace ready with ${result.counts.suppliers} suppliers, ${result.counts.orders} orders, and ${result.counts.invoices} invoices.`,
            counts: result.counts,
        };
    } catch (error) {
        console.error("Demo workspace seed failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to seed the demo workspace.",
        };
    }
}
