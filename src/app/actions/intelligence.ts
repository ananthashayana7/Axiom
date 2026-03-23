'use server'

import { db } from "@/db";
import { rfqs, suppliers, procurementOrders, contracts } from "@/db/schema";
import { count, desc, eq, sum } from "drizzle-orm";

import { getAiModel } from "@/lib/ai-provider";

export async function getMarketTrend(partName: string, category: string) {
    try {
        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const prompt = `Provide supply chain intelligence and predictive market forecasting for ${partName} (${category}). Return JSON {trend: "up"|"down"|"stable"|"volatile", reason: "1-sentence context", source: "Axiom Predictive Engine (Gemini 2.5)"}`;
        const result = await model.generateContent(prompt);
        const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { trend: "up", reason: "General market volatility forecasted.", source: "Axiom Predictive Engine (Standard)" };
    } catch (e) {
        return { trend: "stable", reason: "Market visibility limited." };
    }
}

export async function getDashboardStats() {
    try {
        // Total spend from procurement orders
        const [spendResult] = await db.select({
            total: sum(procurementOrders.totalAmount)
        }).from(procurementOrders);

        // Active suppliers (status = 'active')
        const [activeSupplierResult] = await db.select({ count: count() })
            .from(suppliers)
            .where(eq(suppliers.status, 'active'));

        // Open RFQs (status = 'open' — actively awaiting responses, considered critical)
        const openRfqResult = await db.select({ count: count() })
            .from(rfqs)
            .where(eq(rfqs.status, 'open'));

        // Compliance rate: percentage of contracts that are 'active' out of total contracts
        const [totalContracts] = await db.select({ count: count() }).from(contracts);
        const [activeContracts] = await db.select({ count: count() })
            .from(contracts)
            .where(eq(contracts.status, 'active'));

        const complianceRate = totalContracts.count > 0
            ? Math.round((activeContracts.count / totalContracts.count) * 100)
            : 0;

        return {
            totalSpend: Number(spendResult?.total || 0),
            activeSuppliers: activeSupplierResult?.count || 0,
            criticalRFQs: openRfqResult[0]?.count || 0,
            complianceRate
        };
    } catch (error) {
        console.error("Failed to fetch intelligence dashboard stats:", error);
        return {
            totalSpend: 0,
            activeSuppliers: 0,
            criticalRFQs: 0,
            complianceRate: 0
        };
    }
}

export async function getRecentRFQs() {
    try {
        const data = await db.query.rfqs.findMany({
            orderBy: [desc(rfqs.createdAt)],
            limit: 5
        });

        // Ensure we always have an expiry date or something similar if the UI expects it
        return data.map(rfq => ({
            ...rfq,
            expiryDate: new Date(rfq.createdAt!.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() // Mock expiry 2 weeks after creation
        }));
    } catch (e) {
        console.error("Failed to fetch recent RFQs:", e);
        return [];
    }
}
