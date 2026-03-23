'use server'

import { db } from "@/db";
import { parts, procurementOrders, orderItems } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { getAiModel } from "@/lib/ai-provider";

export async function getSuggestedReplenishments() {
    try {
        // 1. Find parts where stockLevel < minStockLevel (or just low)
        const allParts = await db.select().from(parts);

        // 2. Aggregate demand from last 30 days using real order data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentDemand = await db.select({
            partId: orderItems.partId,
            totalQuantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.mapWith(Number),
        })
            .from(orderItems)
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .where(sql`${procurementOrders.createdAt} >= ${thirtyDaysAgo}`)
            .groupBy(orderItems.partId);

        const demandMap = new Map(recentDemand.map(row => [row.partId, row.totalQuantity]));

        const suggestions = [];

        for (const part of allParts) {
            const stock = part.stockLevel || 0;
            const minStock = part.minStockLevel || 10;

            if (stock <= minStock) {
                const recentQty = demandMap.get(part.id) || 0;
                // Use real monthly demand if available, otherwise fall back to minStock as baseline
                const avgMonthlyDemand = recentQty > 0 ? recentQty : minStock;

                suggestions.push({
                    partId: part.id,
                    partName: part.name,
                    sku: part.sku,
                    currentStock: stock,
                    minStock: minStock,
                    avgMonthlyDemand: Math.round(avgMonthlyDemand),
                    urgency: stock === 0 ? 'critical' : (stock < minStock * 0.5 ? 'high' : 'medium')
                });
            }
        }

        return suggestions;
    } catch (error) {
        console.error("Replenishment suggestion failed:", error);
        return [];
    }
}

export async function predictReplenishmentAlert(partId: string) {
    try {
        const [part] = await db.select().from(parts).where(eq(parts.id, partId));
        if (!part) return null;

        const prompt = `
            You are a Supply Chain Analysis Agent for Axiom Ultra.
            Analyze this part:
            Name: ${part.name}
            SKU: ${part.sku}
            Current Stock: ${part.stockLevel}
            Min Stock Threshold: ${part.minStockLevel}
            Category: ${part.category}

            Based on this, predict:
            1. Days until stock-out (simulated based on category demand patterns).
            2. Recommended replenishment quantity.
            3. Risk level (0-100).
            4. A short "Strategic Insight" for the procurement manager.

            Return ONLY a JSON object:
            {
                "daysUntilStockOut": number,
                "recommendedQuantity": number,
                "riskLevel": number,
                "insight": "string"
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error("AI Prediction Error:", error);
        return null;
    }
}
