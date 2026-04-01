import { NextResponse } from 'next/server';
import { db } from '@/db';
import { webhookDeliveries, webhooks } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import crypto from 'crypto';

const MAX_ATTEMPTS = 5;

function isCronAuthorized(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const header = req.headers.get('x-cron-token');
    return bearer === secret || header === secret;
}

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();

        // Find pending deliveries that are due for retry
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

        // Also get retrying deliveries whose nextRetryAt has passed
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
                // Sign the payload with HMAC
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
                    signal: AbortSignal.timeout(10000), // 10s timeout
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
                    // Exponential backoff: 30s, 2min, 8min, 32min
                    const backoffMs = Math.pow(4, attempts - 1) * 30000;
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
    } catch (error) {
        console.error('[Webhooks] Delivery cron failed:', error);
        return NextResponse.json({ error: 'Webhook delivery failed' }, { status: 500 });
    }
}
