'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, parts, orderItems, auditLogs, rfqs } from "@/db/schema";
import { count, eq, sum, sql, desc, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";
import { isRegionalOperator } from "@/lib/rbac";

const orderItemTotals = db.select({
    orderId: orderItems.orderId,
    lineTotal: sql<string>`COALESCE(SUM(${orderItems.quantity} * CAST(${orderItems.unitPrice} AS numeric)), 0)`.as('line_total')
}).from(orderItems).groupBy(orderItems.orderId).as('dashboard_order_item_totals');

const effectiveOrderTotal = sql<string>`COALESCE(NULLIF(CAST(${procurementOrders.totalAmount} AS numeric), 0), CAST(${orderItemTotals.lineTotal} AS numeric), 0)`;
const convertedFromRfqPattern = /Converted from RFQ ([A-F0-9]{8})/i;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ScopedSessionUser = {
    role?: string | null;
    accessProfile?: string | null;
    countryScope?: string | null;
    regionScope?: string | null;
};
type ScopedWhereCondition = ReturnType<typeof sql>;

function normalizeScopeCountry(value: string | null | undefined) {
    return value?.trim().toUpperCase() || null;
}

function normalizeScopeRegion(value: string | null | undefined) {
    return value?.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

function combineConditions(...conditions: Array<ScopedWhereCondition | undefined>) {
    const activeConditions = conditions.filter((condition) => condition !== undefined);
    return activeConditions.length > 0 ? and(...activeConditions) : undefined;
}

function scopeCondition(column: Parameters<typeof inArray>[0], ids: string[] | null): ScopedWhereCondition | undefined {
    if (ids === null) {
        return undefined;
    }

    if (ids.length === 0) {
        return sql`false`;
    }

    return inArray(column, ids);
}

async function getRegionalDashboardScope(user: ScopedSessionUser | null | undefined) {
    if (!isRegionalOperator(user)) {
        return {
            supplierIds: null as string[] | null,
            orderIds: null as string[] | null,
            partIds: null as string[] | null,
        };
    }

    const scopedCountry = normalizeScopeCountry(user?.countryScope);
    const scopedRegion = normalizeScopeRegion(user?.regionScope);

    if (!scopedCountry && !scopedRegion) {
        return {
            supplierIds: [],
            orderIds: [],
            partIds: [],
        };
    }

    const supplierConditions = [];
    if (scopedCountry) {
        supplierConditions.push(sql`(
            upper(coalesce(${suppliers.countryCode}, '')) = ${scopedCountry}
            or exists (
                select 1
                from ${procurementOrders}
                inner join ${orderItems} on ${orderItems.orderId} = ${procurementOrders.id}
                inner join ${parts} on ${orderItems.partId} = ${parts.id}
                where ${procurementOrders.supplierId} = ${suppliers.id}
                  and upper(coalesce(${parts.countryCode}, '')) = ${scopedCountry}
            )
        )`);
    }
    if (scopedRegion) {
        supplierConditions.push(sql`exists (
            select 1
            from ${procurementOrders}
            inner join ${orderItems} on ${orderItems.orderId} = ${procurementOrders.id}
            inner join ${parts} on ${orderItems.partId} = ${parts.id}
            where ${procurementOrders.supplierId} = ${suppliers.id}
              and lower(trim(coalesce(${parts.region}, ''))) = ${scopedRegion}
        )`);
    }

    const partConditions = [];
    if (scopedCountry) {
        partConditions.push(sql`(
            upper(coalesce(${parts.countryCode}, '')) = ${scopedCountry}
            or exists (
                select 1
                from ${orderItems}
                inner join ${procurementOrders} on ${orderItems.orderId} = ${procurementOrders.id}
                inner join ${suppliers} on ${procurementOrders.supplierId} = ${suppliers.id}
                where ${orderItems.partId} = ${parts.id}
                  and upper(coalesce(${suppliers.countryCode}, '')) = ${scopedCountry}
            )
        )`);
    }
    if (scopedRegion) {
        partConditions.push(sql`lower(trim(coalesce(${parts.region}, ''))) = ${scopedRegion}`);
    }

    const orderConditions = [];
    if (scopedCountry) {
        orderConditions.push(sql`(
            upper(coalesce(${suppliers.countryCode}, '')) = ${scopedCountry}
            or exists (
                select 1
                from ${orderItems}
                inner join ${parts} on ${orderItems.partId} = ${parts.id}
                where ${orderItems.orderId} = ${procurementOrders.id}
                  and upper(coalesce(${parts.countryCode}, '')) = ${scopedCountry}
            )
        )`);
    }
    if (scopedRegion) {
        orderConditions.push(sql`exists (
            select 1
            from ${orderItems}
            inner join ${parts} on ${orderItems.partId} = ${parts.id}
            where ${orderItems.orderId} = ${procurementOrders.id}
              and lower(trim(coalesce(${parts.region}, ''))) = ${scopedRegion}
        )`);
    }

    const [supplierRows, partRows, orderRows] = await Promise.all([
        db.select({ id: suppliers.id })
            .from(suppliers)
            .where(combineConditions(...supplierConditions)),
        db.select({ id: parts.id })
            .from(parts)
            .where(combineConditions(...partConditions)),
        db.select({ id: procurementOrders.id })
            .from(procurementOrders)
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(combineConditions(...orderConditions)),
    ]);

    return {
        supplierIds: Array.from(new Set(supplierRows.map((row) => row.id))),
        partIds: Array.from(new Set(partRows.map((row) => row.id))),
        orderIds: Array.from(new Set(orderRows.map((row) => row.id))),
    };
}

function startOfUtcMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcMonths(date: Date, delta: number) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

async function getLegacyOrderRfqMap(orderIds: string[]) {
    if (orderIds.length === 0) {
        return new Map<string, { rfqId: string; categoryLabel: string | null; title: string }>();
    }

    const orderAuditRows = await db.select({
        orderId: auditLogs.entityId,
        details: auditLogs.details,
    })
        .from(auditLogs)
        .where(and(
            eq(auditLogs.entityType, 'order'),
            inArray(auditLogs.entityId, orderIds)
        ));

    const rfqPrefixes = Array.from(new Set(orderAuditRows
        .map((row) => row.details.match(convertedFromRfqPattern)?.[1]?.toUpperCase())
        .filter((prefix): prefix is string => Boolean(prefix))));

    if (rfqPrefixes.length === 0) {
        return new Map<string, { rfqId: string; categoryLabel: string | null; title: string }>();
    }

    const allRfqs = await db.select({
        id: rfqs.id,
        title: rfqs.title,
        category: rfqs.category,
    }).from(rfqs);

    const rfqByPrefix = new Map(allRfqs.map((rfq) => [rfq.id.slice(0, 8).toUpperCase(), rfq]));
    const orderToRfq = new Map<string, { rfqId: string; categoryLabel: string | null; title: string }>();

    for (const row of orderAuditRows) {
        const prefix = row.details.match(convertedFromRfqPattern)?.[1]?.toUpperCase();
        if (!prefix) {
            continue;
        }

        const rfq = rfqByPrefix.get(prefix);
        if (!rfq) {
            continue;
        }

        orderToRfq.set(row.orderId, {
            rfqId: rfq.id,
            categoryLabel: rfq.category?.trim() || rfq.title?.trim() || null,
            title: rfq.title,
        });
    }

    return orderToRfq;
}

export async function getDashboardStats() {
    const session = await auth();
    if (!session?.user) {
        return {
            supplierCount: 0,
            orderCount: 0,
            partCount: 0,
            stockedSkuCount: 0,
            totalSpend: "0.00",
            showMomChange: false,
            momentumLabel: "No current month baseline",
        };
    }
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const supplierScope = scopeCondition(suppliers.id, scope.supplierIds);
        const orderScope = scopeCondition(procurementOrders.id, scope.orderIds);
        const partScope = scopeCondition(parts.id, scope.partIds);

        const [supplierCount] = await db.select({ count: count() }).from(suppliers).where(supplierScope);
        const [orderCount] = await db.select({ count: count() }).from(procurementOrders).where(orderScope);
        const [partCount] = await db.select({ count: count() }).from(parts).where(partScope);
        const [stockedSkuCount] = await db.select({ count: count() })
            .from(parts)
            .where(combineConditions(partScope, sql`${parts.stockLevel} > 0`));

        // Sum up total inventory across all parts
        const [inventoryResult] = await db.select({
            totalInventory: sum(parts.stockLevel)
        }).from(parts).where(partScope);

        // Calculate total spend
        const result = await db.select({
            total: sql<string>`COALESCE(SUM(${effectiveOrderTotal}), 0)`
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(orderScope);

        const totalSpend = Number(result[0]?.total || 0);

        // Calculate MoM change
        const now = new Date();
        const firstDayCurrentMonth = startOfUtcMonth(now);
        const firstDayLastMonth = addUtcMonths(firstDayCurrentMonth, -1);

        const currentMonthSpendResult = await db.select({
            total: sql<string>`COALESCE(SUM(${effectiveOrderTotal}), 0)`,
            count: count(),
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(combineConditions(
                orderScope,
                sql`${procurementOrders.createdAt} >= ${firstDayCurrentMonth}`,
            ));

        const lastMonthSpendResult = await db.select({
            total: sql<string>`COALESCE(SUM(${effectiveOrderTotal}), 0)`
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(combineConditions(
                orderScope,
                sql`${procurementOrders.createdAt} >= ${firstDayLastMonth} AND ${procurementOrders.createdAt} < ${firstDayCurrentMonth}`,
            ));

        const currentMonthSpend = Number(currentMonthSpendResult[0]?.total || 0);
        const currentMonthOrders = Number(currentMonthSpendResult[0]?.count || 0);
        const lastMonthSpend = Number(lastMonthSpendResult[0]?.total || 0);

        let momChange = 0;
        const showMomChange = lastMonthSpend > 0 && currentMonthSpend > 0;
        if (showMomChange) {
            momChange = ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
        }

        const momentumLabel = currentMonthOrders === 0
            ? "No posted spend this month"
            : currentMonthSpend <= 0
                ? "Pending current-month reconciliation"
                : "vs last month";

        // Efficiently fetch all order status counts in a single query
        const orderSummary = await db.select({
            status: procurementOrders.status,
            count: count()
        })
            .from(procurementOrders)
            .where(orderScope)
            .groupBy(procurementOrders.status);

        const statusMap: Record<string, number> = {};
        orderSummary.forEach(row => {
            if (row.status) statusMap[row.status] = Number(row.count);
        });

        const activeCount = (statusMap['pending_approval'] || 0) +
            (statusMap['approved'] || 0) +
            (statusMap['sent'] || 0);

        const fulfilledCount = statusMap['fulfilled'] || 0;

        return {
            supplierCount: supplierCount.count,
            orderCount: orderCount.count,
            pendingCount: activeCount,
            fulfilledCount: fulfilledCount,
            partCount: partCount.count,
            stockedSkuCount: stockedSkuCount.count,
            totalInventory: Number(inventoryResult.totalInventory || 0),
            totalSpend: totalSpend,
            momChange: momChange.toFixed(1),
            isFirstMonth: lastMonthSpend === 0,
            showMomChange,
            momentumLabel,
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return {
            supplierCount: 0,
            orderCount: 0,
            partCount: 0,
            stockedSkuCount: 0,
            totalSpend: "0.00",
            showMomChange: false,
            momentumLabel: "No current month baseline",
        };
    }
}




export async function getRecentOrders() {
    const session = await auth();
    if (!session?.user) return [];
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const recentOrders = await db
            .select({
                id: procurementOrders.id,
                supplierId: procurementOrders.supplierId,
                status: procurementOrders.status,
                headerTotal: procurementOrders.totalAmount,
                lineTotal: orderItemTotals.lineTotal,
                totalAmount: effectiveOrderTotal,
                createdAt: procurementOrders.createdAt,
                supplierName: suppliers.name,
                supplierEmail: suppliers.contactEmail,
            })
            .from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(scopeCondition(procurementOrders.id, scope.orderIds))
            .orderBy(desc(procurementOrders.createdAt))
            .limit(5);

        const legacyOrderRfqMap = await getLegacyOrderRfqMap(recentOrders.map((order) => order.id));

        // Transform to match UI expectations
        const formatted = recentOrders.map((o) => ({
            ...o,
            amountUnavailable: Number(o.headerTotal || 0) <= 0 && Number(o.lineTotal || 0) <= 0,
            sourceReference: legacyOrderRfqMap.get(o.id)?.rfqId.slice(0, 8).toUpperCase() || null,
            supplier: { name: o.supplierName, contact_email: o.supplierEmail },
        }));
        return formatted;
    } catch (error) {
        console.error("Failed to fetch recent orders:", error);
        return [];
    }
}

export async function getMonthlySpend() {
    const session = await auth();
    if (!session?.user) return [];
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const now = new Date();
        const currentUtcMonth = startOfUtcMonth(now);
        const twelveMonthsAgo = addUtcMonths(currentUtcMonth, -11);

        const orders = await db.select({
            amount: effectiveOrderTotal,
            createdAt: procurementOrders.createdAt,
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(combineConditions(
                scopeCondition(procurementOrders.id, scope.orderIds),
                sql`${procurementOrders.createdAt} >= ${twelveMonthsAgo}`,
            ));

        // Build a rolling 12-month window in chronological order
        const buckets: { name: string; year: number; month: number; total: number; orders: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = addUtcMonths(currentUtcMonth, -i);
            buckets.push({
                name: monthNames[d.getUTCMonth()],
                year: d.getUTCFullYear(),
                month: d.getUTCMonth(),
                total: 0,
                orders: 0,
            });
        }

        orders.forEach(order => {
            if (!order.createdAt) return;
            const oMonth = order.createdAt.getUTCMonth();
            const oYear = order.createdAt.getUTCFullYear();
            const bucket = buckets.find(b => b.month === oMonth && b.year === oYear);
            if (bucket) {
                bucket.total += parseFloat(order.amount || "0");
                bucket.orders += 1;
            }
        });

        return buckets.map(b => ({
            name: b.name,
            total: Math.floor(b.total),
            orders: b.orders,
        }));
    } catch (error) {
        console.error("Failed to fetch monthly spend:", error);
        return [];
    }
}

export async function getCategorySpend() {
    const session = await auth();
    if (!session?.user) return [];
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const result = await db.select({
            category: parts.category,
            total: sum(sql<number>`${orderItems.quantity} * ${orderItems.unitPrice}`),
            count: count(orderItems.id)
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .where(scopeCondition(parts.id, scope.partIds))
            .groupBy(parts.category);

        const ordersWithoutItems = await db.select({
            id: procurementOrders.id,
            total: effectiveOrderTotal,
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(combineConditions(
                scopeCondition(procurementOrders.id, scope.orderIds),
                sql`NOT EXISTS (SELECT 1 FROM ${orderItems} AS oi WHERE oi.order_id = ${procurementOrders.id}) AND ${effectiveOrderTotal} > 0`,
            ));

        const [unclassifiedSpend] = await db.select({
            total: sql<string>`COALESCE(SUM(${effectiveOrderTotal}), 0)`,
            count: count(),
        }).from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .where(combineConditions(
                scopeCondition(procurementOrders.id, scope.orderIds),
                sql`NOT EXISTS (SELECT 1 FROM ${orderItems} AS oi WHERE oi.order_id = ${procurementOrders.id}) AND ${effectiveOrderTotal} > 0`,
            ));

        const mapped = result.map((r: { category: string | null, total: number | unknown, count: number | unknown }) => ({
            name: r.category || "Other",
            value: Number(r.total || 0),
            count: Number(r.count || 0)
        }));

        const categoryMap = new Map(mapped.map((entry) => [entry.name, { ...entry }]));
        const legacyOrderRfqMap = await getLegacyOrderRfqMap(ordersWithoutItems.map((order) => order.id));

        for (const order of ordersWithoutItems) {
            const fallbackCategory = legacyOrderRfqMap.get(order.id)?.categoryLabel || "Unclassified";
            const current = categoryMap.get(fallbackCategory) || { name: fallbackCategory, value: 0, count: 0 };
            current.value += Number(order.total || 0);
            current.count += 1;
            categoryMap.set(fallbackCategory, current);
        }

        if (Number(unclassifiedSpend?.total || 0) > 0 && !categoryMap.has("Unclassified")) {
            categoryMap.set("Unclassified", {
                name: "Unclassified",
                value: Number(unclassifiedSpend.total || 0),
                count: Number(unclassifiedSpend.count || 0),
            });
        }

        return Array.from(categoryMap.values()).sort((left, right) => right.value - left.value);
    } catch (error) {
        console.error("Failed to fetch category spend:", error);
        return [];
    }
}

export async function getHighRiskSuppliers() {
    const session = await auth();
    if (!session?.user) return [];
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const result = await db.select({
            id: suppliers.id,
            name: suppliers.name,
            riskScore: suppliers.riskScore,
        })
            .from(suppliers)
            .where(combineConditions(
                scopeCondition(suppliers.id, scope.supplierIds),
                sql`COALESCE(${suppliers.riskScore}, 0) >= 60`,
            ))
            .orderBy(desc(suppliers.riskScore))
            .limit(3);
        return result;
    } catch (error) {
        console.error("Failed to fetch high risk suppliers:", error);
        return [];
    }
}
export async function getSupplierAnalytics() {
    const session = await auth();
    if (!session?.user) return [];
    try {
        const scope = await getRegionalDashboardScope(session.user);
        const result = await db.select({
            name: suppliers.name,
            spend: sql<string>`COALESCE(SUM(${effectiveOrderTotal}), 0)`,
            orders: count(procurementOrders.id),
            performance: suppliers.performanceScore,
            risk: suppliers.riskScore
        })
            .from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(combineConditions(
                scopeCondition(procurementOrders.id, scope.orderIds),
                scopeCondition(suppliers.id, scope.supplierIds),
            ))
            .groupBy(suppliers.id, suppliers.name, suppliers.performanceScore, suppliers.riskScore)
            .orderBy(desc(sql`SUM(${effectiveOrderTotal})`))
            .limit(5);

        return result.map(s => ({
            name: s.name,
            orders: Number(s.orders),
            spend: Number(s.spend || 0),
            reliability: Number(s.performance || 0) > 0 ? Number(s.performance || 0) : Math.max(0, 100 - Number(s.risk || 0)),
            riskScore: Number(s.risk || 0),
        }));
    } catch (error) {
        console.error("Failed to fetch supplier analytics:", error);
        return [];
    }
}
