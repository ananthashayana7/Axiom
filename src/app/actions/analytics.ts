'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers, invoices, contracts } from "@/db/schema";
import { eq, sql, desc, and, gte, lte, inArray } from "drizzle-orm";

/* ─── Legacy function kept for sourcing page compatibility ─── */
export async function getSpendStats() {
    try {
        const spendByCategory = await db.select({
            category: parts.category,
            totalSpend: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`.mapWith(Number)
        }).from(orderItems).innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category).orderBy(desc(sql`totalSpend`)).limit(10);

        const spendBySupplier = await db.select({
            supplierId: suppliers.id, supplierName: suppliers.name,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number)
        }).from(procurementOrders).innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(procurementOrders.status, 'fulfilled'))
            .groupBy(suppliers.id, suppliers.name).orderBy(desc(sql`totalSpend`)).limit(10);

        const topParts = await db.select({
            partId: parts.id, partName: parts.name, category: parts.category,
            totalQuantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
            totalSpend: sql<number>`sum(${orderItems.unitPrice} * ${orderItems.quantity})`.mapWith(Number)
        }).from(orderItems).innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.id, parts.name, parts.category).orderBy(desc(sql`totalQuantity`)).limit(10);

        const spendTrend = await db.select({
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'Mon YYYY')`,
            totalSpend: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number),
            orderCount: sql<number>`count(${procurementOrders.id})`.mapWith(Number)
        }).from(procurementOrders)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'Mon YYYY'), date_trunc('month', ${procurementOrders.createdAt})`)
            .orderBy(sql`date_trunc('month', ${procurementOrders.createdAt})`).limit(6);

        const supplierPerformance = await db.select({
            supplierName: suppliers.name,
            performanceScore: sql<number>`coalesce(${suppliers.performanceScore}, 0)`.mapWith(Number),
            riskScore: sql<number>`coalesce(${suppliers.riskScore}, 0)`.mapWith(Number),
            totalSpend: sql<number>`coalesce(sum(${procurementOrders.totalAmount}), 0)`.mapWith(Number)
        }).from(suppliers).leftJoin(procurementOrders, eq(procurementOrders.supplierId, suppliers.id))
            .groupBy(suppliers.id, suppliers.name, suppliers.performanceScore, suppliers.riskScore)
            .orderBy(desc(sql`totalSpend`)).limit(10);

        const savingsData = await db.select({
            totalInitial: sql<number>`sum(${procurementOrders.initialQuoteAmount})`.mapWith(Number),
            totalFinal: sql<number>`sum(${procurementOrders.totalAmount})`.mapWith(Number),
            count: sql<number>`count(${procurementOrders.id})`.mapWith(Number)
        }).from(procurementOrders).where(and(eq(procurementOrders.status, 'fulfilled'), sql`${procurementOrders.initialQuoteAmount} IS NOT NULL`));

        const totalActualSpend = Number(savingsData[0]?.totalFinal || 0);
        const totalInitialQuote = Number(savingsData[0]?.totalInitial || 0);
        const realizedSavings = Math.max(0, totalInitialQuote - totalActualSpend);
        const savingsRate = totalInitialQuote > 0 ? (realizedSavings / totalInitialQuote) * 100 : 0;

        return { spendByCategory, spendBySupplier, topParts, spendTrend, supplierPerformance, totalActualSpend, realizedSavings, savingsRate: Number(savingsRate.toFixed(1)) };
    } catch (error) {
        const isConnectionRefused = error instanceof Error && /ECONNREFUSED|connect/i.test(error.message);
        if (!isConnectionRefused) console.error("Failed to fetch spend stats:", error);
        return { spendByCategory: [], spendBySupplier: [], topParts: [], spendTrend: [], supplierPerformance: [], totalActualSpend: 0, realizedSavings: 0, savingsRate: 0 };
    }
}

/* ─────────────────────────────────────────────────────────────
   INTELLIGENCE HUB — Full Analytical Engine
   ───────────────────────────────────────────────────────────── */

export interface AnalyticsFilters {
    dateFrom?: string;
    dateTo?: string;
    regions?: string[];
    supplierIds?: string[];
    categories?: string[];
    invoiceStatuses?: string[];
    orderStatuses?: string[];
}

/** Dropdown / multi-select options for the filter bar */
export async function getFilterOptions() {
    try {
        const [regionRows, supplierRows, categoryRows, countryRows] = await Promise.all([
            db.selectDistinct({ region: suppliers.region }).from(suppliers).where(sql`${suppliers.region} IS NOT NULL`),
            db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
            db.selectDistinct({ category: parts.category }).from(parts).where(sql`${parts.category} IS NOT NULL`).orderBy(parts.category),
            db.selectDistinct({ country: suppliers.country }).from(suppliers).where(sql`${suppliers.country} IS NOT NULL`),
        ]);
        return {
            regions: regionRows.map(r => r.region).filter(Boolean) as string[],
            suppliers: supplierRows.map(s => ({ id: s.id, name: s.name })),
            categories: categoryRows.map(c => c.category).filter(Boolean) as string[],
            countries: countryRows.map(c => c.country).filter(Boolean) as string[],
        };
    } catch {
        return { regions: [], suppliers: [], categories: [], countries: [] };
    }
}

/** Build WHERE conditions for procurement_orders table */
function buildOrderConditions(filters: AnalyticsFilters) {
    const conds = [];
    if (filters.dateFrom) conds.push(gte(procurementOrders.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conds.push(lte(procurementOrders.createdAt, new Date(filters.dateTo)));
    if (filters.supplierIds?.length) conds.push(inArray(procurementOrders.supplierId, filters.supplierIds));
    if (filters.orderStatuses?.length) conds.push(inArray(procurementOrders.status, filters.orderStatuses as any));
    return conds;
}

/** Build WHERE conditions for invoices table */
function buildInvoiceConditions(filters: AnalyticsFilters) {
    const conds = [];
    if (filters.dateFrom) conds.push(gte(invoices.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conds.push(lte(invoices.createdAt, new Date(filters.dateTo)));
    if (filters.supplierIds?.length) conds.push(inArray(invoices.supplierId, filters.supplierIds));
    if (filters.invoiceStatuses?.length) conds.push(inArray(invoices.status, filters.invoiceStatuses as any));
    return conds;
}

function whereAnd(conditions: any[]) {
    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
}

/** The main Intelligence Hub data fetcher — drives all charts + KPIs */
export async function getIntelligenceData(filters: AnalyticsFilters = {}) {
    try {
        const orderConds = buildOrderConditions(filters);
        const orderWhere = whereAnd(orderConds);

        const invoiceConds = buildInvoiceConditions(filters);
        const invoiceWhere = whereAnd(invoiceConds);

        // ── KPI Aggregates ───────────────────────────────────────
        const [kpiRow] = await db.select({
            totalSpend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            totalSavings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
            totalInitialQuote: sql<string>`COALESCE(SUM(CAST(${procurementOrders.initialQuoteAmount} AS numeric)), 0)`,
            orderCount: sql<string>`COUNT(*)`,
            avgOrderValue: sql<string>`COALESCE(AVG(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
        }).from(procurementOrders).where(orderWhere);

        const [supplierCountRow] = await db.select({
            count: sql<string>`COUNT(DISTINCT ${procurementOrders.supplierId})`
        }).from(procurementOrders).where(orderWhere);

        const [invoiceCountRow] = await db.select({
            count: sql<string>`COUNT(*)`,
            totalAmount: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`
        }).from(invoices).where(invoiceWhere);

        // ── 1. Monthly Spend Trend (all available months) ────────
        const spendTrend = await db.select({
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            savings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
            orders: sql<string>`COUNT(*)`,
        }).from(procurementOrders).where(orderWhere)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`);

        // ── 2. Yearly Spend Trend (10+ year view) ────────────────
        const yearlyTrend = await db.select({
            year: sql<string>`to_char(${procurementOrders.createdAt}, 'YYYY')`,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            savings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
            orders: sql<string>`COUNT(*)`,
        }).from(procurementOrders).where(orderWhere)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY')`)
            .orderBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY')`);

        // ── 3. Quarterly Trend ───────────────────────────────────
        const quarterlyTrend = await db.select({
            quarter: sql<string>`to_char(${procurementOrders.createdAt}, 'YYYY-"Q"Q')`,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            savings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
            orders: sql<string>`COUNT(*)`,
        }).from(procurementOrders).where(orderWhere)
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-"Q"Q')`)
            .orderBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-"Q"Q')`);

        // ── 4. Spend by Category ─────────────────────────────────
        const catConds = [...orderConds];
        if (filters.categories?.length) catConds.push(inArray(parts.category, filters.categories));
        const spendByCategory = await db.select({
            category: parts.category,
            spend: sql<string>`COALESCE(SUM(CAST(${orderItems.unitPrice} AS numeric) * ${orderItems.quantity}), 0)`,
            itemCount: sql<string>`COUNT(*)`,
        }).from(orderItems)
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .where(whereAnd(catConds))
            .groupBy(parts.category)
            .orderBy(sql`SUM(CAST(${orderItems.unitPrice} AS numeric) * ${orderItems.quantity}) DESC`);

        // ── 5. Spend by Supplier (top 20) ────────────────────────
        const suppConds = [...orderConds];
        if (filters.regions?.length) suppConds.push(inArray(suppliers.region, filters.regions));
        const spendBySupplier = await db.select({
            name: suppliers.name,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            orders: sql<string>`COUNT(*)`,
            savings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
        }).from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(whereAnd(suppConds))
            .groupBy(suppliers.name)
            .orderBy(sql`SUM(CAST(${procurementOrders.totalAmount} AS numeric)) DESC`)
            .limit(20);

        // ── 6. Spend by Region ───────────────────────────────────
        const spendByRegion = await db.select({
            region: suppliers.region,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            supplierCount: sql<string>`COUNT(DISTINCT ${suppliers.id})`,
        }).from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(orderWhere)
            .groupBy(suppliers.region)
            .orderBy(sql`SUM(CAST(${procurementOrders.totalAmount} AS numeric)) DESC`);

        // ── 7. Spend by Country ──────────────────────────────────
        const spendByCountry = await db.select({
            country: suppliers.country,
            countryCode: suppliers.countryCode,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            supplierCount: sql<string>`COUNT(DISTINCT ${suppliers.id})`,
            orderCount: sql<string>`COUNT(*)`,
        }).from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(orderWhere)
            .groupBy(suppliers.country, suppliers.countryCode)
            .orderBy(sql`SUM(CAST(${procurementOrders.totalAmount} AS numeric)) DESC`);

        // ── 8. Invoice Distribution ──────────────────────────────
        const invoiceDistribution = await db.select({
            status: invoices.status,
            count: sql<string>`COUNT(*)`,
            totalAmount: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
        }).from(invoices).where(invoiceWhere).groupBy(invoices.status);

        // ── 9. Invoice by Region ─────────────────────────────────
        const invoiceByRegion = await db.select({
            region: invoices.region,
            count: sql<string>`COUNT(*)`,
            totalAmount: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
        }).from(invoices).where(invoiceWhere)
            .groupBy(invoices.region)
            .orderBy(sql`SUM(CAST(${invoices.amount} AS numeric)) DESC`);

        // ── 10. Order Status Distribution ────────────────────────
        const orderDistribution = await db.select({
            status: procurementOrders.status,
            count: sql<string>`COUNT(*)`,
            totalAmount: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
        }).from(procurementOrders).where(orderWhere).groupBy(procurementOrders.status);

        // ── 11. Supplier Performance Scatter ─────────────────────
        const perfConds: any[] = [];
        if (filters.regions?.length) perfConds.push(inArray(suppliers.region, filters.regions));
        if (filters.supplierIds?.length) perfConds.push(inArray(suppliers.id, filters.supplierIds));
        const supplierPerformance = await db.select({
            name: suppliers.name,
            riskScore: suppliers.riskScore,
            performanceScore: suppliers.performanceScore,
            esgScore: suppliers.esgScore,
            financialScore: suppliers.financialScore,
            spend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
        }).from(suppliers)
            .leftJoin(procurementOrders, eq(procurementOrders.supplierId, suppliers.id))
            .where(whereAnd(perfConds))
            .groupBy(suppliers.id, suppliers.name, suppliers.riskScore, suppliers.performanceScore, suppliers.esgScore, suppliers.financialScore)
            .orderBy(sql`SUM(CAST(${procurementOrders.totalAmount} AS numeric)) DESC NULLS LAST`)
            .limit(50);

        // ── 12. Savings by Type ──────────────────────────────────
        const savConds = [...orderConds, sql`${procurementOrders.savingsType} IS NOT NULL`];
        const savingsByType = await db.select({
            type: procurementOrders.savingsType,
            totalSavings: sql<string>`COALESCE(SUM(CAST(${procurementOrders.savingsAmount} AS numeric)), 0)`,
            count: sql<string>`COUNT(*)`,
        }).from(procurementOrders).where(whereAnd(savConds)).groupBy(procurementOrders.savingsType);

        // ── 13. Price Variance (initial quote vs actual) ─────────
        const pvConds = [...orderConds, sql`${procurementOrders.initialQuoteAmount} IS NOT NULL`];
        const priceVariance = await db.select({
            month: sql<string>`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`,
            avgInitial: sql<string>`COALESCE(AVG(CAST(${procurementOrders.initialQuoteAmount} AS numeric)), 0)`,
            avgActual: sql<string>`COALESCE(AVG(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
        }).from(procurementOrders).where(whereAnd(pvConds))
            .groupBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${procurementOrders.createdAt}, 'YYYY-MM')`);

        // ── 14. Contract Analysis ────────────────────────────────
        const contractAnalysis = await db.select({
            type: contracts.type,
            status: contracts.status,
            count: sql<string>`COUNT(*)`,
            totalValue: sql<string>`COALESCE(SUM(CAST(${contracts.value} AS numeric)), 0)`,
        }).from(contracts).groupBy(contracts.type, contracts.status);

        // ── 15. Top Parts ────────────────────────────────────────
        const topParts = await db.select({
            name: parts.name,
            category: parts.category,
            totalSpend: sql<string>`COALESCE(SUM(CAST(${orderItems.unitPrice} AS numeric) * ${orderItems.quantity}), 0)`,
            totalQty: sql<string>`SUM(${orderItems.quantity})`,
            avgUnitPrice: sql<string>`COALESCE(AVG(CAST(${orderItems.unitPrice} AS numeric)), 0)`,
        }).from(orderItems)
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .where(whereAnd(catConds))
            .groupBy(parts.name, parts.category)
            .orderBy(sql`SUM(CAST(${orderItems.unitPrice} AS numeric) * ${orderItems.quantity}) DESC`)
            .limit(25);

        // ── Assemble response ────────────────────────────────────
        const totalSpend = parseFloat(kpiRow?.totalSpend || '0');
        const totalSavings = parseFloat(kpiRow?.totalSavings || '0');
        const totalInitialQuote = parseFloat(kpiRow?.totalInitialQuote || '0');

        return {
            kpis: {
                totalSpend,
                totalSavings,
                savingsRate: totalInitialQuote > 0 ? Number(((totalSavings / totalInitialQuote) * 100).toFixed(1)) : 0,
                orderCount: Number(kpiRow?.orderCount || 0),
                avgOrderValue: parseFloat(kpiRow?.avgOrderValue || '0'),
                supplierCount: Number(supplierCountRow?.count || 0),
                invoiceCount: Number(invoiceCountRow?.count || 0),
                invoiceTotal: parseFloat(invoiceCountRow?.totalAmount || '0'),
            },
            spendTrend: spendTrend.map(r => ({ month: r.month, spend: parseFloat(r.spend), savings: parseFloat(r.savings), orders: Number(r.orders) })),
            yearlyTrend: yearlyTrend.map(r => ({ year: r.year, spend: parseFloat(r.spend), savings: parseFloat(r.savings), orders: Number(r.orders) })),
            quarterlyTrend: quarterlyTrend.map(r => ({ quarter: r.quarter, spend: parseFloat(r.spend), savings: parseFloat(r.savings), orders: Number(r.orders) })),
            spendByCategory: spendByCategory.map(r => ({ category: r.category, spend: parseFloat(r.spend), itemCount: Number(r.itemCount) })),
            spendBySupplier: spendBySupplier.map(r => ({ name: r.name, spend: parseFloat(r.spend), orders: Number(r.orders), savings: parseFloat(r.savings) })),
            spendByRegion: spendByRegion.map(r => ({ region: r.region || 'Unknown', spend: parseFloat(r.spend), supplierCount: Number(r.supplierCount) })),
            spendByCountry: spendByCountry.map(r => ({ country: r.country || 'Unknown', countryCode: r.countryCode || '', spend: parseFloat(r.spend), supplierCount: Number(r.supplierCount), orderCount: Number(r.orderCount) })),
            invoiceDistribution: invoiceDistribution.map(r => ({ status: r.status || 'unknown', count: Number(r.count), totalAmount: parseFloat(r.totalAmount) })),
            invoiceByRegion: invoiceByRegion.map(r => ({ region: r.region || 'Unknown', count: Number(r.count), totalAmount: parseFloat(r.totalAmount) })),
            orderDistribution: orderDistribution.map(r => ({ status: r.status || 'unknown', count: Number(r.count), totalAmount: parseFloat(r.totalAmount) })),
            supplierPerformance: supplierPerformance.map(r => ({ name: r.name, riskScore: Number(r.riskScore || 0), performanceScore: Number(r.performanceScore || 0), esgScore: Number(r.esgScore || 0), financialScore: Number(r.financialScore || 0), spend: parseFloat(r.spend) })),
            savingsByType: savingsByType.map(r => ({ type: r.type || 'unclassified', totalSavings: parseFloat(r.totalSavings), count: Number(r.count) })),
            priceVariance: priceVariance.map(r => ({ month: r.month, avgInitial: parseFloat(r.avgInitial), avgActual: parseFloat(r.avgActual), variance: parseFloat(r.avgInitial) - parseFloat(r.avgActual) })),
            contractAnalysis: contractAnalysis.map(r => ({ type: r.type || 'unknown', status: r.status || 'unknown', count: Number(r.count), totalValue: parseFloat(r.totalValue) })),
            topParts: topParts.map(r => ({ name: r.name, category: r.category, totalSpend: parseFloat(r.totalSpend), totalQty: Number(r.totalQty), avgUnitPrice: parseFloat(r.avgUnitPrice) })),
        };
    } catch (error) {
        const isConnectionRefused = error instanceof Error && /ECONNREFUSED|connect/i.test(error.message);
        if (!isConnectionRefused) console.error("Intelligence data fetch failed:", error);
        const empty = { kpis: { totalSpend: 0, totalSavings: 0, savingsRate: 0, orderCount: 0, avgOrderValue: 0, supplierCount: 0, invoiceCount: 0, invoiceTotal: 0 }, spendTrend: [], yearlyTrend: [], quarterlyTrend: [], spendByCategory: [], spendBySupplier: [], spendByRegion: [], spendByCountry: [], invoiceDistribution: [], invoiceByRegion: [], orderDistribution: [], supplierPerformance: [], savingsByType: [], priceVariance: [], contractAnalysis: [], topParts: [] };
        return empty;
    }
}
