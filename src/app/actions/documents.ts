'use server'

import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function getDocuments(entityType: 'supplier' | 'order', entityId: string) {
    try {
        const query = entityType === 'supplier'
            ? eq(documents.supplierId, entityId)
            : eq(documents.orderId, entityId);

        const docs = await db.query.documents.findMany({
            where: query,
            orderBy: (docs: any, { desc }: any) => [desc(docs.createdAt)]
        });
        return docs;
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        return [];
    }
}

interface AddDocumentInput {
    supplierId: string;
    orderId?: string;
    name: string;
    type: 'contract' | 'invoice' | 'quote' | 'license' | 'other';
    url?: string;
}

export async function addDocument(data: AddDocumentInput) {
    try {
        const [newDoc] = await db.insert(documents).values({
            ...data,
            url: data.url || `https://example.com/docs/${Math.random().toString(36).substring(7)}.pdf` // Placeholder
        }).returning();

        await logActivity('CREATE', 'document', newDoc.id, `Document '${data.name}' added to ${data.orderId ? 'order' : 'supplier'}`);

        revalidatePath(`/suppliers/${data.supplierId}`);
        if (data.orderId) {
            revalidatePath(`/sourcing/orders/${data.orderId}`);
        }

        return { success: true, document: newDoc };
    } catch (error) {
        console.error("Failed to add document:", error);
        return { success: false, error: "Failed to add document" };
    }
}

export async function deleteDocument(docId: string, supplierId: string, orderId?: string) {
    try {
        await db.delete(documents).where(eq(documents.id, docId));

        revalidatePath(`/suppliers/${supplierId}`);
        if (orderId) {
            revalidatePath(`/sourcing/orders/${orderId}`);
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to delete document:", error);
        return { success: false, error: "Failed to delete document" };
    }
}
