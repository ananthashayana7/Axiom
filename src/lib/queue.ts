import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';

type SupplierScorePayload = { supplierId: string };

const QUEUE_NAME = 'supplier-score';
const globalForQueues = globalThis as typeof globalThis & {
    __axiomSupplierScoreQueue?: Promise<unknown>;
};

async function computeSupplierScore(supplierId: string) {
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
}

async function getQueue() {
    if (!process.env.REDIS_URL) return null;

    if (globalForQueues.__axiomSupplierScoreQueue) {
        return globalForQueues.__axiomSupplierScoreQueue as Promise<{
            add: (name: string, payload: SupplierScorePayload, options?: { jobId?: string }) => Promise<unknown>;
        }>;
    }

    const [{ Queue }, { default: IORedis }] = await Promise.all([
        import('bullmq'),
        import('ioredis'),
    ]);

    const connection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
    });

    globalForQueues.__axiomSupplierScoreQueue = Promise.resolve(new Queue<SupplierScorePayload>(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            attempts: 3,
            removeOnComplete: 1000,
            removeOnFail: 1000,
            backoff: { type: 'exponential', delay: 5000 },
        },
    }));

    return globalForQueues.__axiomSupplierScoreQueue as Promise<{
        add: (name: string, payload: SupplierScorePayload, options?: { jobId?: string }) => Promise<unknown>;
    }>;
}

export async function enqueueSupplierScore(supplierId: string) {
    if (!process.env.REDIS_URL) {
        // Development-safe fallback when Redis is unavailable.
        await computeSupplierScore(supplierId);
        return;
    }

    const queue = await getQueue();
    if (!queue) {
        await computeSupplierScore(supplierId);
        return;
    }

    await queue.add('compute-supplier-score', { supplierId }, {
        jobId: `supplier-score:${supplierId}`,
    });
}

export async function startSupplierScoreWorker() {
    if (!process.env.REDIS_URL) {
        console.warn('[Queue] REDIS_URL not configured. Worker not started.');
        return null;
    }

    const [{ Worker }, { default: IORedis }] = await Promise.all([
        import('bullmq'),
        import('ioredis'),
    ]);

    const connection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
    });

    const worker = new Worker<SupplierScorePayload>(
        QUEUE_NAME,
        async (job) => {
            await computeSupplierScore(job.data.supplierId);
        },
        { connection, concurrency: 5 }
    );

    worker.on('completed', (job) => {
        console.log(`[Queue] Job completed: ${job.id}`);
    });

    worker.on('failed', (job, error) => {
        console.error(`[Queue] Job failed: ${job?.id}`, error);
    });

    return worker;
}
