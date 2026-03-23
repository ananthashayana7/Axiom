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

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function isAllowedDocumentUrl(url?: string) {
    if (!url) return true;
    if (url.startsWith('http://') || url.startsWith('https://')) return true;
    const match = url.match(/^data:([^;]+);base64,/);
    if (!match) return false;
    return ALLOWED_DOCUMENT_MIME_TYPES.has(match[1]);
}

export async function addDocument(data: AddDocumentInput) {
    try {
        if (!isAllowedDocumentUrl(data.url)) {
            return { success: false, error: "Unsupported document format" };
        }

        const [newDoc] = await db.insert(documents).values({
            ...data,
            url: data.url || undefined
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
