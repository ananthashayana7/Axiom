import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orderItems, parts, procurementOrders, demandForecasts } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { getAiModel } from '@/lib/ai-provider';

export async function GET() {
    try {
        // 1. Aggregate order history per part per month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyDemand = await db.select({
            partId: orderItems.partId,
            partName: parts.name,
            category: parts.category,
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`,
            totalQuantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`.mapWith(Number),
        })
            .from(orderItems)
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .where(sql`${procurementOrders.createdAt} >= ${twelveMonthsAgo}`)
            .groupBy(orderItems.partId, parts.name, parts.category, sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`)
            .orderBy(orderItems.partId, sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`);

        if (monthlyDemand.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No order history found for forecasting',
                forecastsGenerated: 0,
            });
        }

        // 2. Group by partId
        const partGroups = new Map<string, { name: string; category: string; series: { month: string; qty: number }[] }>();
        for (const row of monthlyDemand) {
            if (!row.partId) continue;
            if (!partGroups.has(row.partId)) {
                partGroups.set(row.partId, { name: row.partName, category: row.category, series: [] });
            }
            partGroups.get(row.partId)!.series.push({ month: row.month, qty: row.totalQuantity });
        }

        // 3. Generate forecasts using Gemini
        const model = await getAiModel();
        let forecastsGenerated = 0;
        const errors: string[] = [];

        for (const [partId, data] of partGroups) {
            if (data.series.length < 2) continue; // Need at least 2 data points

            try {
                if (model) {
                    const prompt = `You are a demand forecasting AI for procurement.
Given monthly demand data for "${data.name}" (category: ${data.category}):
${data.series.map(s => `${s.month}: ${s.qty} units`).join('\n')}

Predict demand for the next 3 months. Return ONLY a JSON array:
[
    {"month": "YYYY-MM", "quantity": number, "lower": number, "upper": number, "trend": "up"|"down"|"stable", "factor": "string explaining key factor"}
]`;
                    const result = await model.generateContent(prompt);
                    const text = result.response.text();
                    const jsonMatch = text.match(/\[[\s\S]*\]/);

                    if (jsonMatch) {
                        const predictions = JSON.parse(jsonMatch[0]);

                        for (const pred of predictions) {
                            const forecastDate = new Date(`${pred.month}-01`);
                            if (isNaN(forecastDate.getTime())) continue;

                            await db.insert(demandForecasts).values({
                                partId,
                                forecastDate,
                                predictedQuantity: Math.round(pred.quantity),
                                confidenceLower: Math.round(pred.lower || pred.quantity * 0.8),
                                confidenceUpper: Math.round(pred.upper || pred.quantity * 1.2),
                                trend: pred.trend || 'stable',
                                factors: pred.factor || null,
                            });
                            forecastsGenerated++;
                        }
                    }
                } else {
                    // Heuristic fallback: simple moving average
                    const quantities = data.series.map(s => s.qty);
                    const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
                    const trend = quantities.length >= 2
                        ? (quantities[quantities.length - 1] > quantities[0] ? 'up' : quantities[quantities.length - 1] < quantities[0] ? 'down' : 'stable')
                        : 'stable';

                    const now = new Date();
                    for (let i = 1; i <= 3; i++) {
                        const forecastDate = new Date(now);
                        forecastDate.setMonth(forecastDate.getMonth() + i);
                        forecastDate.setDate(1);

                        await db.insert(demandForecasts).values({
                            partId,
                            forecastDate,
                            predictedQuantity: Math.round(avg),
                            confidenceLower: Math.round(avg * 0.7),
                            confidenceUpper: Math.round(avg * 1.3),
                            trend,
                            factors: 'Moving average heuristic (AI unavailable)',
                        });
                        forecastsGenerated++;
                    }
                }
            } catch (e) {
                errors.push(`Part ${partId}: ${e instanceof Error ? e.message : 'Failed'}`);
            }
        }

        return NextResponse.json({
            success: true,
            forecastsGenerated,
            partsAnalyzed: partGroups.size,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Demand Forecast] Cron failed:', error);
        return NextResponse.json({ error: 'Forecast generation failed' }, { status: 500 });
    }
}
