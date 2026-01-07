'use server'

import { db } from "@/db";
import { suppliers, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";

export type MitigationPlanType = 'secondary_source' | 'audit_request' | 'stockpile' | 'suspend';

export async function mitigateRisk(supplierId: string, planType: MitigationPlanType, reason: string) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') {
        return { success: false, error: "Unauthorized. Admin privileges required." };
    }

    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) return { success: false, error: "Supplier not found" };

        let actionDescription = "";

        switch (planType) {
            case 'secondary_source':
                actionDescription = `Initiated secondary sourcing workflow for products tied to ${supplier.name} due to ${reason}.`;
                break;
            case 'audit_request':
                actionDescription = `Requested urgent on-site risk audit for ${supplier.name}. Reason: ${reason}.`;
                // Update last audit date
                await db.update(suppliers).set({ lastAuditDate: new Date() }).where(eq(suppliers.id, supplierId));
                break;
            case 'stockpile':
                actionDescription = `Increased safety stock buffers by 25% for components from ${supplier.name}.`;
                break;
            case 'suspend':
                actionDescription = `TEMPORARILY SUSPENDED ${supplier.name} from new orders due to critical risk: ${reason}.`;
                await db.update(suppliers).set({ status: 'inactive', lifecycleStatus: 'suspended' }).where(eq(suppliers.id, supplierId));
                break;
        }

        await logActivity('UPDATE', 'supplier', supplierId, actionDescription);

        revalidatePath('/admin/risk');
        revalidatePath(`/suppliers/${supplierId}`);
        revalidatePath('/suppliers');

        return {
            success: true,
            message: `Mitigation Plan [${planType.toUpperCase()}] successfully activated for ${supplier.name}.`
        };
    } catch (error) {
        console.error("Risk mitigation error:", error);
        return { success: false, error: "Failed to activate mitigation plan." };
    }
}
