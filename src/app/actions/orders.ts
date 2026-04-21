'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, rfqs, rfqItems, rfqSuppliers, invoices, goodsReceipts, auditLogs, contracts, suppliers, qcInspections, parts, marketPriceIndex, savingsRecords, sourcingEvents } from "@/db/schema";
import { eq, and, lte, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";
import { calculateThreeWayMatchStatus } from "@/lib/utils/three-way-match";

const orderItemTotals = db.select({
    orderId: orderItems.orderId,
    lineTotal: sql<string>`COALESCE(SUM(${orderItems.quantity} * CAST(${orderItems.unitPrice} AS numeric)), 0)`.as('line_total')
}).from(orderItems).groupBy(orderItems.orderId).as('order_action_item_totals');

const effectiveOrderTotal = sql<string>`COALESCE(NULLIF(CAST(${procurementOrders.totalAmount} AS numeric), 0), CAST(${orderItemTotals.lineTotal} AS numeric), 0)`;

function toNumber(value: string | number | null | undefined) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
}

async function incrementInventoryForOrder(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], orderId: string) {
    const items = await tx.select({
        partId: orderItems.partId,
        quantity: orderItems.quantity,
    }).from(orderItems).where(eq(orderItems.orderId, orderId));

    await Promise.all(items.map((item) => tx.update(parts)
        .set({ stockLevel: sql`${parts.stockLevel} + ${item.quantity}` })
        .where(eq(parts.id, item.partId))));
}

export async function getOrders() {
    const session = await auth();
    if (!session) return [];

    const role = session.user.role;
    const supplierId = session.user.supplierId;

    try {
        const allOrdersRaw = await db
            .select({
                id: procurementOrders.id,
                supplierId: procurementOrders.supplierId,
                status: procurementOrders.status,
                totalAmount: effectiveOrderTotal,
                createdAt: procurementOrders.createdAt,
                supplierName: suppliers.name,
            })
            .from(procurementOrders)
            .leftJoin(orderItemTotals, eq(orderItemTotals.orderId, procurementOrders.id))
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(role === 'supplier' ? eq(procurementOrders.supplierId, supplierId) : undefined);

        return allOrdersRaw.map(order => ({
            ...order,
            supplier: { name: order.supplierName }
        }));
    } catch (error) {
        console.error("Failed to fetch orders:", error);
        return [];
    }
}

interface CreateOrderInput {
    supplierId: string;
    totalAmount: number;
    items: {
        partId: string;
        quantity: number;
        unitPrice: number;
    }[];
    incoterms?: string;
    asnNumber?: string;
}

export async function createOrder(data: CreateOrderInput) { // Use simpler type for direct call
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const { supplierId, totalAmount, items } = data;
        if (totalAmount <= 0) return { success: false, error: "Total amount must be positive" };

        return await db.transaction(async (tx) => {
            // 0. Check for Active Framework Agreement
            const today = new Date();
            const [activeContract] = await tx.select()
                .from(contracts)
                .where(and(
                    eq(contracts.supplierId, supplierId),
                    eq(contracts.status, 'active'),
                    eq(contracts.type, 'framework_agreement'),
                    lte(contracts.validFrom, today),
                    gte(contracts.validTo, today)
                ))
                .limit(1);

            const contractId = activeContract?.id || null;
            const effectiveIncoterms = data.incoterms || activeContract?.incoterms || null;

            // 1. Create Order
            const [newOrder] = await tx.insert(procurementOrders).values({
                supplierId,
                totalAmount: totalAmount.toFixed(2),
                status: 'draft',
                contractId,
                incoterms: effectiveIncoterms,
                asnNumber: data.asnNumber
            }).returning({ insertedId: procurementOrders.id });

            const orderId = newOrder.insertedId;

            if (contractId) {
                await tx.insert(auditLogs).values({
                    userId: session.user.id,
                    action: 'LINK',
                    entityType: 'order',
                    entityId: orderId,
                    details: `Order auto-linked to Framework Agreement ${activeContract.title}`
                });
            }

            // 2. Create Items
            if (items.length > 0) {
                await tx.insert(orderItems).values(
                    items.map(item => ({
                        orderId,
                        partId: item.partId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toFixed(2),
                    }))
                );
            }

            await logActivity('CREATE', 'order', orderId, `New order created for total amount INR ${totalAmount.toLocaleString()}`);

            revalidatePath("/sourcing/orders");
            return { success: true };
        });
    } catch (error) {
        console.error("Failed to create order:", error);
        return { success: false, error: "Failed to create order" };
    }
}
export async function updateOrderStatus(orderId: string, status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'fulfilled' | 'cancelled') {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    const role = session.user.role;
    const userSupplierId = session.user.supplierId;

    try {
        return await db.transaction(async (tx) => {
            // Fetch current order inside transaction to prevent TOCTOU race
            await tx.execute(sql`select ${procurementOrders.id} from ${procurementOrders} where ${procurementOrders.id} = ${orderId} for update`);
            const [currentOrder] = await tx.select().from(procurementOrders).where(eq(procurementOrders.id, orderId));
            if (!currentOrder) return { success: false, error: "Order not found" };

            // Permission Checks
            if (role === 'supplier') {
                // Suppliers can only update their own orders
                if (currentOrder.supplierId !== userSupplierId) return { success: false, error: "Unauthorized" };

                // Suppliers can typically only mark as fulfilled or cancelled (if allowed)
                // preventing them from approving their own orders
                if (['approved', 'sent'].includes(status)) {
                    return { success: false, error: "Unauthorized status change" };
                }
            }

            // Admin/User checks for specific status transitions
            if (status === 'approved' || status === 'rejected') {
                if (role !== 'admin') {
                    return { success: false, error: "Only admins can approve/reject orders" };
                }
            }

            await tx.update(procurementOrders)
                .set({ status })
                .where(eq(procurementOrders.id, orderId));

            await logActivity('UPDATE', 'order', orderId, `Order status updated to ${status.toUpperCase().replace('_', ' ')}`);

            revalidatePath("/sourcing/orders");
            revalidatePath(`/sourcing/orders/${orderId}`);
            revalidatePath("/portal/orders");
            return { success: true };
        });
    } catch (error) {
        console.error("Failed to update order status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function convertRFQToOrder(rfqId: string, supplierId: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        return await db.transaction(async (tx) => {
            return await TelemetryService.time("OrderManagement", "convertRFQToOrder", async () => {
                await tx.execute(sql`select ${rfqs.id} from ${rfqs} where ${rfqs.id} = ${rfqId} for update`);

                const [rfq] = await tx.select({
                    id: rfqs.id,
                    status: rfqs.status,
                })
                    .from(rfqs)
                    .where(eq(rfqs.id, rfqId))
                    .limit(1);

                if (!rfq) {
                    throw new Error("RFQ not found");
                }

                if (rfq.status === 'closed') {
                    return { success: false, error: "RFQ already converted to an order." };
                }

                if (rfq.status === 'cancelled') {
                    return { success: false, error: "Cancelled RFQs cannot be converted." };
                }

                // 1. Fetch winning quote and RFQ data
                const [quote] = await tx.select()
                    .from(rfqSuppliers)
                    .where(and(eq(rfqSuppliers.rfqId, rfqId), eq(rfqSuppliers.supplierId, supplierId)));

                if (!quote) throw new Error("Quotation not found");

                const allQuotes = await tx.select({
                    supplierId: rfqSuppliers.supplierId,
                    quoteAmount: rfqSuppliers.quoteAmount,
                }).from(rfqSuppliers)
                  .where(and(
                      eq(rfqSuppliers.rfqId, rfqId),
                      sql`${rfqSuppliers.quoteAmount} IS NOT NULL`
                  ));

                const items = await tx.select({
                    partId: rfqItems.partId,
                    quantity: rfqItems.quantity,
                    partSku: parts.sku,
                    partName: parts.name,
                    partCategory: parts.category,
                    partPrice: parts.price,
                }).from(rfqItems)
                  .innerJoin(parts, eq(rfqItems.partId, parts.id))
                  .where(eq(rfqItems.rfqId, rfqId));

                // 2. Create Order
                const totalAmount = parseFloat(quote.quoteAmount || "0");
                if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
                    return { success: false, error: "Quoted amount must be greater than zero before converting this RFQ." };
                }

                if (items.length === 0) {
                    return { success: false, error: "RFQ must contain at least one item before conversion." };
                }

                const quoteAmounts = allQuotes.map((entry) => toNumber(entry.quoteAmount)).filter((amount) => amount > 0);
                const averageQuotedAmount = quoteAmounts.length > 0
                    ? quoteAmounts.reduce((sum, amount) => sum + amount, 0) / quoteAmounts.length
                    : totalAmount;
                const competitiveBaseline = Math.max(totalAmount, averageQuotedAmount);
                const competitiveSavings = roundCurrency(Math.max(competitiveBaseline - totalAmount, 0));

                const categories = Array.from(new Set(items.map((item) => item.partCategory)));
                const partIds = items.map((item) => item.partId);

                const historicalRows = partIds.length > 0
                    ? await tx.select({
                        partId: orderItems.partId,
                        averagePrice: sql<string>`avg(cast(${orderItems.unitPrice} as numeric))`,
                    }).from(orderItems)
                      .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
                      .where(inArray(orderItems.partId, partIds))
                      .groupBy(orderItems.partId)
                    : [];

                const historicalMap = new Map<string, number>();
                for (const row of historicalRows) {
                    historicalMap.set(row.partId, toNumber(row.averagePrice));
                }

                const benchmarkRows = categories.length > 0
                    ? await tx.select({
                        partCategory: marketPriceIndex.partCategory,
                        benchmarkPrice: marketPriceIndex.benchmarkPrice,
                        createdAt: marketPriceIndex.createdAt,
                    }).from(marketPriceIndex)
                      .where(inArray(marketPriceIndex.partCategory, categories))
                      .orderBy(sql`${marketPriceIndex.partCategory} asc`, sql`${marketPriceIndex.createdAt} desc`)
                    : [];

                const benchmarkMap = new Map<string, number>();
                for (const row of benchmarkRows) {
                    if (!benchmarkMap.has(row.partCategory)) {
                        benchmarkMap.set(row.partCategory, toNumber(row.benchmarkPrice));
                    }
                }

                const shouldCostTotal = roundCurrency(items.reduce((sum, item) => {
                    const currentUnitPrice = toNumber(item.partPrice);
                    const benchmarkUnitPrice = benchmarkMap.get(item.partCategory) ?? null;
                    const historicalUnitPrice = historicalMap.get(item.partId) ?? null;
                    const weightedSignals = [
                        benchmarkUnitPrice !== null ? benchmarkUnitPrice * 3 : 0,
                        historicalUnitPrice !== null ? historicalUnitPrice * 2 : 0,
                        currentUnitPrice > 0 ? currentUnitPrice : 0,
                    ];
                    const totalWeight = [
                        benchmarkUnitPrice !== null ? 3 : 0,
                        historicalUnitPrice !== null ? 2 : 0,
                        currentUnitPrice > 0 ? 1 : 0,
                    ].reduce((weightSum, weight) => weightSum + weight, 0);
                    const shouldCostUnitPrice = totalWeight > 0
                        ? weightedSignals.reduce((valueSum, value) => valueSum + value, 0) / totalWeight
                        : currentUnitPrice;

                    return sum + (shouldCostUnitPrice * item.quantity);
                }, 0));

                const shouldCostSavings = roundCurrency(Math.max(shouldCostTotal - totalAmount, 0));
                const orderSavingsAmount = competitiveSavings > 0 ? competitiveSavings : shouldCostSavings;
                const orderSavingsType = competitiveSavings > 0 ? 'negotiated' : shouldCostSavings > 0 ? 'should_cost' : null;

                const [newOrder] = await tx.insert(procurementOrders).values({
                    supplierId,
                    totalAmount: totalAmount.toFixed(2),
                    status: 'sent',
                    initialQuoteAmount: competitiveBaseline.toFixed(2),
                    savingsAmount: orderSavingsAmount.toFixed(2),
                    savingsType: orderSavingsType,
                }).returning({ insertedId: procurementOrders.id });

                const orderId = newOrder.insertedId;

                // 3. Create items with estimated unit price
                const totalQuantity = items.reduce((acc: number, curr) => acc + curr.quantity, 0);
                const estimatedAvgPrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;

                await tx.insert(orderItems).values(
                    items.map((item) => ({
                        orderId,
                        partId: item.partId,
                        quantity: item.quantity,
                        unitPrice: estimatedAvgPrice.toFixed(2),
                    }))
                );

                // 4. Update RFQ Status to closed
                await tx.update(rfqs).set({ status: 'closed' }).where(eq(rfqs.id, rfqId));

                await tx.update(sourcingEvents)
                    .set({
                        status: 'awarded',
                        awardedSupplierId: supplierId,
                        awardedAt: new Date(),
                        awardJustification: `Converted to order ${orderId.split('-')[0].toUpperCase()} from RFQ workflow.`,
                        updatedAt: new Date(),
                    })
                    .where(eq(sourcingEvents.rfqId, rfqId));

                if (competitiveSavings > 0) {
                    await tx.insert(savingsRecords).values({
                        entityType: 'order',
                        entityId: orderId,
                        category: 'negotiated',
                        trackingStatus: 'realized',
                        forecastAmount: competitiveSavings.toFixed(2),
                        realizedAmount: competitiveSavings.toFixed(2),
                        baselineAmount: competitiveBaseline.toFixed(2),
                        currency: 'INR',
                        notes: `Awarded supplier ${supplierId} closed ${competitiveSavings.toFixed(2)} below the average quoted baseline for RFQ ${rfqId}.`,
                    });
                }

                if (shouldCostSavings > 0) {
                    await tx.insert(savingsRecords).values({
                        entityType: 'order',
                        entityId: orderId,
                        category: 'should_cost',
                        trackingStatus: 'realized',
                        forecastAmount: shouldCostSavings.toFixed(2),
                        realizedAmount: shouldCostSavings.toFixed(2),
                        baselineAmount: shouldCostTotal.toFixed(2),
                        currency: 'INR',
                        notes: `Awarded supplier ${supplierId} landed below modeled should-cost for RFQ ${rfqId}.`,
                    });
                }

                await logActivity('CREATE', 'order', orderId, `Converted from RFQ ${rfqId.split('-')[0].toUpperCase()}. Status: SENT. Competitive savings ${competitiveSavings.toFixed(2)}, should-cost delta ${shouldCostSavings.toFixed(2)}.`);

                await TelemetryService.trackMetric("OrderManagement", "rfq_conversion_value", totalAmount, { rfqId, orderId });
                await TelemetryService.trackMetric("OrderManagement", "rfq_conversion_competitive_savings", competitiveSavings, { rfqId, orderId });
                await TelemetryService.trackMetric("OrderManagement", "rfq_conversion_should_cost_savings", shouldCostSavings, { rfqId, orderId });
                await TelemetryService.trackEvent("OrderManagement", "rfq_converted_successfully", { orderId });

                revalidatePath("/sourcing/rfqs");
                revalidatePath(`/sourcing/rfqs/${rfqId}`);
                revalidatePath("/sourcing/orders");
                revalidatePath("/portal/orders");

                return { success: true, orderId };
            });
        });
    } catch (error) {
        await TelemetryService.trackError("OrderManagement", "rfq_conversion_failed", error, { rfqId, supplierId });
        console.error("Conversion error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to convert RFQ to Order." };
    }
}

export async function recordGoodsReceipt(orderId: string, data: {
    notes?: string,
    visualInspectionPassed: boolean,
    quantityVerified: boolean,
    documentMatch: boolean
}) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        return await db.transaction(async (tx) => {
            await tx.execute(sql`select ${procurementOrders.id} from ${procurementOrders} where ${procurementOrders.id} = ${orderId} for update`);

            const existingReceipts = await tx.select({ id: goodsReceipts.id })
                .from(goodsReceipts)
                .where(eq(goodsReceipts.orderId, orderId));

            const passedInspectionCount = existingReceipts.length > 0
                ? await tx.select({ count: sql<number>`COUNT(*)::int` })
                    .from(qcInspections)
                    .where(and(
                        inArray(qcInspections.receiptId, existingReceipts.map((receipt) => receipt.id)),
                        eq(qcInspections.status, 'passed')
                    ))
                : [{ count: 0 }];

            const [receipt] = await tx.insert(goodsReceipts).values({
                orderId,
                receivedById: session.user.id,
                notes: data.notes,
                inspectionStatus: data.visualInspectionPassed && data.quantityVerified && data.documentMatch ? 'passed' : 'failed',
                inspectionNotes: data.notes,
            }).returning();

            // 2. Create QC Inspection Record
            const qcPassed = data.visualInspectionPassed && data.quantityVerified && data.documentMatch;
            await tx.insert(qcInspections).values({
                receiptId: receipt.id,
                inspectorId: session.user.id,
                status: qcPassed ? 'passed' : 'failed',
                visualInspectionPassed: data.visualInspectionPassed ? 'yes' : 'no',
                quantityVerified: data.quantityVerified ? 'yes' : 'no',
                documentMatch: data.documentMatch ? 'yes' : 'no',
                notes: data.notes,
            });

            // Only mark as fulfilled if all QC checks pass
            if (qcPassed) {
                if ((passedInspectionCount[0]?.count || 0) === 0) {
                    await incrementInventoryForOrder(tx, orderId);
                }

                await tx.update(procurementOrders)
                    .set({ status: 'fulfilled' })
                    .where(eq(procurementOrders.id, orderId));
            }

            // Re-evaluate financial match state whenever GRN/QC changes.
            await validateThreeWayMatch(orderId);

            revalidatePath(`/sourcing/orders/${orderId}`);
            revalidatePath("/sourcing/goods-receipts");
            revalidatePath("/sourcing/invoices");
            revalidatePath("/transactions");
            return { success: true };
        });
    } catch (error) {
        console.error("Goods receipt recording failed:", error);
        return { success: false, error: "Failed to record receipt and inspection" };
    }
}

export async function updateOrderLogistics(orderId: string, data: {
    carrier: string,
    trackingNumber: string,
    estimatedArrival: string
}) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        await db.update(procurementOrders)
            .set({
                carrier: data.carrier,
                trackingNumber: data.trackingNumber,
                estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : null
            })
            .where(eq(procurementOrders.id, orderId));

        await logActivity('UPDATE', 'order', orderId, `Logistics updated: ${data.carrier} tracking #${data.trackingNumber}`);

        revalidatePath(`/sourcing/orders/${orderId}`);
        return { success: true };
    } catch (error) {
        console.error("Logistics update failed:", error);
        return { success: false, error: "Failed to update logistics" };
    }
}

export async function addInvoice(data: { orderId: string, supplierId: string, invoiceNumber: string, amount: number }) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const [invoice] = await db.insert(invoices).values({
            orderId: data.orderId,
            supplierId: data.supplierId,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount.toString(),
            status: 'pending'
        }).returning();

        // Auto-trigger Three-Way Match validation
        await validateThreeWayMatch(data.orderId);

        revalidatePath(`/sourcing/orders/${data.orderId}`);
        revalidatePath('/sourcing/invoices');
        revalidatePath('/transactions');
        return { success: true, data: invoice };
    } catch (error) {
        console.error("Invoice addition failed:", error);
        return { success: false };
    }
}

export async function validateThreeWayMatch(orderId: string) {
    try {
        return await TelemetryService.time("FinancialCompliance", "validateThreeWayMatch", async () => {
            // Fetch original PO
            const [po] = await db.select().from(procurementOrders).where(eq(procurementOrders.id, orderId));
            if (!po) return { success: false, error: "Order not found" };

            // 1. Check for Goods Receipt
            const receipts = await db.select().from(goodsReceipts).where(eq(goodsReceipts.orderId, orderId));
            const hasReceipt = receipts.length > 0;

            // 2. Check for QC Pass
            let qcPassed = false;
            if (hasReceipt) {
                const inspections = await db.select()
                    .from(qcInspections)
                    .where(inArray(qcInspections.receiptId, receipts.map((receipt) => receipt.id)));
                qcPassed = inspections.some(ins => ins.status === 'passed');
            }

            // 3. Check for Invoices
            const orderInvoices = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
            const [itemTotalRow] = await db.select({
                total: sql<string>`COALESCE(SUM(${orderItems.quantity} * CAST(${orderItems.unitPrice} AS numeric)), 0)`
            }).from(orderItems).where(eq(orderItems.orderId, orderId));

            const headerAmount = parseFloat(po.totalAmount || "0");
            const lineItemAmount = parseFloat(itemTotalRow?.total || "0");
            const poAmount = headerAmount > 0 ? headerAmount : lineItemAmount;
            const matchStatus = calculateThreeWayMatchStatus({
                poAmount,
                invoiceAmounts: orderInvoices.map((invoice) => parseFloat(invoice.amount)),
                hasReceipt,
                qcPassed,
            });

            if (matchStatus.isMatched) {
                await db.update(invoices)
                    .set({ status: 'matched', matchedAt: new Date() })
                    .where(eq(invoices.orderId, orderId));

                revalidatePath('/sourcing/invoices');
                revalidatePath(`/sourcing/orders/${orderId}`);
                revalidatePath('/transactions');

                await TelemetryService.trackEvent("FinancialCompliance", "three_way_match_success", { orderId, amount: poAmount });
                return { success: true, status: 'MATCHED' };
            }

            await db.update(invoices)
                .set({
                    status: matchStatus.status,
                    matchedAt: null,
                })
                .where(eq(invoices.orderId, orderId));

            if (matchStatus.status === 'disputed') {
                await logActivity('UPDATE', 'order', orderId, `Three-way match disputed due to invoice variance of ${(matchStatus.totalInvoiced - poAmount).toFixed(2)}`);
            }

            await TelemetryService.trackEvent("FinancialCompliance", "three_way_match_pending", {
                orderId,
                hasReceipt,
                qcPassed,
                isPriceMatched: matchStatus.isPriceMatched,
                variance: matchStatus.totalInvoiced - poAmount,
                reason: matchStatus.reason,
            });
            return { success: true, status: 'PENDING_MATCH', reason: matchStatus.reason };
        });
    } catch (error) {
        await TelemetryService.trackError("FinancialCompliance", "match_validation_error", error, { orderId });
        console.error("3-Way Match validation failed:", error);
        return { success: false };
    }
}

export async function getOrderFinanceDetails(orderId: string) {
    const session = await auth();
    if (!session) return null;

    try {
        const receipts = await db.select().from(goodsReceipts).where(eq(goodsReceipts.orderId, orderId));
        const orderInvoices = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
        const [order] = await db.select({
            totalAmount: procurementOrders.totalAmount,
        }).from(procurementOrders).where(eq(procurementOrders.id, orderId)).limit(1);

        const [itemTotalRow] = await db.select({
            total: sql<string>`COALESCE(SUM(${orderItems.quantity} * CAST(${orderItems.unitPrice} AS numeric)), 0)`
        }).from(orderItems).where(eq(orderItems.orderId, orderId));

        const receiptIds = receipts.map((receipt) => receipt.id);
        const inspections = receiptIds.length > 0
            ? await db.select().from(qcInspections).where(inArray(qcInspections.receiptId, receiptIds))
            : [];
        const qcPassed = inspections.some((inspection) => inspection.status === 'passed');
        const matchStatus = calculateThreeWayMatchStatus({
            poAmount: parseFloat(order?.totalAmount || "0") > 0 ? parseFloat(order?.totalAmount || "0") : parseFloat(itemTotalRow?.total || "0"),
            invoiceAmounts: orderInvoices.map((invoice) => parseFloat(invoice.amount)),
            hasReceipt: receipts.length > 0,
            qcPassed,
        });

        return {
            receipts,
            invoices: orderInvoices,
            inspections,
            qcPassed,
            totalInvoiced: matchStatus.totalInvoiced,
            isPriceMatched: matchStatus.isPriceMatched,
            isMatched: matchStatus.isMatched,
            reason: matchStatus.reason,
        };
    } catch (error) {
        console.error("Failed to fetch order finance details:", error);
        return null;
    }
}

export async function deleteOrder(id: string) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        await db.delete(procurementOrders).where(eq(procurementOrders.id, id));
        revalidatePath("/sourcing/orders");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete order:", error);
        return { success: false, error: "Failed to delete" };
    }
}
