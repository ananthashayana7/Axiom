'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, rfqs, rfqItems, rfqSuppliers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
}

export async function createOrder(data: CreateOrderInput) { // Use simpler type for direct call
    const session = await auth();
    if (!session || (session.user as any).role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const { supplierId, totalAmount, items } = data;

        // 1. Create Order
        const [newOrder] = await db.insert(procurementOrders).values({
            supplierId,
            totalAmount: totalAmount.toString(),
            status: 'draft'
        }).returning({ insertedId: procurementOrders.id });

        const orderId = newOrder.insertedId;

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
