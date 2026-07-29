import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

type SupplierScorePayload = { supplierId: string };

const QUEUE_NAME = 'supplier-score';

// We cache the Queue *instance* (not a Promise) so we never leak connections
// across Next.js hot-reloads in dev or across multiple imports in the same process.
const globalForQueues = globalThis as typeof globalThis & {
    __axiomSupplierScoreQueue?: import('bullmq').Queue<SupplierScorePayload>;
    __axiomSupplierScoreQueueConnection?: import('ioredis').default;
};

/**
 * Computes a composite supplier health score from the three independent
 * input dimensions (risk, ESG, performance) and stores it WITHOUT
 * overwriting any of the source fields.
 *
 * Composite formula: 40% risk + 30% ESG + 30% performance
 *
 * NOTE: Until a dedicated `composite_score` column is added via a DB
 * migration, this score is stored in `collaboration_score` as a safe
 * temporary home (integer, 0–100, not used by any other formula).
 * Run the migration below before promoting to production:
 *
 *   ALTER TABLE suppliers ADD COLUMN composite_score integer DEFAULT 0;
 */
async function computeSupplierScore(supplierId: string) {
    const [supplier] = await db
        .select({
            riskScore: suppliers.riskScore,
            esgScore: suppliers.esgScore,
            performanceScore: suppliers.performanceScore,
        })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

    if (!supplier) return;

    // Use only the *source* values — never re-read a previously computed score
    const riskScore = supplier.riskScore ?? 0;
    const esgScore = supplier.esgScore ?? 0;
    const performanceScore = supplier.performanceScore ?? 0;

    const compositeScore = Math.min(
        100,
        Math.round((riskScore * 0.4) + (esgScore * 0.3) + (performanceScore * 0.3))
    );

    // Wrap inside a transaction so pg_advisory_xact_lock is held for the
    // entire duration of the UPDATE (it is a transaction-level lock and must
    // be acquired inside the same transaction that does the write).
    await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${supplierId}))`);

        // Write ONLY to the composite target field — never touch riskScore, esgScore, or performanceScore
        await tx
            .update(suppliers)
            .set({
                // Temporary: stored in collaboration_score until composite_score column is added
                collaborationScore: compositeScore,
                lastRiskAudit: sql`now()`,
            })
            .where(eq(suppliers.id, supplierId));
    });
}

function createRedisConnection(redisUrl: string): import('ioredis').default {
    // Dynamically imported — IORedis is a heavy module; we don't want it in the
    // webpack bundle unless Redis is actually configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require('ioredis').default ?? require('ioredis');
    const connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    connection.on('error', (err: Error) => {
        console.error('[Queue] Redis connection error:', err.message);
    });

    return connection;
}

async function getQueue(): Promise<import('bullmq').Queue<SupplierScorePayload> | null> {
    if (!process.env.REDIS_URL) return null;

    // Return cached Queue instance if it exists (avoids re-creating connections on hot-reload)
    if (globalForQueues.__axiomSupplierScoreQueue) {
        return globalForQueues.__axiomSupplierScoreQueue;
    }

    const { Queue } = await import('bullmq');
    const connection = createRedisConnection(process.env.REDIS_URL);
    globalForQueues.__axiomSupplierScoreQueueConnection = connection;

    const queue = new Queue<SupplierScorePayload>(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            attempts: 3,
            removeOnComplete: 1000,
            removeOnFail: 1000,
            backoff: { type: 'exponential', delay: 5000 },
        },
    });

    globalForQueues.__axiomSupplierScoreQueue = queue;
    return queue;
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

    try {
        await queue.add('compute-supplier-score', { supplierId }, {
            jobId: `supplier-score:${supplierId}`,
        });
    } catch (error) {
        console.error('[Queue] Failed to enqueue job, falling back to sync execution:', error);
        await computeSupplierScore(supplierId);
    }
}

export async function startSupplierScoreWorker() {
    if (!process.env.REDIS_URL) {
        console.warn('[Queue] REDIS_URL not configured. Worker not started.');
        return null;
    }

    const { Worker } = await import('bullmq');

    // Each worker process gets its own dedicated connection.
    // Error handler prevents unhandled rejection crashes on transient Redis failures.
    const connection = createRedisConnection(process.env.REDIS_URL);

    const worker = new Worker<SupplierScorePayload>(
        QUEUE_NAME,
        async (job) => {
            await computeSupplierScore(job.data.supplierId);
        },
        {
            connection,
            concurrency: 5,
            // Automatically stall-check every 30 s so stuck jobs don't block the queue
            stalledInterval: 30_000,
        }
    );

    worker.on('completed', (job) => {
        console.log(`[Queue] Job completed: ${job.id}`);
    });

    worker.on('failed', (job, error) => {
        console.error(`[Queue] Job failed: ${job?.id}`, error.message);
    });

    worker.on('error', (error) => {
        // BullMQ emits this for connection-level errors; log but don't crash.
        console.error('[Queue] Worker error:', error.message);
    });

    return worker;
}
