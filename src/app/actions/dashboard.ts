'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, parts, orderItems } from "@/db/schema";
// @ts-ignore
import { count, eq, sum, sql, desc, inArray } from "drizzle-orm";

export async function getDashboardStats() {
    try {
        const [supplierCount] = await db.select({ count: count() }).from(suppliers);
        const [orderCount] = await db.select({ count: count() }).from(procurementOrders);
        const [partCount] = await db.select({ count: count() }).from(parts);

        // Sum up total inventory across all parts
        const [inventoryResult] = await db.select({
            totalInventory: sum(parts.stockLevel)
        }).from(parts);

        // Calculate total spend
        const result = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders);

        const totalSpend = Number(result[0]?.total || 0);

        // Calculate MoM change
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const currentMonthSpendResult = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders)
            .where(sql`${procurementOrders.createdAt} >= ${firstDayCurrentMonth}`);

        const lastMonthSpendResult = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders)
            .where(sql`${procurementOrders.createdAt} >= ${firstDayLastMonth} AND ${procurementOrders.createdAt} < ${firstDayCurrentMonth}`);

        const currentMonthSpend = Number(currentMonthSpendResult[0]?.total || 0);
        const lastMonthSpend = Number(lastMonthSpendResult[0]?.total || 0);

        let momChange = 0;
        if (lastMonthSpend > 0) {
            momChange = ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
        }

        // Efficiently fetch all order status counts in a single query
        const orderSummary = await db.select({
            status: procurementOrders.status,
            count: count()
        })
            .from(procurementOrders)
            .groupBy(procurementOrders.status);

        const statusMap: Record<string, number> = {};
        orderSummary.forEach(row => {
            if (row.status) statusMap[row.status] = Number(row.count);
        });

        const activeCount = (statusMap['pending_approval'] || 0) +
            (statusMap['approved'] || 0) +
            (statusMap['sent'] || 0);

        const fulfilledCount = statusMap['fulfilled'] || 0;

        return {
            supplierCount: supplierCount.count,
            orderCount: orderCount.count,
            pendingCount: activeCount,
            fulfilledCount: fulfilledCount,
            partCount: partCount.count,
            totalInventory: Number(inventoryResult.totalInventory || 0),
            totalSpend: totalSpend,
            momChange: momChange.toFixed(1),
            isFirstMonth: lastMonthSpend === 0
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return {
            supplierCount: 0,
            orderCount: 0,
            partCount: 0,
            totalSpend: "0.00",
        };
    }
}




export async function getRecentOrders() {
    try {
        const recentOrders = await db
            .select({
                id: procurementOrders.id,
                supplierId: procurementOrders.supplierId,
                status: procurementOrders.status,
                totalAmount: procurementOrders.totalAmount,
                createdAt: procurementOrders.createdAt,
                supplierName: suppliers.name,
                supplierEmail: suppliers.contactEmail,
            })
            .from(procurementOrders)
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .orderBy(desc(procurementOrders.createdAt))
            .limit(5);
        // Transform to match UI expectations
        const formatted = recentOrders.map((o) => ({
            ...o,
            supplier: { name: o.supplierName, contact_email: o.supplierEmail },
        }));
        return formatted;
    } catch (error) {
        console.error("Failed to fetch recent orders:", error);
        return [];
    }
}

export async function getMonthlySpend() {
    try {
        const orders = await db.select({
            amount: procurementOrders.totalAmount,
            createdAt: procurementOrders.createdAt,
        }).from(procurementOrders);

        const monthlyData: Record<string, { total: number, orders: number }> = {};
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        orders.forEach(order => {
            if (!order.createdAt) return;
            const month = months[order.createdAt.getMonth()];
            const amount = parseFloat(order.amount || "0");

            if (!monthlyData[month]) {
                monthlyData[month] = { total: 0, orders: 0 };
            }
            monthlyData[month].total += amount;
            monthlyData[month].orders += 1;
        });

        // Return all months in order
        return months.map(m => ({
            name: m,
            total: Math.floor(monthlyData[m]?.total || 0),
            orders: monthlyData[m]?.orders || 0
        }));
    } catch (error) {
        console.error("Failed to fetch monthly spend:", error);
        return [];
    }
}

export async function getCategorySpend() {
    try {
        const result = await db.select({
            category: parts.category,
            total: sum(sql<number>`${orderItems.quantity} * ${orderItems.unitPrice}`),
            count: count(orderItems.id)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category);

        return result.map((r: { category: string | null, total: number | unknown, count: number | unknown }) => ({
            name: r.category || "Other",
            value: Number(r.total || 0),
            count: Number(r.count || 0)
        }));
    } catch (error) {
        console.error("Failed to fetch category spend:", error);
        return [];
    }
}

export async function getHighRiskSuppliers() {
    try {
        const result = await db.select({
            id: suppliers.id,
            name: suppliers.name,
            riskScore: suppliers.riskScore,
        })
            .from(suppliers)
            .orderBy(desc(suppliers.riskScore))
            .limit(3);
        return result;
    } catch (error) {
        console.error("Failed to fetch high risk suppliers:", error);
        return [];
    }
}
export async function getSupplierAnalytics() {
    try {
        const result = await db.select({
            name: suppliers.name,
            spend: sum(procurementOrders.totalAmount),
            orders: count(procurementOrders.id),
            risk: suppliers.riskScore
        })
            .from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .groupBy(suppliers.id, suppliers.name, suppliers.riskScore)
            .orderBy(desc(sum(procurementOrders.totalAmount)))
            .limit(5);

        return result.map(s => ({
            name: s.name,
            orders: Number(s.orders),
            spend: Number(s.spend || 0),
            reliability: 100 - (s.risk || 0)
        }));
    } catch (error) {
        console.error("Failed to fetch supplier analytics:", error);
        return [];
    }
}
