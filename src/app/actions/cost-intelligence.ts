'use server';

import { db } from "@/db";
import { savingsRecords, marketPriceIndex, parts, procurementOrders, rfqSuppliers, rfqs } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ============================================================================
// COST INTELLIGENCE - Should-cost, savings taxonomy, benchmarks
// ============================================================================

async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

// ── Savings Records ──

export async function createSavingsRecord(data: {
    entityType: string;
    entityId: string;
    category: 'negotiated' | 'avoided' | 'process' | 'logistics' | 'payment_term' | 'should_cost' | 'consolidation' | 'volume_discount';
    forecastAmount: number;
    realizedAmount?: number;
    baselineAmount?: number;
    currency?: string;
    notes?: string;
}) {
    const user = await requireAuth();

    const [record] = await db.insert(savingsRecords).values({
        entityType: data.entityType,
        entityId: data.entityId,
        category: data.category,
        trackingStatus: data.realizedAmount ? 'realized' : 'forecast',
        forecastAmount: String(data.forecastAmount),
        realizedAmount: data.realizedAmount ? String(data.realizedAmount) : null,
        baselineAmount: data.baselineAmount ? String(data.baselineAmount) : null,
        currency: data.currency || 'INR',
        notes: data.notes,
    }).returning();

    revalidatePath('/admin/analytics');
    return record;
}

export async function getSavingsByCategory() {
    await requireAuth();

    const savings = await db.select({
        category: savingsRecords.category,
        totalForecast: sql<string>`sum(${savingsRecords.forecastAmount})`,
        totalRealized: sql<string>`sum(coalesce(${savingsRecords.realizedAmount}, '0'))`,
        count: sql<number>`count(*)::int`,
    }).from(savingsRecords)
      .groupBy(savingsRecords.category)
      .orderBy(desc(sql`sum(${savingsRecords.forecastAmount})`));

    return savings;
}

export async function getSavingsOverview() {
    await requireAuth();

    const [forecast] = await db.select({
        total: sql<string>`coalesce(sum(${savingsRecords.forecastAmount}), '0')`,
    }).from(savingsRecords)
      .where(eq(savingsRecords.trackingStatus, 'forecast'));

    const [realized] = await db.select({
        total: sql<string>`coalesce(sum(${savingsRecords.realizedAmount}), '0')`,
    }).from(savingsRecords)
      .where(inArray(savingsRecords.trackingStatus, ['realized', 'validated']));

    const byStatus = await db.select({
        status: savingsRecords.trackingStatus,
        total: sql<string>`sum(${savingsRecords.forecastAmount})`,
        count: sql<number>`count(*)::int`,
    }).from(savingsRecords)
      .groupBy(savingsRecords.trackingStatus);

    return {
        totalForecast: forecast?.total || '0',
        totalRealized: realized?.total || '0',
        byStatus,
    };
}

export async function validateSavings(recordId: string) {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const [updated] = await db.update(savingsRecords)
        .set({
            trackingStatus: 'validated',
            validatedById: user.id as string,
            validatedAt: new Date(),
        })
        .where(eq(savingsRecords.id, recordId))
        .returning();

    revalidatePath('/admin/analytics');
    return updated;
}

// ── Market Benchmarks ──

export async function upsertBenchmark(data: {
    partCategory: string;
    commodity?: string;
    benchmarkPrice: number;
    source: string;
    validFrom?: Date;
    validTo?: Date;
}) {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const [record] = await db.insert(marketPriceIndex).values({
        partCategory: data.partCategory,
        commodity: data.commodity,
        benchmarkPrice: String(data.benchmarkPrice),
        source: data.source,
        validFrom: data.validFrom || new Date(),
        validTo: data.validTo,
    }).returning();

    revalidatePath('/admin/analytics');
    return record;
}

export async function getBenchmarks(category?: string) {
    await requireAuth();

    const conditions: any[] = [];
    if (category) conditions.push(eq(marketPriceIndex.partCategory, category));

    const benchmarks = await db.select()
        .from(marketPriceIndex)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(marketPriceIndex.createdAt));

    return benchmarks;
}

// ── Should-Cost Analysis ──

export async function computeShouldCost(partId: string) {
    await requireAuth();

    // Get part details
    const partRows = await db.select().from(parts).where(eq(parts.id, partId));
    const part = partRows[0];
    if (!part) throw new Error('Part not found');

    // Get benchmark price
    const benchmarks = await db.select()
        .from(marketPriceIndex)
        .where(eq(marketPriceIndex.partCategory, part.category))
        .orderBy(desc(marketPriceIndex.createdAt))
        .limit(1);

    // Get historical order prices
    const historicalPrices = await db.select({
        unitPrice: sql<string>`oi.unit_price`,
        createdAt: procurementOrders.createdAt,
    }).from(procurementOrders)
      .innerJoin(sql`order_items oi`, sql`oi.order_id = ${procurementOrders.id}`)
      .where(sql`oi.part_id = ${partId}`)
      .orderBy(desc(procurementOrders.createdAt))
      .limit(10);

    // Get RFQ quote spread
    const quoteSpread = await db.select({
        quoteAmount: rfqSuppliers.quoteAmount,
        supplierName: sql<string>`s.name`,
    }).from(rfqSuppliers)
      .innerJoin(sql`rfq_items ri`, sql`ri.rfq_id = ${rfqSuppliers.rfqId}`)
      .innerJoin(sql`suppliers s`, sql`s.id = ${rfqSuppliers.supplierId}`)
      .where(and(
          sql`ri.part_id = ${partId}`,
          sql`${rfqSuppliers.quoteAmount} IS NOT NULL`
      ))
      .orderBy(desc(rfqSuppliers.createdAt))
      .limit(10);

    const benchmark = benchmarks[0];
    const currentPrice = Number(part.price);
    const benchmarkPrice = benchmark ? Number(benchmark.benchmarkPrice) : null;
    const avgHistorical = historicalPrices.length > 0
        ? historicalPrices.reduce((sum, p) => sum + Number(p.unitPrice), 0) / historicalPrices.length
        : null;
    const avgQuote = quoteSpread.length > 0
        ? quoteSpread.reduce((sum, q) => sum + Number(q.quoteAmount), 0) / quoteSpread.length
        : null;

    // Should-cost = weighted blend of available signals
    let shouldCost = currentPrice;
    let factors = 0;
    let total = 0;
    if (benchmarkPrice) { total += benchmarkPrice * 3; factors += 3; }
    if (avgHistorical) { total += avgHistorical * 2; factors += 2; }
    if (avgQuote) { total += avgQuote * 1; factors += 1; }
    if (factors > 0) shouldCost = total / factors;

    const savingsOpportunity = currentPrice - shouldCost;
    const savingsPercent = currentPrice > 0 ? (savingsOpportunity / currentPrice) * 100 : 0;

    return {
        partId,
        partName: part.name,
        partCategory: part.category,
        currentPrice,
        shouldCost: Math.round(shouldCost * 100) / 100,
        benchmarkPrice,
        benchmarkSource: benchmark?.source || null,
        avgHistoricalPrice: avgHistorical ? Math.round(avgHistorical * 100) / 100 : null,
        avgQuotePrice: avgQuote ? Math.round(avgQuote * 100) / 100 : null,
        quoteCount: quoteSpread.length,
        savingsOpportunity: Math.round(savingsOpportunity * 100) / 100,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
        historicalPrices: historicalPrices.map(p => ({
            price: Number(p.unitPrice),
            date: p.createdAt,
        })),
    };
}

// ── RFQ Cost Recommendations ──

export async function getRFQCostInsights(rfqId: string) {
    await requireAuth();

    const rfqData = await db.select({
        supplierId: rfqSuppliers.supplierId,
        supplierName: sql<string>`s.name`,
        quoteAmount: rfqSuppliers.quoteAmount,
        status: rfqSuppliers.status,
    }).from(rfqSuppliers)
      .innerJoin(sql`suppliers s`, sql`s.id = ${rfqSuppliers.supplierId}`)
      .where(eq(rfqSuppliers.rfqId, rfqId));

    const quotedSuppliers = rfqData.filter(s => s.quoteAmount);

    if (quotedSuppliers.length === 0) {
        return { hasData: false, insights: [], cheapest: null, spread: 0 };
    }

    const amounts = quotedSuppliers.map(s => Number(s.quoteAmount));
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const spread = maxAmount - minAmount;

    const cheapest = quotedSuppliers.find(s => Number(s.quoteAmount) === minAmount);

    const insights = [];

    if (spread > 0) {
        const spreadPercent = ((spread / avgAmount) * 100).toFixed(1);
        insights.push({
            type: 'spread_analysis',
            message: `Quote spread is ${spreadPercent}% (${spread.toLocaleString()}) — indicates room for negotiation.`,
            impact: spread > avgAmount * 0.2 ? 'high' : 'medium',
        });
    }

    if (quotedSuppliers.length >= 3) {
        const sortedAmounts = [...amounts].sort((a, b) => a - b);
        const secondBest = sortedAmounts[1];
        const leverageSavings = secondBest - minAmount;
        if (leverageSavings > 0) {
            insights.push({
                type: 'leverage_opportunity',
                message: `Using ${cheapest?.supplierName} saves ${leverageSavings.toLocaleString()} vs next best quote.`,
                impact: 'medium',
            });
        }
    }

    return {
        hasData: true,
        insights,
        cheapest: cheapest ? { name: cheapest.supplierName, amount: Number(cheapest.quoteAmount) } : null,
        avgAmount: Math.round(avgAmount),
        spread,
        quoteCount: quotedSuppliers.length,
    };
}
