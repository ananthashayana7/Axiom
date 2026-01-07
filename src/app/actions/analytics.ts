'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export async function getSpendStats() {
    try {
        // 1. Spend by Category
        const spendByCategory = await db.select({
            category: parts.category,
            totalSpend: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`.mapWith(Number)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category)
            .orderBy(desc(sql`totalSpend`));

        // 2. Spend by Supplier
        const spendBySupplier = await db.select({
            supplierName: suppliers.name,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number)
        })
            .from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(procurementOrders.status, 'fulfilled'))
            .groupBy(suppliers.name)
            .orderBy(desc(sql`totalSpend`))
            .limit(5);

        // 3. Monthly Spend Trend (last 6 months)
        const spendTrend = await db.select({
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'Mon YYYY')`,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number),
            orderCount: sql<number>`count(${procurementOrders.id})`.mapWith(Number)
        })
            .from(procurementOrders)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'Mon YYYY'), date_trunc('month', ${procurementOrders.createdAt})`)
            .orderBy(sql`date_trunc('month', ${procurementOrders.createdAt})`)
            .limit(6);

        // 4. Savings Tracker (Mock logic: comparing PO price vs Should-Cost baseline)
        // In a real app, should-cost would be its own field or table
        const totalActualSpend = spendTrend.reduce((acc: number, curr: any) => acc + curr.totalSpend, 0);
        const realizedSavings = totalActualSpend * 0.12; // 12% realized savings mock

        return {
            spendByCategory,
            spendBySupplier,
            spendTrend,
            totalActualSpend,
            realizedSavings,
            savingsRate: 12.4
        };
    } catch (error) {
        console.error("Failed to fetch spend stats:", error);
        return {
            spendByCategory: [],
            spendBySupplier: [],
            spendTrend: [],
            totalActualSpend: 0,
            realizedSavings: 0,
            savingsRate: 0
        };
    }
}
