'use server';

import { db } from "@/db";
import { savingsRecords, marketPriceIndex, parts, procurementOrders, rfqSuppliers, rfqs, orderItems, rfqItems, suppliers } from "@/db/schema";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
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

const INTERNAL_BENCHMARK_SOURCE = 'Axiom Internal Intelligence';

type ParsedQuoteAnalysis = {
    deliveryWeeks: number | null;
    terms: string | null;
    highlights: string[];
    aiConfidence: number | null;
    notes: string | null;
};

function toNumber(value: string | number | null | undefined) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
}

function safeJsonParse<T>(value: string | null | undefined) {
    if (!value) return null;

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function normalizeDeliveryWeeks(raw: string | number | null | undefined) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (!raw) return null;

    const match = String(raw).match(/(\d+)\s*(weeks?|week|wks?|days?|day)/i);
    if (!match) return null;

    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) return null;
    return /day/i.test(match[2]) ? Math.max(1, Math.ceil(numeric / 7)) : numeric;
}

function parseQuoteAnalysis(value: string | null | undefined): ParsedQuoteAnalysis {
    const parsed = safeJsonParse<Record<string, unknown>>(value);
    const deliveryWeeks = normalizeDeliveryWeeks(
        typeof parsed?.deliveryWeeks === 'number'
            ? parsed.deliveryWeeks
            : typeof parsed?.deliveryLeadTime === 'string'
                ? parsed.deliveryLeadTime
                : typeof parsed?.leadTimeWeeks === 'number'
                    ? parsed.leadTimeWeeks
                    : null
    );

    const highlights = Array.isArray(parsed?.highlights)
        ? parsed.highlights.filter((item): item is string => typeof item === 'string')
        : [];

    return {
        deliveryWeeks,
        terms: typeof parsed?.terms === 'string'
            ? parsed.terms
            : typeof parsed?.paymentTerms === 'string'
                ? parsed.paymentTerms
                : null,
        highlights,
        aiConfidence: typeof parsed?.aiConfidence === 'number' ? parsed.aiConfidence : null,
        notes: typeof parsed?.notes === 'string' ? parsed.notes : null,
    };
}

function weightedAverage(signals: Array<{ value: number | null; weight: number }>, fallback: number) {
    const validSignals = signals.filter((signal) => signal.value !== null && Number.isFinite(signal.value));
    if (validSignals.length === 0) return fallback;

    const totalWeight = validSignals.reduce((sum, signal) => sum + signal.weight, 0);
    const weightedTotal = validSignals.reduce((sum, signal) => sum + (signal.value || 0) * signal.weight, 0);
    return totalWeight > 0 ? weightedTotal / totalWeight : fallback;
}

function scoreHigherBetter(value: number, minValue: number, maxValue: number) {
    if (!Number.isFinite(value)) return 0;
    if (maxValue === minValue) return 100;
    return ((value - minValue) / (maxValue - minValue)) * 100;
}

function scoreLowerBetter(value: number, minValue: number, maxValue: number) {
    if (!Number.isFinite(value)) return 0;
    if (maxValue === minValue) return 100;
    return ((maxValue - value) / (maxValue - minValue)) * 100;
}

function buildNegotiationPriority(data: {
    spreadPercent: number;
    shouldCostGap: number;
    quoteCount: number;
    benchmarkCoveragePercent: number;
}) {
    if (data.shouldCostGap > 0 && (data.spreadPercent >= 10 || data.quoteCount >= 3)) return 'critical';
    if (data.shouldCostGap > 0 || data.spreadPercent >= 8) return 'high';
    if (data.quoteCount >= 2 || data.benchmarkCoveragePercent >= 50) return 'medium';
    return 'low';
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

export async function syncInternalBenchmarks() {
    const user = await requireAuth();
    if (user.role !== 'admin') throw new Error('Admin access required');

    const lookbackStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const orderSignals = await db.select({
        category: parts.category,
        averagePrice: sql<string>`avg(cast(${orderItems.unitPrice} as numeric))`,
        priceFloor: sql<string>`min(cast(${orderItems.unitPrice} as numeric))`,
        priceCeiling: sql<string>`max(cast(${orderItems.unitPrice} as numeric))`,
        sampleCount: sql<number>`count(*)::int`,
    }).from(orderItems)
      .innerJoin(parts, eq(orderItems.partId, parts.id))
      .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
      .where(gte(procurementOrders.createdAt, lookbackStart))
      .groupBy(parts.category);

    const quoteSignals = await db.select({
        category: parts.category,
        averageQuote: sql<string>`avg(cast(${rfqSuppliers.quoteAmount} as numeric))`,
        quoteFloor: sql<string>`min(cast(${rfqSuppliers.quoteAmount} as numeric))`,
        quoteCeiling: sql<string>`max(cast(${rfqSuppliers.quoteAmount} as numeric))`,
        sampleCount: sql<number>`count(*)::int`,
    }).from(rfqSuppliers)
      .innerJoin(rfqItems, eq(rfqItems.rfqId, rfqSuppliers.rfqId))
      .innerJoin(parts, eq(rfqItems.partId, parts.id))
      .where(and(
          sql`${rfqSuppliers.quoteAmount} IS NOT NULL`,
          gte(rfqSuppliers.createdAt, lookbackStart)
      ))
      .groupBy(parts.category);

    const categoryMap = new Map<string, {
        orderAverage: number | null;
        quoteAverage: number | null;
        sampleCount: number;
        priceFloor: number | null;
        priceCeiling: number | null;
    }>();

    for (const signal of orderSignals) {
        categoryMap.set(signal.category, {
            orderAverage: toNumber(signal.averagePrice),
            quoteAverage: null,
            sampleCount: signal.sampleCount || 0,
            priceFloor: toNumber(signal.priceFloor),
            priceCeiling: toNumber(signal.priceCeiling),
        });
    }

    for (const signal of quoteSignals) {
        const existing = categoryMap.get(signal.category);
        categoryMap.set(signal.category, {
            orderAverage: existing?.orderAverage ?? null,
            quoteAverage: toNumber(signal.averageQuote),
            sampleCount: (existing?.sampleCount || 0) + (signal.sampleCount || 0),
            priceFloor: existing?.priceFloor ?? toNumber(signal.quoteFloor),
            priceCeiling: existing?.priceCeiling ?? toNumber(signal.quoteCeiling),
        });
    }

    const benchmarkRows = Array.from(categoryMap.entries())
        .map(([category, signal]) => {
            const benchmarkPrice = weightedAverage([
                { value: signal.orderAverage, weight: 3 },
                { value: signal.quoteAverage, weight: 2 },
            ], signal.orderAverage || signal.quoteAverage || 0);

            const volatilityBase = signal.orderAverage || signal.quoteAverage || 0;
            const volatility = volatilityBase > 0 && signal.priceFloor !== null && signal.priceCeiling !== null
                ? roundCurrency(((signal.priceCeiling - signal.priceFloor) / volatilityBase) * 100)
                : 0;

            return {
                partCategory: category,
                commodity: volatility >= 12 ? 'volatile' : volatility >= 5 ? 'watch' : 'stable',
                benchmarkPrice: String(roundCurrency(benchmarkPrice)),
                source: `${INTERNAL_BENCHMARK_SOURCE} (${signal.sampleCount} signals, ${volatility}% range)`,
                validFrom: new Date(),
            };
        })
        .filter((row) => toNumber(row.benchmarkPrice) > 0);

    if (benchmarkRows.length === 0) {
        return {
            success: false,
            message: 'No recent order or quote history was available to build benchmarks.',
            categoriesUpdated: 0,
        };
    }

    await db.insert(marketPriceIndex).values(benchmarkRows);

    revalidatePath('/sourcing');
    revalidatePath('/sourcing/rfqs');
    revalidatePath('/admin/analytics');

    return {
        success: true,
        categoriesUpdated: benchmarkRows.length,
        message: `Benchmarks refreshed for ${benchmarkRows.length} categories.`,
    };
}

export async function getMarketIntelligenceSummary() {
    await requireAuth();

    const latestBenchmarks = await db.select({
        partCategory: marketPriceIndex.partCategory,
        benchmarkPrice: marketPriceIndex.benchmarkPrice,
        commodity: marketPriceIndex.commodity,
        source: marketPriceIndex.source,
        createdAt: marketPriceIndex.createdAt,
    }).from(marketPriceIndex)
      .orderBy(desc(marketPriceIndex.createdAt));

    const benchmarkMap = new Map<string, {
        benchmarkPrice: number;
        commodity: string | null;
        source: string | null;
        createdAt: Date | null;
    }>();

    for (const benchmark of latestBenchmarks) {
        if (!benchmarkMap.has(benchmark.partCategory)) {
            benchmarkMap.set(benchmark.partCategory, {
                benchmarkPrice: toNumber(benchmark.benchmarkPrice),
                commodity: benchmark.commodity,
                source: benchmark.source,
                createdAt: benchmark.createdAt,
            });
        }
    }

    const categorySpend = await db.select({
        category: parts.category,
        totalSpend: sql<string>`coalesce(sum(cast(${orderItems.unitPrice} as numeric) * ${orderItems.quantity}), 0)`,
        averagePrice: sql<string>`coalesce(avg(cast(${orderItems.unitPrice} as numeric)), 0)`,
        lineCount: sql<number>`count(*)::int`,
    }).from(orderItems)
      .innerJoin(parts, eq(orderItems.partId, parts.id))
      .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
      .groupBy(parts.category)
      .orderBy(desc(sql`sum(cast(${orderItems.unitPrice} as numeric) * ${orderItems.quantity})`));

    const distinctCategories = await db.selectDistinct({
        category: parts.category,
    }).from(parts);

    const rfqQuoteSummary = await db.select({
        rfqId: rfqSuppliers.rfqId,
        quoteAmount: rfqSuppliers.quoteAmount,
    }).from(rfqSuppliers);

    const quoteReadiness = new Map<string, number>();
    for (const row of rfqQuoteSummary) {
        if (!row.quoteAmount) continue;
        quoteReadiness.set(row.rfqId, (quoteReadiness.get(row.rfqId) || 0) + 1);
    }

    const hotCategories = categorySpend.slice(0, 5).map((row) => {
        const benchmark = benchmarkMap.get(row.category);
        const averagePrice = toNumber(row.averagePrice);
        const benchmarkPrice = benchmark?.benchmarkPrice ?? 0;
        const gapPercent = benchmarkPrice > 0
            ? roundCurrency(((averagePrice - benchmarkPrice) / benchmarkPrice) * 100)
            : 0;

        return {
            category: row.category,
            averagePrice: roundCurrency(averagePrice),
            benchmarkPrice: roundCurrency(benchmarkPrice),
            spend: roundCurrency(toNumber(row.totalSpend)),
            lineCount: row.lineCount,
            gapPercent,
            signal: benchmark?.commodity || 'untracked',
            source: benchmark?.source || 'Historical order intelligence',
        };
    });

    const benchmarkCoverage = distinctCategories.length > 0
        ? roundCurrency((benchmarkMap.size / distinctCategories.length) * 100)
        : 0;

    return {
        benchmarkCoverage,
        categoriesTracked: benchmarkMap.size,
        totalCategories: distinctCategories.length,
        rfqsReadyForNegotiation: Array.from(quoteReadiness.values()).filter((count) => count >= 2).length,
        hotCategories,
        lastBenchmarkRefresh: latestBenchmarks[0]?.createdAt || null,
    };
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

export async function getRFQNegotiationWorkbench(rfqId: string) {
    await requireAuth();

    const [rfq] = await db.select({
        id: rfqs.id,
        title: rfqs.title,
        status: rfqs.status,
        createdAt: rfqs.createdAt,
    }).from(rfqs)
      .where(eq(rfqs.id, rfqId))
      .limit(1);

    if (!rfq) {
        throw new Error('RFQ not found');
    }

    const items = await db.select({
        partId: parts.id,
        sku: parts.sku,
        partName: parts.name,
        category: parts.category,
        quantity: rfqItems.quantity,
        currentPrice: parts.price,
        marketTrend: parts.marketTrend,
    }).from(rfqItems)
      .innerJoin(parts, eq(rfqItems.partId, parts.id))
      .where(eq(rfqItems.rfqId, rfqId));

    const partIds = items.map((item) => item.partId);
    const categories = Array.from(new Set(items.map((item) => item.category)));

    const historicalRows = partIds.length > 0
        ? await db.select({
            partId: orderItems.partId,
            averagePrice: sql<string>`avg(cast(${orderItems.unitPrice} as numeric))`,
            observationCount: sql<number>`count(*)::int`,
        }).from(orderItems)
          .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
          .where(inArray(orderItems.partId, partIds))
          .groupBy(orderItems.partId)
        : [];

    const historicalMap = new Map<string, { averagePrice: number; observationCount: number }>();
    for (const row of historicalRows) {
        historicalMap.set(row.partId, {
            averagePrice: toNumber(row.averagePrice),
            observationCount: row.observationCount,
        });
    }

    const benchmarkRows = categories.length > 0
        ? await db.select({
            partCategory: marketPriceIndex.partCategory,
            benchmarkPrice: marketPriceIndex.benchmarkPrice,
            source: marketPriceIndex.source,
            commodity: marketPriceIndex.commodity,
            createdAt: marketPriceIndex.createdAt,
        }).from(marketPriceIndex)
          .where(inArray(marketPriceIndex.partCategory, categories))
          .orderBy(desc(marketPriceIndex.createdAt))
        : [];

    const benchmarkMap = new Map<string, {
        benchmarkPrice: number;
        source: string | null;
        commodity: string | null;
        createdAt: Date | null;
    }>();

    for (const row of benchmarkRows) {
        if (!benchmarkMap.has(row.partCategory)) {
            benchmarkMap.set(row.partCategory, {
                benchmarkPrice: toNumber(row.benchmarkPrice),
                source: row.source,
                commodity: row.commodity,
                createdAt: row.createdAt,
            });
        }
    }

    const itemBenchmarks = items.map((item) => {
        const benchmark = benchmarkMap.get(item.category);
        const historical = historicalMap.get(item.partId);
        const currentUnitPrice = toNumber(item.currentPrice);
        const benchmarkUnitPrice = benchmark?.benchmarkPrice ?? null;
        const historicalUnitPrice = historical?.averagePrice ?? null;
        const shouldCostUnitPrice = weightedAverage([
            { value: benchmarkUnitPrice, weight: 3 },
            { value: historicalUnitPrice, weight: 2 },
            { value: currentUnitPrice > 0 ? currentUnitPrice : null, weight: 1 },
        ], currentUnitPrice);
        const quantity = Number(item.quantity || 0);

        return {
            partId: item.partId,
            sku: item.sku,
            partName: item.partName,
            category: item.category,
            quantity,
            marketTrend: item.marketTrend,
            currentUnitPrice: roundCurrency(currentUnitPrice),
            benchmarkUnitPrice: benchmarkUnitPrice !== null ? roundCurrency(benchmarkUnitPrice) : null,
            historicalUnitPrice: historicalUnitPrice !== null ? roundCurrency(historicalUnitPrice) : null,
            shouldCostUnitPrice: roundCurrency(shouldCostUnitPrice),
            shouldCostTotal: roundCurrency(shouldCostUnitPrice * quantity),
            benchmarkSource: benchmark?.source || null,
            benchmarkSignal: benchmark?.commodity || null,
            historicalObservations: historical?.observationCount || 0,
        };
    });

    const quotes = await db.select({
        supplierId: rfqSuppliers.supplierId,
        supplierName: suppliers.name,
        quoteAmount: rfqSuppliers.quoteAmount,
        status: rfqSuppliers.status,
        aiAnalysis: rfqSuppliers.aiAnalysis,
        performanceScore: suppliers.performanceScore,
        riskScore: suppliers.riskScore,
        financialScore: suppliers.financialScore,
        esgScore: suppliers.esgScore,
        collaborationScore: suppliers.collaborationScore,
    }).from(rfqSuppliers)
      .innerJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
      .where(eq(rfqSuppliers.rfqId, rfqId));

    const quotedSuppliers = quotes
        .filter((quote) => quote.quoteAmount)
        .map((quote) => {
            const analysis = parseQuoteAnalysis(quote.aiAnalysis);
            return {
                supplierId: quote.supplierId,
                supplierName: quote.supplierName,
                quoteAmount: roundCurrency(toNumber(quote.quoteAmount)),
                status: quote.status,
                analysis,
                performanceScore: quote.performanceScore || 0,
                riskScore: quote.riskScore || 0,
                financialScore: quote.financialScore || 0,
                esgScore: quote.esgScore || 0,
                collaborationScore: quote.collaborationScore || 0,
            };
        });

    const shouldCostTotal = roundCurrency(itemBenchmarks.reduce((sum, item) => sum + item.shouldCostTotal, 0));
    const benchmarkCoveragePercent = itemBenchmarks.length > 0
        ? roundCurrency((itemBenchmarks.filter((item) => item.benchmarkUnitPrice !== null || item.historicalUnitPrice !== null).length / itemBenchmarks.length) * 100)
        : 0;

    if (quotedSuppliers.length === 0) {
        return {
            hasQuotes: false,
            rfqId,
            rfqTitle: rfq.title,
            rfqStatus: rfq.status,
            benchmarkCoveragePercent,
            shouldCostTotal,
            itemBenchmarks,
            supplierRankings: [],
            quoteCount: 0,
            priceSpread: 0,
            spreadPercent: 0,
            competitiveBaseline: null,
            bestQuoteAmount: null,
            negotiationPriority: 'low' as const,
            shouldCostGap: 0,
            competitiveSavings: 0,
            actionPlan: [
                'Launch the event or collect supplier quotes before starting a negotiation workflow.',
            ],
            recommendedSupplier: null,
        };
    }

    const quoteAmounts = quotedSuppliers.map((quote) => quote.quoteAmount);
    const minAmount = Math.min(...quoteAmounts);
    const maxAmount = Math.max(...quoteAmounts);
    const avgAmount = quoteAmounts.reduce((sum, amount) => sum + amount, 0) / quoteAmounts.length;
    const sortedAmounts = [...quoteAmounts].sort((left, right) => left - right);
    const competitiveBaseline = sortedAmounts.length > 1 ? sortedAmounts[1] : avgAmount;
    const priceSpread = roundCurrency(maxAmount - minAmount);
    const spreadPercent = avgAmount > 0 ? roundCurrency((priceSpread / avgAmount) * 100) : 0;
    const shouldCostGap = shouldCostTotal > 0 ? roundCurrency(Math.max(minAmount - shouldCostTotal, 0)) : 0;
    const competitiveSavings = roundCurrency(Math.max(competitiveBaseline - minAmount, 0));

    const deliveryValues = quotedSuppliers
        .map((quote) => quote.analysis.deliveryWeeks)
        .filter((value): value is number => value !== null);
    const minDelivery = deliveryValues.length > 0 ? Math.min(...deliveryValues) : 0;
    const maxDelivery = deliveryValues.length > 0 ? Math.max(...deliveryValues) : 0;
    const performanceValues = quotedSuppliers.map((quote) => quote.performanceScore);
    const minPerformance = Math.min(...performanceValues);
    const maxPerformance = Math.max(...performanceValues);

    const supplierRankings = quotedSuppliers.map((quote) => {
        const deliveryWeeks = quote.analysis.deliveryWeeks ?? (maxDelivery || 0);
        const priceScore = scoreLowerBetter(quote.quoteAmount, minAmount, maxAmount);
        const deliveryScore = deliveryValues.length > 0
            ? scoreLowerBetter(deliveryWeeks, minDelivery, maxDelivery)
            : 70;
        const performanceScore = scoreHigherBetter(quote.performanceScore, minPerformance, maxPerformance);
        const riskAdjustedScore = 100 - quote.riskScore;
        const totalScore = roundCurrency(
            priceScore * 0.45 +
            deliveryScore * 0.15 +
            performanceScore * 0.2 +
            riskAdjustedScore * 0.12 +
            quote.financialScore * 0.05 +
            quote.collaborationScore * 0.03
        );

        const deltaVsBest = roundCurrency(quote.quoteAmount - minAmount);
        const deltaVsShouldCost = shouldCostTotal > 0 ? roundCurrency(quote.quoteAmount - shouldCostTotal) : null;
        const levers = [
            deltaVsShouldCost !== null && deltaVsShouldCost > 0
                ? `Anchor to the modeled should-cost and ask ${quote.supplierName} to close a ${deltaVsShouldCost.toLocaleString()} gap.`
                : null,
            deltaVsBest > 0
                ? `Use the lead bid as leverage: ${quote.supplierName} is ${deltaVsBest.toLocaleString()} above the current best quote.`
                : `Protect the lead bid by asking for a best-and-final offer tied to volume or payment-term concessions.`,
            quote.riskScore > 50
                ? `Risk remains elevated for ${quote.supplierName}; request guarantees, split-award coverage, or tighter SLA clauses.`
                : null,
            quote.analysis.deliveryWeeks !== null && deliveryValues.length > 0 && quote.analysis.deliveryWeeks > minDelivery + 1
                ? `Push for faster lead time: this offer trails the fastest supplier by ${quote.analysis.deliveryWeeks - minDelivery} week(s).`
                : null,
        ].filter((value): value is string => Boolean(value));

        return {
            supplierId: quote.supplierId,
            supplierName: quote.supplierName,
            quoteAmount: quote.quoteAmount,
            totalScore,
            priceScore: roundCurrency(priceScore),
            deliveryScore: roundCurrency(deliveryScore),
            performanceScore: quote.performanceScore,
            riskScore: quote.riskScore,
            deliveryWeeks: quote.analysis.deliveryWeeks,
            deltaVsBest,
            deltaVsShouldCost,
            terms: quote.analysis.terms,
            aiConfidence: quote.analysis.aiConfidence,
            highlights: quote.analysis.highlights,
            levers,
        };
    }).sort((left, right) => right.totalScore - left.totalScore);

    const recommendedSupplier = supplierRankings[0] || null;
    const negotiationPriority = buildNegotiationPriority({
        spreadPercent,
        shouldCostGap,
        quoteCount: quotedSuppliers.length,
        benchmarkCoveragePercent,
    });

    const actionPlan = [
        shouldCostGap > 0
            ? `Run a best-and-final round. The current lead quote is ${shouldCostGap.toLocaleString()} above modeled should-cost.`
            : `Lock negotiation around the current lead quote and trade on terms, lead time, or service guarantees.`,
        competitiveSavings > 0
            ? `Use the next-best offer as leverage. Competitive pressure can still protect ${competitiveSavings.toLocaleString()} in savings.`
            : `Keep at least two suppliers warm so pricing pressure remains credible through award.`,
        recommendedSupplier && recommendedSupplier.riskScore > 50
            ? `If ${recommendedSupplier.supplierName} stays top-ranked, add risk guardrails or split-award coverage before final approval.`
            : null,
        benchmarkCoveragePercent < 50
            ? `Benchmark coverage is only ${benchmarkCoveragePercent}%. Refresh category benchmarks before closing the negotiation.`
            : null,
    ].filter((value): value is string => Boolean(value));

    return {
        hasQuotes: true,
        rfqId,
        rfqTitle: rfq.title,
        rfqStatus: rfq.status,
        benchmarkCoveragePercent,
        shouldCostTotal,
        itemBenchmarks,
        supplierRankings,
        quoteCount: quotedSuppliers.length,
        priceSpread,
        spreadPercent,
        competitiveBaseline: roundCurrency(competitiveBaseline),
        bestQuoteAmount: roundCurrency(minAmount),
        negotiationPriority,
        shouldCostGap,
        competitiveSavings,
        actionPlan,
        recommendedSupplier,
    };
}
