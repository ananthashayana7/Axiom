'use server'

import { db } from "@/db";
import { procurementOrders, suppliers } from "@/db/schema";
import { auth } from "@/auth";
import { desc, gt, isNotNull, sql } from "drizzle-orm";
import { eq } from "drizzle-orm";

export async function getSavingsData() {
    const session = await auth();
    if (!session) return null;
    try {
        const orders = await db.select({
            id: procurementOrders.id,
            supplierId: procurementOrders.supplierId,
            totalAmount: procurementOrders.totalAmount,
            initialQuoteAmount: procurementOrders.initialQuoteAmount,
            savingsAmount: procurementOrders.savingsAmount,
            savingsType: procurementOrders.savingsType,
            createdAt: procurementOrders.createdAt,
            supplierName: suppliers.name,
        }).from(procurementOrders).leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id));

        const totalNegotiatedSavings = orders.reduce((acc, o) => acc + parseFloat(o.savingsAmount || '0'), 0);
        const totalActualSpend = orders.reduce((acc, o) => acc + parseFloat(o.totalAmount || '0'), 0);
        const totalInitialQuote = orders.reduce((acc, o) => acc + parseFloat(o.initialQuoteAmount || o.totalAmount || '0'), 0);
        const savingsRate = totalInitialQuote > 0 ? ((totalNegotiatedSavings / totalInitialQuote) * 100).toFixed(1) : '0.0';
        const ordersWithSavings = orders.filter(o => parseFloat(o.savingsAmount || '0') > 0).length;

        // Savings by supplier
        const supplierMap = new Map<string, { supplierName: string; savings: number }>();
        for (const o of orders) {
            const name = o.supplierName || 'Unknown';
            const s = parseFloat(o.savingsAmount || '0');
            supplierMap.set(name, { supplierName: name, savings: (supplierMap.get(name)?.savings || 0) + s });
        }
        const savingsBySupplier = Array.from(supplierMap.values()).sort((a, b) => b.savings - a.savings);

        // Savings trend by month
        const monthMap = new Map<string, number>();
        for (const o of orders) {
            const month = new Date(o.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            monthMap.set(month, (monthMap.get(month) || 0) + parseFloat(o.savingsAmount || '0'));
        }
        const savingsTrend = Array.from(monthMap.entries()).map(([month, savings]) => ({ month, savings }));

        // Savings by type
        const typeMap = new Map<string, number>();
        for (const o of orders) {
            const type = o.savingsType || 'negotiation';
            typeMap.set(type, (typeMap.get(type) || 0) + parseFloat(o.savingsAmount || '0'));
        }
        const savingsByType = Array.from(typeMap.entries()).map(([type, value]) => ({ type, value }));

        // Top savings orders
        const topSavingsOrders = orders
            .filter(o => parseFloat(o.savingsAmount || '0') > 0)
            .map(o => ({
                ...o,
                savingsRate: parseFloat(o.initialQuoteAmount || '0') > 0
                    ? (parseFloat(o.savingsAmount || '0') / parseFloat(o.initialQuoteAmount || '1')) * 100
                    : 0
            }))
            .sort((a, b) => b.savingsRate - a.savingsRate);

        return {
            totalNegotiatedSavings,
            totalActualSpend,
            savingsRate,
            ordersWithSavings,
            savingsBySupplier,
            savingsTrend,
            savingsByType,
            topSavingsOrders,
        };
    } catch (e) {
        console.error("Failed to fetch savings data:", e);
        return null;
    }
}
