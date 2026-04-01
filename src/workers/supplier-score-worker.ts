import { startSupplierScoreWorker } from '@/lib/queue';

async function main() {
    const worker = await startSupplierScoreWorker();
    if (!worker) {
        process.exit(0);
    }

    console.log('[Queue] Supplier score worker started');

    const shutdown = async () => {
        console.log('[Queue] Shutting down supplier score worker');
        await worker.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((error) => {
    console.error('[Queue] Worker bootstrap failed', error);
    process.exit(1);
});
