'use server'

import { db } from "@/db";
import { procurementOrders, orderItems } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function getOrders() {
    try {
        const allOrders = await db.query.procurementOrders.findMany({
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
