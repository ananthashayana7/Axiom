'use server'

import { db } from "@/db";
import { parts, orderItems, rfqItems, requisitions, invoices, demandForecasts, procurementOrders, suppliers, type Part } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { computeShouldCost } from "./cost-intelligence";
import { calculateAdaptiveReorderPlan, estimatePartCarbonFootprint } from "@/lib/procurement-intelligence";

const ACTIVE_REORDER_STATUSES = ['draft', 'pending_approval', 'approved'] as const;

function normalizeText(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function normalizeSku(value: string) {
    return normalizeText(value).toUpperCase();
}

function parseIntegerValue(value: FormDataEntryValue | null, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? fallback), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableIntegerValue(value: FormDataEntryValue | null) {
    if (value === null || value === "") return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseMoneyValue(value: FormDataEntryValue | null, fallback = "0.00") {
    const parsed = Number.parseFloat(String(value ?? fallback));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed.toFixed(2);
}

function toNumber(value: string | number | null | undefined) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

async function acquireWriteLock(executor: { execute: (query: any) => any }, key: string) {
    await executor.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

async function getPartSignalMaps(partIds?: string[]) {
    const shouldFilter = Array.isArray(partIds) && partIds.length > 0;

    const orderExposureRows = await db.select({
        partId: orderItems.partId,
        openOrderCount: sql<number>`count(distinct case when ${procurementOrders.status} in ('approved', 'sent') then ${procurementOrders.id} end)::int`.mapWith(Number),
        delayedOrderCount: sql<number>`count(distinct case when ${procurementOrders.status} in ('approved', 'sent') and ${procurementOrders.estimatedArrival} is not null and ${procurementOrders.estimatedArrival} < current_timestamp then ${procurementOrders.id} end)::int`.mapWith(Number),
    })
        .from(orderItems)
        .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
        .where(shouldFilter ? inArray(orderItems.partId, partIds!) : undefined)
        .groupBy(orderItems.partId);

    const forecastRows = await db.select({
        partId: demandForecasts.partId,
        forecastDemand: sql<number>`coalesce(sum(${demandForecasts.predictedQuantity}), 0)::int`.mapWith(Number),
    })
        .from(demandForecasts)
        .where(shouldFilter
            ? and(
                inArray(demandForecasts.partId, partIds!),
                sql`${demandForecasts.forecastDate} >= current_timestamp`,
                sql`${demandForecasts.forecastDate} <= current_timestamp + interval '30 days'`
            )
            : and(
                sql`${demandForecasts.forecastDate} >= current_timestamp`,
                sql`${demandForecasts.forecastDate} <= current_timestamp + interval '30 days'`
            ))
        .groupBy(demandForecasts.partId);

    return {
        orderExposureMap: new Map(orderExposureRows.map((row) => [row.partId, row])),
        forecastMap: new Map(forecastRows.map((row) => [row.partId, row.forecastDemand])),
    };
}

export async function getParts(options?: { limit?: number; offset?: number }): Promise<Part[]> {
    try {
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        const allParts = await db.select().from(parts).orderBy(parts.createdAt).limit(limit).offset(offset);
        return allParts;
    } catch (error) {
        console.error("Failed to fetch parts:", error);
        return [];
    }
}

export async function getPartsCount(): Promise<number> {
    try {
        const [result] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(parts);
        return result.count;
    } catch (error) {
        console.error("Failed to fetch parts count:", error);
        return 0;
    }
}

export async function getPartLinkedCounts() {
    try {
        const partRows = await db.select({ id: parts.id }).from(parts);
        const { orderExposureMap, forecastMap } = await getPartSignalMaps();

        const ordersByPart = await db.select({
            partId: orderItems.partId,
            orderCount: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number),
        })
            .from(orderItems)
            .groupBy(orderItems.partId);

        const invoicesByPart = await db.select({
            partId: orderItems.partId,
            invoiceCount: sql<number>`count(distinct ${invoices.id})`.mapWith(Number),
        })
            .from(orderItems)
            .innerJoin(invoices, eq(invoices.orderId, orderItems.orderId))
            .groupBy(orderItems.partId);

        const rfqsByPart = await db.select({
            partId: rfqItems.partId,
            rfqCount: sql<number>`count(distinct ${rfqItems.rfqId})`.mapWith(Number),
        })
            .from(rfqItems)
            .groupBy(rfqItems.partId);

        const orderMap = new Map(ordersByPart.map((row) => [row.partId, row.orderCount]));
        const invoiceMap = new Map(invoicesByPart.map((row) => [row.partId, row.invoiceCount]));
        const rfqMap = new Map(rfqsByPart.map((row) => [row.partId, row.rfqCount]));

        return partRows.map((row) => ({
            partId: row.id,
            orderCount: orderMap.get(row.id) ?? 0,
            invoiceCount: invoiceMap.get(row.id) ?? 0,
            rfqCount: rfqMap.get(row.id) ?? 0,
            openOrderCount: orderExposureMap.get(row.id)?.openOrderCount ?? 0,
            delayedOrderCount: orderExposureMap.get(row.id)?.delayedOrderCount ?? 0,
            forecastDemand: forecastMap.get(row.id) ?? 0,
        }));
    } catch (error) {
        console.error("Failed to fetch part linked counts:", error);
        return [];
    }
}

export async function getPartQuickView(partId: string) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') return null;

    try {
        const [part] = await db.select().from(parts).where(eq(parts.id, partId)).limit(1);
        if (!part) return null;

        const { orderExposureMap, forecastMap } = await getPartSignalMaps([partId]);
        const exposure = orderExposureMap.get(partId) || { openOrderCount: 0, delayedOrderCount: 0 };
        const forecastDemand = forecastMap.get(partId) ?? 0;

        const [linkedCounts] = await getPartLinkedCounts().then((rows) => rows.filter((row) => row.partId === partId));

        const supplierCoverage = await db.select({
            supplierId: suppliers.id,
            supplierName: suppliers.name,
            contactEmail: suppliers.contactEmail,
            countryCode: suppliers.countryCode,
            financialScore: suppliers.financialScore,
            riskScore: suppliers.riskScore,
            esgScore: suppliers.esgScore,
            renewableEnergyShare: suppliers.esgEnvironmentScore,
            financialHealthRating: suppliers.financialHealthRating,
            onTimeDeliveryRate: suppliers.onTimeDeliveryRate,
            openOrderCount: sql<number>`count(distinct case when ${procurementOrders.status} in ('approved', 'sent') then ${procurementOrders.id} end)::int`.mapWith(Number),
            delayedOrderCount: sql<number>`count(distinct case when ${procurementOrders.status} in ('approved', 'sent') and ${procurementOrders.estimatedArrival} is not null and ${procurementOrders.estimatedArrival} < current_timestamp then ${procurementOrders.id} end)::int`.mapWith(Number),
            hasPrimaryCarbonData: sql<number>`case when coalesce(cast(${suppliers.carbonFootprintScope1} as numeric), 0) + coalesce(cast(${suppliers.carbonFootprintScope2} as numeric), 0) + coalesce(cast(${suppliers.carbonFootprintScope3} as numeric), 0) > 0 then 1 else 0 end`.mapWith(Number),
        })
            .from(orderItems)
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(orderItems.partId, partId))
            .groupBy(
                suppliers.id,
                suppliers.name,
                suppliers.contactEmail,
                suppliers.countryCode,
                suppliers.financialScore,
                suppliers.riskScore,
                suppliers.esgScore,
                suppliers.esgEnvironmentScore,
                suppliers.financialHealthRating,
                suppliers.onTimeDeliveryRate,
                suppliers.carbonFootprintScope1,
                suppliers.carbonFootprintScope2,
                suppliers.carbonFootprintScope3,
            );

        const supplierSignals = supplierCoverage
            .slice()
            .sort((left, right) => {
                if (right.delayedOrderCount !== left.delayedOrderCount) {
                    return right.delayedOrderCount - left.delayedOrderCount;
                }
                return right.openOrderCount - left.openOrderCount;
            })
            .slice(0, 5);
        const primarySupplier = supplierSignals[0];
        const carbonEstimate = estimatePartCarbonFootprint({
            name: part.name,
            category: part.category,
            description: part.description,
            currentPrice: toNumber(part.price),
            supplierCountryCode: primarySupplier?.countryCode,
            supplierHasPrimaryData: supplierSignals.some((supplier) => supplier.hasPrimaryCarbonData > 0),
        });

        const adaptiveReorder = calculateAdaptiveReorderPlan({
            baseReorderPoint: part.reorderPoint,
            minStockLevel: part.minStockLevel,
            stockLevel: part.stockLevel,
            marketTrend: part.marketTrend,
            delayedOpenOrders: exposure.delayedOrderCount,
            openOrders: exposure.openOrderCount,
            forecastDemand,
        });

        let shouldCost = null;
        try {
            shouldCost = await computeShouldCost(partId);
        } catch {
            shouldCost = null;
        }

        return {
            part,
            linkedCounts: linkedCounts || {
                partId,
                orderCount: 0,
                invoiceCount: 0,
                rfqCount: 0,
                openOrderCount: exposure.openOrderCount,
                delayedOrderCount: exposure.delayedOrderCount,
                forecastDemand,
            },
            supplierCoverage: supplierSignals.map((supplier) => ({
                ...supplier,
                onTimeDeliveryRate: toNumber(supplier.onTimeDeliveryRate),
            })),
            adaptiveReorder,
            forecastDemand,
            carbonEstimate,
            shouldCost,
        };
    } catch (error) {
        console.error("Failed to build part quick view:", error);
        return null;
    }
}

export async function addPart(formData: FormData) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = normalizeText(String(formData.get("name") ?? ""));
        const sku = normalizeSku(String(formData.get("sku") ?? ""));
        const category = normalizeText(String(formData.get("category") ?? ""));
        const stockLevel = Math.max(0, parseIntegerValue(formData.get("stock"), 0));
        const price = parseMoneyValue(formData.get("price"), "0.00");
        const marketTrend = normalizeText(String(formData.get("marketTrend") ?? "stable")).toLowerCase() || 'stable';
        const reorderPoint = Math.max(0, parseIntegerValue(formData.get("reorderPoint"), 50));
        const minStockLevel = Math.max(0, parseIntegerValue(formData.get("minStockLevel"), 20));

        if (!name || !sku || !category) {
            return { success: false, error: "Name, SKU, and category are required." };
        }

        if (!price) {
            return { success: false, error: "Price must be a valid non-negative amount." };
        }

        const result = await db.transaction(async (tx) => {
            await acquireWriteLock(tx, `part:sku:${sku}`);

            const existing = await tx.select({ id: parts.id })
                .from(parts)
                .where(eq(parts.sku, sku))
                .limit(1);

            if (existing.length > 0) {
                return { success: false as const, error: `SKU ${sku} already exists.` };
            }

            const [newPart] = await tx.insert(parts).values({
                name,
                sku,
                category,
                stockLevel,
                price,
                marketTrend,
                reorderPoint,
                minStockLevel,
            }).returning();

            return { success: true as const, data: newPart };
        });

        if (!result.success) {
            return result;
        }

        await logActivity('CREATE', 'part', result.data.id, `Created new part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true, data: result.data };
    } catch (error) {
        console.error("Failed to add part:", error);
        return { success: false, error: "Failed to add part" };
    }
}

export async function updatePart(id: string, formData: FormData) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const name = normalizeText(String(formData.get("name") ?? ""));
        const sku = normalizeSku(String(formData.get("sku") ?? ""));
        const category = normalizeText(String(formData.get("category") ?? ""));
        const stockLevel = Math.max(0, parseIntegerValue(formData.get("stock"), 0));
        const price = parseMoneyValue(formData.get("price"), "0.00");
        const marketTrendRaw = String(formData.get("marketTrend") ?? "").trim();
        const marketTrend = marketTrendRaw ? marketTrendRaw.toLowerCase() : null;
        const reorderPoint = parseNullableIntegerValue(formData.get("reorderPoint"));
        const minStockLevel = parseNullableIntegerValue(formData.get("minStockLevel"));

        const expectedName = normalizeText(String(formData.get("expectedName") ?? ""));
        const expectedSku = normalizeSku(String(formData.get("expectedSku") ?? ""));
        const expectedCategory = normalizeText(String(formData.get("expectedCategory") ?? ""));
        const expectedStockLevel = parseIntegerValue(formData.get("expectedStockLevel"), Number.NaN);
        const expectedPrice = parseMoneyValue(formData.get("expectedPrice"), "0.00");
        const expectedMarketTrendRaw = String(formData.get("expectedMarketTrend") ?? "").trim();
        const expectedMarketTrend = expectedMarketTrendRaw ? expectedMarketTrendRaw.toLowerCase() : null;
        const expectedReorderPoint = parseNullableIntegerValue(formData.get("expectedReorderPoint"));
        const expectedMinStockLevel = parseNullableIntegerValue(formData.get("expectedMinStockLevel"));

        if (!name || !sku || !category) {
            return { success: false, error: "Name, SKU, and category are required." };
        }

        if (!price) {
            return { success: false, error: "Price must be a valid non-negative amount." };
        }

        if (
            !expectedName ||
            !expectedSku ||
            !expectedCategory ||
            !Number.isFinite(expectedStockLevel) ||
            !expectedPrice
        ) {
            return { success: false, error: "This part view is stale. Refresh inventory before saving changes." };
        }

        const result = await db.transaction(async (tx) => {
            await acquireWriteLock(tx, `part:update:${id}`);
            await acquireWriteLock(tx, `part:sku:${sku}`);

            const duplicateSku = await tx.select({ id: parts.id })
                .from(parts)
                .where(and(
                    eq(parts.sku, sku),
                    sql`${parts.id} <> ${id}`
                ))
                .limit(1);

            if (duplicateSku.length > 0) {
                return { success: false as const, error: `SKU ${sku} already belongs to another part.` };
            }

            const originalStateMatches = and(
                eq(parts.id, id),
                eq(parts.name, expectedName),
                eq(parts.sku, expectedSku),
                eq(parts.category, expectedCategory),
                eq(parts.stockLevel, expectedStockLevel),
                eq(parts.price, expectedPrice),
                expectedMarketTrend === null ? isNull(parts.marketTrend) : eq(parts.marketTrend, expectedMarketTrend),
                expectedReorderPoint === null ? isNull(parts.reorderPoint) : eq(parts.reorderPoint, expectedReorderPoint),
                expectedMinStockLevel === null ? isNull(parts.minStockLevel) : eq(parts.minStockLevel, expectedMinStockLevel),
            );

            const [updated] = await tx.update(parts)
                .set({
                    name,
                    sku,
                    category,
                    stockLevel,
                    price,
                    marketTrend,
                    reorderPoint,
                    minStockLevel,
                })
                .where(originalStateMatches)
                .returning();

            if (!updated) {
                const [latest] = await tx.select().from(parts).where(eq(parts.id, id)).limit(1);
                return {
                    success: false as const,
                    error: "This part was updated by another user. Refresh and review the latest stock, price, and thresholds before saving again.",
                    conflict: latest ?? null,
                };
            }

            return { success: true as const, data: updated };
        });

        if (!result.success) {
            return result;
        }

        await logActivity('UPDATE', 'part', id, `Updated part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true, data: result.data };
    } catch (error) {
        console.error("Failed to update part:", error);
        return { success: false, error: "Failed to update part" };
    }
}

export async function deletePart(id: string) {
    const session = await auth();
    if (!session?.user || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const result = await db.transaction(async (tx) => {
            await acquireWriteLock(tx, `part:delete:${id}`);

            const inOrders = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.partId, id)).limit(1);
            if (inOrders.length > 0) {
                return { success: false as const, error: "Cannot delete: Part exists in Procurement Orders." };
            }

            const inRfqs = await tx.select({ id: rfqItems.id }).from(rfqItems).where(eq(rfqItems.partId, id)).limit(1);
            if (inRfqs.length > 0) {
                return { success: false as const, error: "Cannot delete: Part is listed in active RFQs." };
            }

            const [part] = await tx.select().from(parts).where(eq(parts.id, id));
            if (!part) {
                return { success: false as const, error: "Part not found." };
            }

            await tx.delete(parts).where(eq(parts.id, id));
            return { success: true as const, data: part };
        });

        if (!result.success) {
            return result;
        }

        await logActivity('DELETE', 'part', id, `Deleted part: ${result.data.name} (${result.data.sku})`);
        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete part:", error);
        return { success: false, error: "Failed to delete part" };
    }
}

export async function deleteAllParts(confirmation: string) {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        return { success: false, error: "Only admins can clear inventory." };
    }

    if (confirmation !== "DELETE") {
        return { success: false, error: "Type DELETE to confirm this inventory purge." };
    }

    try {
        const result = await db.transaction(async (tx) => {
            await acquireWriteLock(tx, "inventory:purge");

            const [{ count: orderItemCount }] = await tx.select({
                count: sql<number>`count(*)`.mapWith(Number),
            }).from(orderItems);
            const [{ count: rfqItemCount }] = await tx.select({
                count: sql<number>`count(*)`.mapWith(Number),
            }).from(rfqItems);
            const [{ count: forecastCount }] = await tx.select({
                count: sql<number>`count(*)`.mapWith(Number),
            }).from(demandForecasts);
            const [{ count: partCount }] = await tx.select({
                count: sql<number>`count(*)`.mapWith(Number),
            }).from(parts);

            await tx.delete(orderItems);
            await tx.delete(rfqItems);
            await tx.delete(demandForecasts);
            await tx.delete(parts);

            return { orderItemCount, rfqItemCount, forecastCount, partCount };
        });

        await logActivity(
            'DELETE',
            'part',
            'all',
            `Cleared ${result.partCount} parts with ${result.orderItemCount} order lines, ${result.rfqItemCount} RFQ lines, and ${result.forecastCount} forecasts.`,
        );
        revalidatePath("/sourcing/parts");
        revalidatePath("/sourcing/orders");
        revalidatePath("/sourcing/rfqs");
        return { success: true, ...result };
    } catch (error) {
        console.error("Failed to clear inventory:", error);
        return { success: false, error: "Failed to clear inventory" };
    }
}

export async function processLowStockAlerts() {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const allParts = await db.select().from(parts);
        const signalRows = await getPartLinkedCounts();
        const signalMap = new Map(signalRows.map((row) => [row.partId, row]));

        const lowStockParts = allParts
            .map((part) => {
                const signals = signalMap.get(part.id);
                const adaptivePlan = calculateAdaptiveReorderPlan({
                    baseReorderPoint: part.reorderPoint,
                    minStockLevel: part.minStockLevel,
                    stockLevel: part.stockLevel,
                    marketTrend: part.marketTrend,
                    delayedOpenOrders: signals?.delayedOrderCount,
                    openOrders: signals?.openOrderCount,
                    forecastDemand: signals?.forecastDemand,
                });

                return { part, adaptivePlan };
            })
            .filter(({ part, adaptivePlan }) => part.stockLevel <= adaptivePlan.adjustedReorderPoint);

        if (lowStockParts.length === 0) {
            return { success: true, count: 0, message: "No low stock items found." };
        }

        let createdCount = 0;
        let skippedCount = 0;
        for (const { part, adaptivePlan } of lowStockParts) {
            const result = await db.transaction(async (tx) => {
                await acquireWriteLock(tx, `inventory:reorder:${part.id}`);

                const existing = await tx.select({
                    id: requisitions.id,
                    status: requisitions.status,
                })
                    .from(requisitions)
                    .where(and(
                        sql`${requisitions.title} like ${'Auto-Reorder:%'}`,
                        sql`${requisitions.description} ilike ${`%SKU: ${part.sku}%`}`,
                        eq(requisitions.department, part.category),
                        inArray(requisitions.status, [...ACTIVE_REORDER_STATUSES])
                    ))
                    .limit(1);

                if (existing.length > 0) {
                    return { success: false as const, duplicate: true };
                }

                const reorderQty = adaptivePlan.recommendedQty;
                const [requisition] = await tx.insert(requisitions).values({
                    title: `Auto-Reorder: ${part.name}`,
                    description: `System generated reorder for SKU: ${part.sku}. Current stock: ${part.stockLevel}, adjusted reorder point: ${adaptivePlan.adjustedReorderPoint}, target stock: ${adaptivePlan.targetStock}. ${adaptivePlan.reasons.join(' ')}`,
                    department: part.category,
                    status: 'draft',
                    requestedById: session.user.id,
                    estimatedAmount: (reorderQty * parseFloat(part.price || "0")).toFixed(2)
                }).returning({ id: requisitions.id });

                return { success: true as const, requisitionId: requisition.id };
            });

            if (!result.success) {
                skippedCount++;
                continue;
            }

            await logActivity('CREATE', 'requisition', result.requisitionId, `Auto-generated requisition for ${part.name} due to low stock (${part.stockLevel})`);
            createdCount++;
        }

        revalidatePath("/sourcing/requisitions");
        return {
            success: true,
            count: createdCount,
            skipped: skippedCount,
            message: skippedCount > 0
                ? `Created ${createdCount} draft requisition${createdCount === 1 ? "" : "s"} and skipped ${skippedCount} active duplicate${skippedCount === 1 ? "" : "s"}.`
                : `Created ${createdCount} draft requisition${createdCount === 1 ? "" : "s"} from the reviewed reorder recommendations.`,
        };
    } catch (error) {
        console.error("Auto-reorder failed:", error);
        return { success: false, error: "Failed to process reorders." };
    }
}
