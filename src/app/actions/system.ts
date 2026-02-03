'use server'

import { db } from "@/db";
import {
    orderItems,
    invoices,
    goodsReceipts,
    procurementOrders,
    requisitions,
    contracts,
    rfqSuppliers,
    rfqItems,
    rfqs,
    documents,
    parts,
    supplierPerformanceLogs,
    suppliers,
    auditLogs,
    notifications,
    chatHistory,
    users
} from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function resetDatabase() {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') {
        return { success: false, error: "Unauthorized. Admin rights required." };
    }

    try {
        console.log("Resetting database initiated by:", session.user?.email);

        // Delete in order of constraints
        await db.delete(orderItems);
        await db.delete(invoices);
        await db.delete(goodsReceipts);

        // Requisitions depend on POs and vice versa (circular ref usually handled by nulling or specific order)
        // Set PO IDs to null first if any circular deps exist (though schema usually has Req -> PO or PO -> Req)
        await db.delete(requisitions);
        await db.delete(procurementOrders);

        await db.delete(documents);
        await db.delete(contracts);

        await db.delete(rfqSuppliers);
        await db.delete(rfqItems);
        await db.delete(rfqs);

        await db.delete(parts);
        await db.delete(supplierPerformanceLogs);
        await db.delete(suppliers);

        await db.delete(auditLogs);
        await db.delete(notifications);
        await db.delete(chatHistory);

        // Delete all users except the current admin
        if (session.user?.id) {
            await db.delete(users).where(ne(users.id, session.user.id));
        }

        revalidatePath("/", "layout");
        console.log("Database reset complete.");
        return { success: true };
    } catch (error) {
        console.error("Database reset failed:", error);
        return { success: false, error: "Failed to reset database. See server logs." };
    }
}
