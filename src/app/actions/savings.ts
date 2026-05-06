'use server'

import { db } from "@/db";
import { procurementOrders, suppliers } from "@/db/schema";
import { auth } from "@/auth";
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
        const supplierMap = new Map<string, { supplierName: string; savings: number; spend: number }>();
        for (const o of orders) {
            const name = o.supplierName || 'Unknown';
            const s = parseFloat(o.savingsAmount || '0');
            const spend = parseFloat(o.totalAmount || '0');
            const existing = supplierMap.get(name) || { supplierName: name, savings: 0, spend: 0 };
            supplierMap.set(name, {
                supplierName: name,
                savings: existing.savings + s,
                spend: existing.spend + spend,
            });
        }
        const savingsBySupplier = Array.from(supplierMap.values()).sort((a, b) => b.savings - a.savings);

        // Savings trend by month
        const monthMap = new Map<string, { month: string; savings: number; spend: number; sortKey: number }>();
        for (const o of orders) {
            const createdAt = new Date(o.createdAt || Date.now());
            const month = createdAt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            const sortKey = Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), 1);
            const existing = monthMap.get(month) || { month, savings: 0, spend: 0, sortKey };
            monthMap.set(month, {
                month,
                savings: existing.savings + parseFloat(o.savingsAmount || '0'),
                spend: existing.spend + parseFloat(o.totalAmount || '0'),
                sortKey,
            });
        }
        const savingsTrend = Array.from(monthMap.values())
            .sort((a, b) => a.sortKey - b.sortKey)
            .map(({ month, savings, spend }) => ({ month, savings, spend }));

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
