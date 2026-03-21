/**
 * Demand Forecasting Agent
 * AI-powered demand prediction based on historical order patterns
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import { parts, orderItems, procurementOrders, demandForecasts } from "@/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { getAiModel } from "@/lib/ai-provider";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult, DemandForecast } from "@/lib/ai/agent-types";

/**
 * Main demand forecasting function
 * Analyzes historical order patterns and predicts future demand
 */
export async function runDemandForecastingAgent(
    partIds?: string[],
    forecastDays: number = 30
): Promise<AgentResult<DemandForecast[]>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "demand-forecasting",
            timestamp: new Date()
        };
    }

    try {
        // Fetch historical order data (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        // Build query for historical consumption
        const historicalQuery = db
            .select({
                partId: orderItems.partId,
                partName: parts.name,
                sku: parts.sku,
                category: parts.category,
                orderMonth: sql<string>`TO_CHAR(${procurementOrders.createdAt}, 'YYYY-MM')`,
                totalQuantity: sql<number>`SUM(${orderItems.quantity})::int`,
                avgUnitPrice: sql<number>`AVG(${orderItems.unitPrice})::numeric`,
                currentStock: parts.stockLevel,
                reorderPoint: parts.reorderPoint,
                minStockLevel: parts.minStockLevel
            })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .where(
                and(
                    gte(procurementOrders.createdAt, twelveMonthsAgo),
                    partIds && partIds.length > 0
                        ? sql`${orderItems.partId} = ANY(${partIds})`
                        : sql`1=1`
                )
            )
            .groupBy(
                orderItems.partId,
                parts.name,
                parts.sku,
                parts.category,
                sql`TO_CHAR(${procurementOrders.createdAt}, 'YYYY-MM')`,
                parts.stockLevel,
                parts.reorderPoint,
                parts.minStockLevel
            )
            .orderBy(desc(sql`TO_CHAR(${procurementOrders.createdAt}, 'YYYY-MM')`));

        const historicalData = await historicalQuery;

        if (historicalData.length === 0) {
            return {
                success: true,
                data: [],
                confidence: 100,
                executionTimeMs: Date.now() - startTime,
                agentName: "demand-forecasting",
                timestamp: new Date(),
                reasoning: "No historical order data available for forecasting"
            };
        }

        // Group by part for analysis
        const partGroups = new Map<string, typeof historicalData>();
        for (const row of historicalData) {
            const existing = partGroups.get(row.partId) || [];
            existing.push(row);
            partGroups.set(row.partId, existing);
        }

        const forecasts: DemandForecast[] = [];

        for (const [partId, history] of partGroups) {
            const partInfo = history[0];

            // Calculate trend and statistics using AI
            const aiResult = await generateForecastWithAI(partInfo, history, forecastDays);

            if (aiResult) {
                forecasts.push({
                    partId,
                    partName: partInfo.partName,
                    sku: partInfo.sku,
                    forecastDate: new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000),
                    predictedQuantity: aiResult.predictedQuantity,
                    confidenceLower: aiResult.confidenceLower,
                    confidenceUpper: aiResult.confidenceUpper,
                    trend: aiResult.trend,
                    seasonalityFactor: aiResult.seasonalityFactor,
                    factors: aiResult.factors
                });

                // Store forecast in database
                await db.insert(demandForecasts).values({
                    partId,
                    forecastDate: new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000),
                    predictedQuantity: aiResult.predictedQuantity,
                    confidenceLower: aiResult.confidenceLower,
                    confidenceUpper: aiResult.confidenceUpper,
                    trend: aiResult.trend,
                    seasonalityFactor: aiResult.seasonalityFactor?.toString(),
                    factors: JSON.stringify(aiResult.factors)
                });
            }
        }

        await TelemetryService.trackMetric(
            "DemandForecastingAgent",
            "forecasts_generated",
            forecasts.length
        );

        return {
            success: true,
            data: forecasts,
            confidence: calculateOverallConfidence(forecasts),
            executionTimeMs: Date.now() - startTime,
            agentName: "demand-forecasting",
            timestamp: new Date(),
            reasoning: `Generated ${forecasts.length} demand forecasts based on ${historicalData.length} historical data points`,
            sources: ["order_history", "parts_inventory", "seasonal_patterns"]
        };

    } catch (error) {
        console.error("Demand Forecasting Error:", error);
        await TelemetryService.trackError(
            "DemandForecastingAgent",
            "forecast_failed",
            error instanceof Error ? error : new Error(String(error))
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Forecast generation failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "demand-forecasting",
            timestamp: new Date()
        };
    }
}

/**
 * Generate forecast using AI model
 */
async function generateForecastWithAI(
    partInfo: { partName: string; sku: string; category: string; currentStock: number | null; reorderPoint: number | null },
    history: { orderMonth: string; totalQuantity: number }[],
    forecastDays: number
): Promise<{
    predictedQuantity: number;
    confidenceLower: number;
    confidenceUpper: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    seasonalityFactor?: number;
    factors: string[];
} | null> {
    try {
        const model = await getAiModel();

        // If no AI model available, use statistical fallback immediately
        if (!model) throw new Error("AI model not available");

        const prompt = `
            You are a demand forecasting expert. Analyze the following historical order data and provide a demand forecast.
            
            Part Information:
            - Name: ${partInfo.partName}
            - SKU: ${partInfo.sku}
            - Category: ${partInfo.category}
            - Current Stock: ${partInfo.currentStock ?? 'Unknown'}
            - Reorder Point: ${partInfo.reorderPoint ?? 'Unknown'}
            
            Historical Monthly Consumption (most recent first):
            ${history.map(h => `${h.orderMonth}: ${h.totalQuantity} units`).join('\n')}
            
            Forecast Period: Next ${forecastDays} days
            
            Analyze:
            1. Trend (increasing, stable, decreasing)
            2. Seasonality patterns
            3. Average monthly consumption
            4. Any anomalies in the data
            
            Return ONLY valid JSON in this exact format:
            {
                "predictedQuantity": <number>,
                "confidenceLower": <number>,
                "confidenceUpper": <number>,
                "trend": "increasing" | "stable" | "decreasing",
                "seasonalityFactor": <number between 0.5 and 2.0>,
                "factors": ["factor1", "factor2"]
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                predictedQuantity: Math.round(parsed.predictedQuantity),
                confidenceLower: Math.round(parsed.confidenceLower),
                confidenceUpper: Math.round(parsed.confidenceUpper),
                trend: parsed.trend,
                seasonalityFactor: parsed.seasonalityFactor,
                factors: parsed.factors || []
            };
        }
    } catch (error) {
        console.warn("AI forecast failed, using statistical fallback:", error);
    }

    // Fallback: Simple statistical forecast if AI fails
    const quantities = history.map(h => h.totalQuantity);
    if (quantities.length === 0) {
        return {
            predictedQuantity: 0,
            confidenceLower: 0,
            confidenceUpper: 0,
            trend: 'stable' as const,
            factors: ["Insufficient historical data for forecast"]
        };
    }
    const avgMonthly = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const dailyRate = avgMonthly / 30;
    const predicted = Math.round(dailyRate * forecastDays);

    // Calculate trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (quantities.length >= 3) {
        const recentAvg = (quantities[0] + quantities[1]) / 2;
        const olderAvg = (quantities[quantities.length - 2] + quantities[quantities.length - 1]) / 2;
        if (recentAvg > olderAvg * 1.1) trend = 'increasing';
        else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
    }

    return {
        predictedQuantity: predicted,
        confidenceLower: Math.round(predicted * 0.7),
        confidenceUpper: Math.round(predicted * 1.3),
        trend,
        factors: ["Statistical average based on historical data"]
    };
}

/**
 * Calculate overall confidence from individual forecasts
 */
function calculateOverallConfidence(forecasts: DemandForecast[]): number {
    if (forecasts.length === 0) return 0;

    // Based on confidence interval width - narrower = higher confidence
    const confidenceScores = forecasts.map(f => {
        const range = f.confidenceUpper - f.confidenceLower;
        const median = f.predictedQuantity;
        if (median === 0) return 50;
        const relativeRange = range / median;
        // Convert to 0-100 scale (narrower range = higher score)
        return Math.max(0, Math.min(100, 100 - (relativeRange * 50)));
    });

    return confidenceScores.length > 0
        ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
        : 50;
}

/**
 * Get parts that need replenishment based on forecasts
 */
export async function getReplenishmentAlerts(): Promise<{
    partId: string;
    partName: string;
    sku: string;
    currentStock: number;
    predictedDemand: number;
    daysUntilStockout: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    suggestedOrderQuantity: number;
}[]> {
    const session = await auth();
    if (!session?.user) return [];

    try {
        // Get latest forecasts with current stock levels
        const alertData = await db
            .select({
                partId: demandForecasts.partId,
                partName: parts.name,
                sku: parts.sku,
                currentStock: parts.stockLevel,
                predictedQuantity: demandForecasts.predictedQuantity,
                forecastDate: demandForecasts.forecastDate,
                minStockLevel: parts.minStockLevel,
                reorderPoint: parts.reorderPoint
            })
            .from(demandForecasts)
            .innerJoin(parts, eq(demandForecasts.partId, parts.id))
            .orderBy(desc(demandForecasts.createdAt))
            .limit(50);

        const alerts = alertData.map(row => {
            const dailyDemand = row.predictedQuantity / 30; // Assuming 30-day forecast
            const daysUntilStockout = dailyDemand > 0
                ? Math.floor((row.currentStock ?? 0) / dailyDemand)
                : 999;

            let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (daysUntilStockout <= 3) urgency = 'critical';
            else if (daysUntilStockout <= 7) urgency = 'high';
            else if (daysUntilStockout <= 14) urgency = 'medium';

            // Suggest order quantity to cover 60 days + buffer
            const suggestedOrderQuantity = Math.max(
                (row.reorderPoint ?? 50),
                Math.ceil(dailyDemand * 60 * 1.2) // 60 days with 20% buffer
            );

            return {
                partId: row.partId,
                partName: row.partName,
                sku: row.sku,
                currentStock: row.currentStock ?? 0,
                predictedDemand: row.predictedQuantity,
                daysUntilStockout,
                urgency,
                suggestedOrderQuantity
            };
        });

        // Sort by urgency (critical first)
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    } catch (error) {
        console.error("Failed to get replenishment alerts:", error);
        return [];
    }
}
