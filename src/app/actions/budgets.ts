'use server'

import { db } from "@/db";
import { budgets, costCenters, requisitions } from "@/db/schema";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { eq, and, sql, desc } from "drizzle-orm";
import { logActivity } from "./activity";

// ─── Budget CRUD ──────────────────────────────────────────────────────────────

export async function getBudgets() {
    try {
        const allBudgets = await db.select().from(budgets).orderBy(desc(budgets.createdAt));
        return allBudgets;
    } catch (error) {
        console.error("Failed to fetch budgets:", error);
        return [];
    }
}

export async function createBudget(data: {
    name: string;
    costCenter?: string;
    totalAmount: number;
    fiscalYear: string;
    department?: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can manage budgets" };
    }

    try {
        const [budget] = await db.insert(budgets).values({
            name: data.name,
            costCenter: data.costCenter,
            totalAmount: data.totalAmount.toFixed(2),
            fiscalYear: data.fiscalYear,
            department: data.department,
            status: 'active',
        }).returning();

        await logActivity('CREATE', 'budget', budget.id, `Created budget: ${data.name} (${data.fiscalYear}) — ${data.totalAmount.toLocaleString()}`);
        revalidatePath('/admin/budgets');
        return { success: true, data: budget };
    } catch (error) {
        console.error("Failed to create budget:", error);
        return { success: false, error: "Failed to create budget" };
    }
}

export async function updateBudget(id: string, data: Partial<{
    name: string;
    totalAmount: number;
    status: string;
}>) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can manage budgets" };
    }

    try {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount.toFixed(2);
        if (data.status) updateData.status = data.status;

        await db.update(budgets).set(updateData).where(eq(budgets.id, id));
        await logActivity('UPDATE', 'budget', id, `Budget updated`);
        revalidatePath('/admin/budgets');
        return { success: true };
    } catch (error) {
        console.error("Failed to update budget:", error);
        return { success: false, error: "Failed to update budget" };
    }
}

// ─── Budget Availability Check ─────────────────────────────────────────

export async function checkBudgetAvailability(budgetId: string, requestedAmount: number) {
    try {
        const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId));
        if (!budget) return { available: false, error: "Budget not found" };

        if (budget.status !== 'active') {
            return { available: false, error: `Budget is ${budget.status}`, remaining: 0 };
        }

        const total = parseFloat(budget.totalAmount);
        const used = parseFloat(budget.usedAmount);
        const remaining = total - used;

        return {
            available: remaining >= requestedAmount,
            remaining,
            total,
            used,
            budgetName: budget.name,
            utilizationPercent: total > 0 ? Math.round((used / total) * 100) : 0,
        };
    } catch (error) {
        console.error("Budget check failed:", error);
        return { available: false, error: "Budget check failed" };
    }
}

export async function consumeBudget(budgetId: string, amount: number) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const check = await checkBudgetAvailability(budgetId, amount);
        if (!check.available) {
            return { success: false, error: check.error || `Insufficient budget. Available: ${check.remaining?.toLocaleString()}` };
        }

        await db.update(budgets)
            .set({
                usedAmount: sql`CAST(${budgets.usedAmount} AS numeric) + ${amount}`,
            })
            .where(eq(budgets.id, budgetId));

        return { success: true };
    } catch (error) {
        console.error("Budget consumption failed:", error);
        return { success: false, error: "Budget consumption failed" };
    }
}

// ─── Cost Center CRUD ────────────────────────────────────────────────────────

export async function getCostCenters() {
    try {
        return await db.select().from(costCenters).orderBy(costCenters.code);
    } catch (error) {
        console.error("Failed to fetch cost centers:", error);
        return [];
    }
}

export async function createCostCenter(data: {
    code: string;
    name: string;
    description?: string;
    department?: string;
}) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can manage cost centers" };
    }

    try {
        const [center] = await db.insert(costCenters).values({
            code: data.code,
            name: data.name,
            description: data.description,
            department: data.department,
        }).returning();

        await logActivity('CREATE', 'cost_center', center.id, `Created cost center: ${data.code} — ${data.name}`);
        revalidatePath('/admin/budgets');
        return { success: true, data: center };
    } catch (error) {
        console.error("Failed to create cost center:", error);
        return { success: false, error: "Failed to create cost center" };
    }
}
