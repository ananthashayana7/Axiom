'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, rfqs, rfqItems, rfqSuppliers, invoices, goodsReceipts, auditLogs, contracts } from "@/db/schema";
import { eq, and, sql, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";

export async function getOrders() {
    const session = await auth();
    if (!session) return [];

    const role = (session.user as any).role;
    const supplierId = (session.user as any).supplierId;

    try {
        const allOrders = await db.query.procurementOrders.findMany({
            where: role === 'supplier' ? eq(procurementOrders.supplierId, supplierId) : undefined,
            with: {
                supplier: true,
            }
        });
        return allOrders;
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
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const { supplierId, totalAmount, items } = data;

        // 0. Check for Active Framework Agreement
        const today = new Date();
        const [activeContract] = await db.select()
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
        const [newOrder] = await db.insert(procurementOrders).values({
            supplierId,
            totalAmount: totalAmount.toString(),
            status: 'draft',
            contractId,
            incoterms: effectiveIncoterms,
            asnNumber: data.asnNumber
        }).returning({ insertedId: procurementOrders.id });

        const orderId = newOrder.insertedId;

        if (contractId) {
            await db.insert(auditLogs).values({
                userId: (session.user as any).id,
                action: 'LINK',
                entityType: 'order',
                entityId: orderId,
                details: `Order auto-linked to Framework Agreement ${activeContract.title}`
            });
        }

        // 2. Create Items
        if (items.length > 0) {
            await db.insert(orderItems).values(
                items.map(item => ({
                    orderId,
                    partId: item.partId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                }))
            );
        }

        await logActivity('CREATE', 'order', orderId, `New order created for total amount ₹${totalAmount.toLocaleString()}`);

        revalidatePath("/sourcing/orders");
        return { success: true };
    } catch (error) {
        console.error("Failed to create order:", error);
        return { success: false, error: "Failed to create order" };
    }
}
export async function updateOrderStatus(orderId: string, status: 'draft' | 'sent' | 'fulfilled' | 'cancelled') {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    const role = (session.user as any).role;
    const userSupplierId = (session.user as any).supplierId;

    try {
        // Suppliers can only update their own orders (and typically not status, but let's be robust)
        if (role === 'supplier') {
            const [order] = await db.select().from(procurementOrders).where(eq(procurementOrders.id, orderId));
            if (!order || order.supplierId !== userSupplierId) return { success: false, error: "Unauthorized" };
        }

        await db.update(procurementOrders)
            .set({ status })
            .where(eq(procurementOrders.id, orderId));

        await logActivity('UPDATE', 'order', orderId, `Order status updated to ${status.toUpperCase()}`);

        revalidatePath("/sourcing/orders");
        revalidatePath(`/sourcing/orders/${orderId}`);
        revalidatePath("/portal/orders");
        return { success: true };
    } catch (error) {
        console.error("Failed to update order status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function convertRFQToOrder(rfqId: string, supplierId: string) {
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // 1. Fetch winning quote and RFQ data
        const [quote] = await db.select()
            .from(rfqSuppliers)
            .where(and(eq(rfqSuppliers.rfqId, rfqId), eq(rfqSuppliers.supplierId, supplierId)));

        if (!quote) throw new Error("Quotation not found");

        const items = await db.query.rfqItems.findMany({
            where: eq(rfqItems.rfqId, rfqId),
            with: {
                part: true
            }
        });

        // 2. Create Order
        const totalAmount = parseFloat(quote.quoteAmount || "0");
        const [newOrder] = await db.insert(procurementOrders).values({
            supplierId,
            totalAmount: totalAmount.toString(),
            status: 'sent'
        }).returning({ insertedId: procurementOrders.id });

        const orderId = newOrder.insertedId;

        // 3. Create items with estimated unit price
        const totalQuantity = items.reduce((acc: number, curr: any) => acc + curr.quantity, 0);
        const estimatedAvgPrice = totalAmount / totalQuantity;

        await db.insert(orderItems).values(
            items.map((item: any) => ({
                orderId,
                partId: item.partId,
                quantity: item.quantity,
                unitPrice: estimatedAvgPrice.toFixed(2),
            }))
        );

        // 4. Update RFQ Status to closed
        await db.update(rfqs).set({ status: 'closed' }).where(eq(rfqs.id, rfqId));

        await logActivity('CREATE', 'order', orderId, `Converted from RFQ ${rfqId.split('-')[0].toUpperCase()}. Status: SENT.`);

        revalidatePath("/sourcing/rfqs");
        revalidatePath(`/sourcing/rfqs/${rfqId}`);
        revalidatePath("/sourcing/orders");
        revalidatePath("/portal/orders");

        return { success: true, orderId };
    } catch (error) {
        console.error("Conversion error:", error);
        return { success: false, error: "Failed to convert RFQ to Order." };
    }
}

export async function recordGoodsReceipt(orderId: string, notes?: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        await db.insert(goodsReceipts).values({
            orderId,
            receivedById: (session.user as any).id,
            notes
        });

        await db.update(procurementOrders)
            .set({ status: 'fulfilled' })
            .where(eq(procurementOrders.id, orderId));

        revalidatePath(`/sourcing/orders/${orderId}`);
        return { success: true };
    } catch (error) {
        console.error("Goods receipt recording failed:", error);
        return { success: false };
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
        return { success: true, data: invoice };
    } catch (error) {
        console.error("Invoice addition failed:", error);
        return { success: false };
    }
}

export async function validateThreeWayMatch(orderId: string) {
    try {
        // Fetch original PO
        const [po] = await db.select().from(procurementOrders).where(eq(procurementOrders.id, orderId));
        if (!po) return { success: false, error: "Order not found" };

        // Check for Goods Receipt
        const receipts = await db.select().from(goodsReceipts).where(eq(goodsReceipts.orderId, orderId));
        const hasReceipt = receipts.length > 0;

        // Check for Invoices
        const orderInvoices = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
        const totalInvoiceAmount = orderInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

        const poAmount = parseFloat(po.totalAmount || "0");
        const isPriceMatched = Math.abs(totalInvoiceAmount - poAmount) < 0.01;

        if (hasReceipt && isPriceMatched) {
            await db.update(invoices)
                .set({ status: 'matched', matchedAt: new Date() })
                .where(eq(invoices.orderId, orderId));

            return { success: true, status: 'MATCHED' };
        }

        return { success: true, status: 'PENDING_MATCH' };
    } catch (error) {
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

        return {
            receipts,
            invoices: orderInvoices,
            isMatched: orderInvoices.some(inv => inv.status === 'matched')
        };
    } catch (error) {
        console.error("Failed to fetch order finance details:", error);
        return null;
    }
}
