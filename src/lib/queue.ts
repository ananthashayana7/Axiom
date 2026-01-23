// src/lib/queue.ts – Mocked BullMQ setup (Dependencies could not be auto-installed)
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Mock types to satisfy build
type Job<T> = { data: T };

// Helper to simulate a scoring job for a supplier
export async function enqueueSupplierScore(supplierId: string) {
    console.log(`[Queue Mock] Enqueued scoring job for supplier: ${supplierId}`);

    // For now, simulate the worker logic synchronously since we lack BullMQ
    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) return;

        const riskScore = supplier.riskScore ?? 0;
        const esgScore = supplier.esgScore ?? 0;
        const performanceScore = supplier.performanceScore ?? 0;
        const totalScore = Math.round((riskScore * 0.4) + (esgScore * 0.3) + (performanceScore * 0.3));

        await db
            .update(suppliers)
            .set({ riskScore: totalScore })
            .where(eq(suppliers.id, supplierId));

        console.log(`[Queue Mock] Score computed for ${supplierId}: ${totalScore}`);
    } catch (e) {
        console.error("[Queue Mock] Failed simulated score:", e);
    }
}

// Export empty/mock objects to avoid breaking imports
export const supplierScoreQueue = { add: () => { } };
export const supplierScoreScheduler = {};
export const supplierScoreWorker = {};

