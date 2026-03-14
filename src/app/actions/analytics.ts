'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export async function getSpendStats() {
    try {
        // 1. Spend by Category (top 10)
        const spendByCategory = await db.select({
            category: parts.category,
            totalSpend: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`.mapWith(Number)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category)
            .orderBy(desc(sql`totalSpend`))
            .limit(10);

        // 2. Spend by Supplier (top 10)
        const spendBySupplier = await db.select({
            supplierId: suppliers.id,
            supplierName: suppliers.name,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number)
        })
            .from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(procurementOrders.status, 'fulfilled'))
            .groupBy(suppliers.id, suppliers.name)
            .orderBy(desc(sql`totalSpend`))
            .limit(10);

        // 3. Top 10 Parts by procurement volume and spend
        const topParts = await db.select({
            partId: parts.id,
            partName: parts.name,
            category: parts.category,
            totalQuantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
            totalSpend: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`.mapWith(Number)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.id, parts.name, parts.category)
            .orderBy(desc(sql`totalQuantity`))
            .limit(10);

        // 4. Monthly Spend Trend (last 6 months)
        const spendTrend = await db.select({
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'Mon YYYY')`,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number),
            orderCount: sql<number>`count(${procurementOrders.id})`.mapWith(Number)
        })
            .from(procurementOrders)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'Mon YYYY'), date_trunc('month', ${procurementOrders.createdAt})`)
            .orderBy(sql`date_trunc('month', ${procurementOrders.createdAt})`)
            .limit(6);

        // 5. Supplier performance scatter dimensions
        const supplierPerformance = await db.select({
            supplierName: suppliers.name,
            performanceScore: sql<number>`coalesce(${suppliers.performanceScore}, 0)`.mapWith(Number),
            riskScore: sql<number>`coalesce(${suppliers.riskScore}, 0)`.mapWith(Number),
            totalSpend: sql<number>`coalesce(sum(${procurementOrders.totalAmount}), 0)`.mapWith(Number)
        })
            .from(suppliers)
            .leftJoin(procurementOrders, eq(procurementOrders.supplierId, suppliers.id))
            .groupBy(suppliers.id, suppliers.name, suppliers.performanceScore, suppliers.riskScore)
            .orderBy(desc(sql`totalSpend`))
            .limit(10);

        // 6. Savings Tracker (Real Logic based on negotiated amounts)
        const savingsData = await db.select({
            totalInitial: sql<number>`sum(${procurementOrders.initialQuoteAmount})`.mapWith(Number),
            totalFinal: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number),
            count: sql<number>`count(${procurementOrders.id})`.mapWith(Number)
        })
            .from(procurementOrders)
            .where(
                and(
                    eq(procurementOrders.status, 'fulfilled'),
                    sql`${procurementOrders.initialQuoteAmount} IS NOT NULL`
                )
            );

        const totalActualSpend = Number(savingsData[0]?.totalFinal || 0);
        const totalInitialQuote = Number(savingsData[0]?.totalInitial || 0);
        // Only count savings if initial > final to avoid data errors skewing results
        const realizedSavings = Math.max(0, totalInitialQuote - totalActualSpend);
        const savingsRate = totalInitialQuote > 0 ? (realizedSavings / totalInitialQuote) * 100 : 0;

        return {
            spendByCategory,
            spendBySupplier,
            topParts,
            spendTrend,
            supplierPerformance,
            totalActualSpend,
            realizedSavings,
            savingsRate: Number(savingsRate.toFixed(1))
        };
    } catch (error) {
        const isConnectionRefused = error instanceof Error && /ECONNREFUSED|connect/i.test(error.message);
        if (!isConnectionRefused) {
            console.error("Failed to fetch spend stats:", error);
        }
        return {
            spendByCategory: [],
            spendBySupplier: [],
            topParts: [],
            spendTrend: [],
            supplierPerformance: [],
            totalActualSpend: 0,
            realizedSavings: 0,
            savingsRate: 0
        };
    }
}
