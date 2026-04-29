'use server'

import { db } from "@/db";
import { parts, orderItems, rfqItems, requisitions, invoices, demandForecasts, procurementOrders, suppliers, type Part } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { computeShouldCost } from "./cost-intelligence";
import { calculateAdaptiveReorderPlan, estimatePartCarbonFootprint } from "@/lib/procurement-intelligence";

function toNumber(value: string | number | null | undefined) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
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
    try {
        const name = formData.get("name") as string;
        const sku = formData.get("sku") as string;
        const category = formData.get("category") as string;
        const stockLevel = parseInt(formData.get("stock") as string) || 0;
        const price = formData.get("price") as string || '0';
        const marketTrend = formData.get("marketTrend") as string || 'stable';
        const reorderPoint = parseInt(formData.get("reorderPoint") as string) || 50;
        const minStockLevel = parseInt(formData.get("minStockLevel") as string) || 20;

        const [newPart] = await db.insert(parts).values({
            name,
            sku,
            category,
            stockLevel,
            price,
            marketTrend,
            reorderPoint,
            minStockLevel,
        }).returning();

        await logActivity('CREATE', 'part', newPart.id, `Created new part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to add part:", error);
        return { success: false, error: "Failed to add part" };
    }
}

export async function updatePart(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const sku = formData.get("sku") as string;
        const category = formData.get("category") as string;
        const stockLevel = parseInt(formData.get("stock") as string) || 0;
        const price = formData.get("price") as string;
        const marketTrend = formData.get("marketTrend") as string;
        const reorderPoint = parseInt(formData.get("reorderPoint") as string);
        const minStockLevel = parseInt(formData.get("minStockLevel") as string);

        await db.update(parts)
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
            .where(eq(parts.id, id));

        await logActivity('UPDATE', 'part', id, `Updated part: ${name} (${sku})`);

        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update part:", error);
        return { success: false, error: "Failed to update part" };
    }
}

export async function deletePart(id: string) {
    try {
        // 1. Check for Active Dependencies
        const inOrders = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.partId, id)).limit(1);
        if (inOrders.length > 0) {
            return { success: false, error: "Cannot delete: Part exists in Procurement Orders." };
        }

        const inRfqs = await db.select({ id: rfqItems.id }).from(rfqItems).where(eq(rfqItems.partId, id)).limit(1);
        if (inRfqs.length > 0) {
            return { success: false, error: "Cannot delete: Part is listed in active RFQs." };
        }

        const [part] = await db.select().from(parts).where(eq(parts.id, id));
        if (part) {
            await db.delete(parts).where(eq(parts.id, id));
            await logActivity('DELETE', 'part', id, `Deleted part: ${part.name} (${part.sku})`);
        }
        revalidatePath("/sourcing/parts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete part:", error);
        return { success: false, error: "Failed to delete part" };
    }
}

export async function deleteAllParts() {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return { success: false, error: "Unauthorized. Admin rights required." };
    }

    try {
        const result = await db.transaction(async (tx) => {
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

            // Delete dependent records before parts so foreign key constraints do not block the purge.
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

                return { part, signals, adaptivePlan };
            })
            .filter(({ part, adaptivePlan }) => part.stockLevel <= adaptivePlan.adjustedReorderPoint);

        if (lowStockParts.length === 0) {
            return { success: true, count: 0, message: "No low stock items found." };
        }

        let createdCount = 0;
        for (const { part, adaptivePlan } of lowStockParts) {
            const reorderQty = adaptivePlan.recommendedQty;

            await db.insert(requisitions).values({
                title: `Auto-Reorder: ${part.name}`,
                description: `System generated reorder for SKU: ${part.sku}. Current stock: ${part.stockLevel}, adjusted reorder point: ${adaptivePlan.adjustedReorderPoint}, target stock: ${adaptivePlan.targetStock}. ${adaptivePlan.reasons.join(' ')}`,
                department: part.category,
                status: 'draft',
                requestedById: (session.user as any).id,
                estimatedAmount: (reorderQty * parseFloat(part.price || "0")).toString()
            });

            await logActivity('CREATE', 'requisition', 'auto', `Auto-generated requisition for ${part.name} due to low stock (${part.stockLevel})`);
            createdCount++;
        }

        revalidatePath("/sourcing/requisitions");
        return {
            success: true,
            count: createdCount,
            message: `Created ${createdCount} draft requisition${createdCount === 1 ? "" : "s"} from the reviewed reorder recommendations.`,
        };
    } catch (error) {
        console.error("Auto-reorder failed:", error);
        return { success: false, error: "Failed to process reorders." };
    }
}
