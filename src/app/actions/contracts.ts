'use server'

import { db } from "@/db";
import { contracts, procurementOrders } from "@/db/schema";
import type { Contract, Supplier } from "@/db/schema";
import { eq, desc, and, lte, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";

export async function getContracts(supplierId?: string) {
    const session = await auth();
    if (!session) return [];

    try {
        const filters = [];
        if (supplierId) filters.push(eq(contracts.supplierId, supplierId));

        // If supplier user, force filter
        const userRole = (session.user as any).role;
        const userSupplierId = (session.user as any).supplierId;
        if (userRole === 'supplier') {
            filters.push(eq(contracts.supplierId, userSupplierId));
        }

        const data = await db.query.contracts.findMany({
            where: and(...filters),
            with: {
                supplier: true,
                orders: true, // call-off orders
            },
            orderBy: desc(contracts.createdAt)
        });
        return data;
    } catch (error) {
        console.error("Failed to fetch contracts:", error);
        return [];
    }
}

interface CreateContractData {
    supplierId: string;
    title: string;
    type: 'framework_agreement' | 'nda' | 'service_agreement' | 'one_off';
    value: number;
    validFrom?: Date;
    validTo?: Date;
    noticePeriod?: number;
    renewalStatus?: 'auto_renew' | 'manual' | 'none';
    incoterms?: 'EXW' | 'FCA' | 'CPT' | 'CIP' | 'DAT' | 'DAP' | 'DDP' | 'FAS' | 'FOB' | 'CFR' | 'CIF';
    slaKpis?: string; // JSON string
}

export async function createContract(data: CreateContractData) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        const [newContract] = await db.insert(contracts).values({
            supplierId: data.supplierId,
            title: data.title,
            type: data.type,
            value: data.value.toString(),
            validFrom: data.validFrom,
            validTo: data.validTo,
            noticePeriod: data.noticePeriod || 30,
            renewalStatus: data.renewalStatus || 'manual',
            incoterms: data.incoterms,
            slaKpis: data.slaKpis,
            status: 'draft',
        }).returning();

        await logActivity('CREATE', 'contract', newContract.id, `New contract created: ${data.title}`);

        revalidatePath("/sourcing/contracts");
        revalidatePath(`/suppliers/${data.supplierId}`);
        return { success: true, id: newContract.id };
    } catch (error) {
        console.error("Failed to create contract:", error);
        return { success: false, error: "Failed to create contract" };
    }
}

export async function updateContractStatus(id: string, status: 'active' | 'expired' | 'terminated') {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        await db.update(contracts).set({ status }).where(eq(contracts.id, id));
        await logActivity('UPDATE', 'contract', id, `Contract status updated to ${status.toUpperCase()}`);
        revalidatePath("/sourcing/contracts");
        return { success: true };
    } catch (error) {
        console.error("Failed to update contract:", error);
        return { success: false, error: "Failed to update contract" };
    }
}

export async function getExpiringContracts(days: number = 30) {
    const session = await auth();
    if (!session) return [];

    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const expiring = await db.query.contracts.findMany({
            where: and(
                eq(contracts.status, 'active'),
                lte(contracts.validTo, futureDate),
                gte(contracts.validTo, today)
            ),
            with: {
                supplier: true
            }
        });
        return expiring;
    } catch (error) {
        console.error("Failed to fetch expiring contracts:", error);
        return [];
    }
}
