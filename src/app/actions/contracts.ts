'use server'

import { db } from "@/db";
import { contracts, procurementOrders, suppliers } from "@/db/schema";
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

        const rawData = await db
            .select({
                id: contracts.id,
                supplierId: contracts.supplierId,
                title: contracts.title,
                type: contracts.type,
                status: contracts.status,
                value: contracts.value,
                validFrom: contracts.validFrom,
                validTo: contracts.validTo,
                noticePeriod: contracts.noticePeriod,
                renewalStatus: contracts.renewalStatus,
                incoterms: contracts.incoterms,
                createdAt: contracts.createdAt,
                supplierName: suppliers.name,
            })
            .from(contracts)
            .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
            .where(and(...filters))
            .orderBy(desc(contracts.createdAt));

        return rawData.map(row => ({
            ...row,
            supplier: { name: row.supplierName }
        }));
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
    liabilityCap?: number;
    priceLockExpiry?: Date;
    autoRenewalAlert?: string; // 'true' or 'false'
    aiExtractedData?: string;
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
            liabilityCap: data.liabilityCap ? data.liabilityCap.toString() : null,
            priceLockExpiry: data.priceLockExpiry,
            autoRenewalAlert: data.autoRenewalAlert || 'true',
            aiExtractedData: data.aiExtractedData
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

export async function getExpiringContracts(days: number = 90) {
    const session = await auth();
    if (!session) return [];

    try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const expiringRaw = await db
            .select({
                id: contracts.id,
                supplierId: contracts.supplierId,
                title: contracts.title,
                type: contracts.type,
                status: contracts.status,
                value: contracts.value,
                validFrom: contracts.validFrom,
                validTo: contracts.validTo,
                renewalStatus: contracts.renewalStatus,
                supplierName: suppliers.name,
            })
            .from(contracts)
            .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
            .where(and(
                eq(contracts.status, 'active'),
                lte(contracts.validTo, futureDate),
                gte(contracts.validTo, today)
            ))
            .orderBy(contracts.validTo);

        return expiringRaw.map(row => ({
            ...row,
            supplier: { name: row.supplierName }
        }));
    } catch (error) {
        console.error("Failed to fetch expiring contracts:", error);
        return [];
    }
}

export async function deleteContract(id: string) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') return { success: false, error: "Unauthorized" };

    try {
        await db.delete(contracts).where(eq(contracts.id, id));
        await logActivity('DELETE', 'contract', id, `Contract deleted by admin`);
        revalidatePath("/sourcing/contracts");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete contract:", error);
        return { success: false, error: "Failed to delete contract" };
    }
}
