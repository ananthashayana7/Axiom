'use server'

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const RESET_TABLES = [
    "webhook_deliveries",
    "webhooks",
    "support_tickets",
    "comments",
    "notifications",
    "chat_history",
    "audit_logs",
    "system_telemetry",
    "agent_recommendations",
    "agent_executions",
    "fraud_alerts",
    "payment_optimizations",
    "demand_forecasts",
    "market_price_index",
    "savings_records",
    "workflow_tasks",
    "supplier_requests",
    "supplier_action_plans",
    "compliance_obligations",
    "sourcing_messages",
    "sourcing_events",
    "rfq_suppliers",
    "rfq_items",
    "documents",
    "qc_inspections",
    "goods_receipts",
    "invoices",
    "order_items",
    "procurement_orders",
    "requisitions",
    "contracts",
    "rfqs",
    "contacts",
    "matching_tolerances",
    "approval_policies",
    "import_jobs",
    "supplier_performance_logs",
    "parts",
    "cost_centers",
    "budgets",
    "suppliers",
    "users",
] as const;

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

        const existingTablesResult = await db.execute(
            sql.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        );
        const existingTables = new Set(
            existingTablesResult.rows
                .map((row: { tablename?: unknown }) => row.tablename)
                .filter((value: unknown): value is string => typeof value === "string")
        );
        const tablesToReset = RESET_TABLES.filter((tableName) => existingTables.has(tableName));

        if (tablesToReset.length > 0) {
            await db.execute(
                sql.raw(
                    `TRUNCATE TABLE ${tablesToReset.map((tableName) => `"${tableName}"`).join(", ")} RESTART IDENTITY CASCADE`
                )
            );
        }

        await db.insert(users).values(
            preservedAdmins.map((admin) => ({
                id: admin.id,
                name: admin.name,
                email: admin.email,
                employeeId: admin.employeeId,
                phoneNumber: admin.phoneNumber,
                twoFactorSecret: admin.twoFactorSecret,
                isTwoFactorEnabled: admin.isTwoFactorEnabled,
                password: admin.password,
                role: admin.role,
                department: admin.department,
                supplierId: null,
                createdAt: admin.createdAt,
            }))
        );

        revalidatePath("/", "layout");
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
