'use server'

import { db } from "@/db";
import { suppliers, procurementOrders } from "@/db/schema";
import { count, eq, sum, sql } from "drizzle-orm";

export async function getDashboardStats() {
    try {
        const [supplierCount] = await db.select({ count: count() }).from(suppliers);
        const [orderCount] = await db.select({ count: count() }).from(procurementOrders);

        // Calculate total spend
        const result = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders);

        const totalSpend = result[0]?.total || 0;

        return {
            supplierCount: supplierCount.count,
            orderCount: orderCount.count,
            totalSpend: Number(totalSpend).toFixed(2),
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return {
            supplierCount: 0,
            orderCount: 0,
            totalSpend: "0.00",
        };
    }
}

export async function getRecentOrders() {
    try {
        const recentOrders = await db.query.procurementOrders.findMany({
            limit: 5,
            orderBy: (procurementOrders, { desc }) => [desc(procurementOrders.createdAt)],
            with: {
                supplier: true,
            }
        });
        return recentOrders;
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

        const monthlyData: Record<string, number> = {};
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Initialize months closer to current date? Or just show all?
        // Let's just aggregate.
        orders.forEach(order => {
            if (!order.createdAt) return;
            const month = months[order.createdAt.getMonth()];
            const amount = parseFloat(order.amount || "0");
            monthlyData[month] = (monthlyData[month] || 0) + amount;
        });

        // Return all months in order
        return months.map(m => ({
            name: m,
            total: Math.floor(monthlyData[m] || 0)
        }));
    } catch (error) {
        console.error("Failed to fetch monthly spend:", error);
        return [];
    }
}

import { orderItems, parts } from "@/db/schema";

export async function getCategorySpend() {
    try {
        const result = await db.select({
            category: parts.category,
            total: sum(sql<number>`${orderItems.quantity} * ${orderItems.unitPrice}`)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category);

        return result.map(r => ({
            name: r.category || "Other",
            value: Number(r.total || 0)
        }));
    } catch (error) {
        console.error("Failed to fetch category spend:", error);
        return [];
    }
}
