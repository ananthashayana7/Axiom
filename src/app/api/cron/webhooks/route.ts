import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webhookDeliveries, webhooks } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { isCronAuthorized } from '@/lib/api-security';
import { withPgAdvisoryLock } from '@/lib/db-locks';

const MAX_ATTEMPTS = 5;

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const locked = await withPgAdvisoryLock('cron:webhooks', async () => {
            const now = new Date();

            const pendingDeliveries = await db
                .select({
                    delivery: webhookDeliveries,
                    webhook: webhooks,
                })
                .from(webhookDeliveries)
                .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
                .where(and(
                    eq(webhookDeliveries.status, 'pending'),
                ))
                .limit(50);

            const retryingDeliveries = await db
                .select({
                    delivery: webhookDeliveries,
                    webhook: webhooks,
                })
                .from(webhookDeliveries)
                .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
                .where(and(
                    eq(webhookDeliveries.status, 'retrying'),
                    lte(webhookDeliveries.nextRetryAt, now),
                ))
                .limit(50);

            const allDeliveries = [...pendingDeliveries, ...retryingDeliveries];

            let delivered = 0;
            let failed = 0;

            for (const { delivery, webhook } of allDeliveries) {
                const attempts = (delivery.attempts || 0) + 1;

                try {
                    const signature = crypto
                        .createHmac('sha256', webhook.secret)
                        .update(delivery.payload)
                        .digest('hex');

                    const response = await fetch(webhook.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Axiom-Signature': `sha256=${signature}`,
                            'X-Axiom-Event': delivery.event,
                            'X-Axiom-Delivery': delivery.id,
                            'User-Agent': 'Axiom-Webhooks/1.0',
                        },
                        body: delivery.payload,
                        signal: AbortSignal.timeout(10_000),
                    });

                    if (response.ok) {
                        await db.update(webhookDeliveries)
                            .set({
                                status: 'success',
                                statusCode: response.status,
                                response: (await response.text()).substring(0, 500),
                                attempts,
                            })
                            .where(eq(webhookDeliveries.id, delivery.id));
                        delivered++;
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                    if (attempts >= MAX_ATTEMPTS) {
                        await db.update(webhookDeliveries)
                            .set({
                                status: 'failed',
                                response: errorMsg,
                                attempts,
                            })
                            .where(eq(webhookDeliveries.id, delivery.id));
                        failed++;
                    } else {
                        const backoffMs = Math.pow(4, attempts - 1) * 30_000;
                        const nextRetry = new Date(now.getTime() + backoffMs);

                        await db.update(webhookDeliveries)
                            .set({
                                status: 'retrying',
                                response: errorMsg,
                                attempts,
                                nextRetryAt: nextRetry,
                            })
                            .where(eq(webhookDeliveries.id, delivery.id));
                    }
                }
            }

            return NextResponse.json({
                success: true,
                processed: allDeliveries.length,
                delivered,
                failed,
                timestamp: new Date().toISOString(),
            });
        });

        if (!locked.acquired) {
            return NextResponse.json({ success: true, skipped: true, reason: 'already_running' }, { status: 202 });
        }

        return locked.value;
    } catch (error) {
        console.error('[Webhooks] Delivery cron failed:', error);
        return NextResponse.json({ error: 'Webhook delivery failed' }, { status: 500 });
    }
}
