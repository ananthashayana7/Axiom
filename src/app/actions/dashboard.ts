'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, parts, orderItems } from "@/db/schema";
// @ts-ignore
import { count, eq, sum, sql, desc } from "drizzle-orm";

export async function getDashboardStats() {
    try {
        const [supplierCount] = await db.select({ count: count() }).from(suppliers);
        const [orderCount] = await db.select({ count: count() }).from(procurementOrders);
        const [partCount] = await db.select({ count: count() }).from(parts);

        // Calculate total spend
        const result = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders);

        const totalSpend = result[0]?.total || 0;

        return {
            supplierCount: supplierCount.count,
            orderCount: orderCount.count,
            partCount: partCount.count,
            totalSpend: Number(totalSpend).toFixed(2),
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

export async function getCategorySpend() {
    try {
        const result = await db.select({
            category: parts.category,
            total: sum(sql<number>`${orderItems.quantity} * ${orderItems.unitPrice}`)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category);

        return result.map((r: { category: string | null, total: number | unknown }) => ({
            name: r.category || "Other",
            value: Number(r.total || 0)
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
