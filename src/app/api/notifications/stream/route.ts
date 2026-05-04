import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { enforceRateLimit } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const limited = await enforceRateLimit(req, 'read', session.user.id);
    if (limited) return limited;

    const userId = session.user.id;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Send initial heartbeat
            controller.enqueue(encoder.encode(': heartbeat\n\n'));

            let lastCheck = new Date();
            let isActive = true;
            let pollTimer: ReturnType<typeof setTimeout> | null = null;

            const poll = async () => {
                if (!isActive) return;

                try {
                    // Fetch new unread notifications since last check
                    const newNotifs = await db
                        .select()
                        .from(notifications)
                        .where(and(
                            eq(notifications.userId, userId),
                            eq(notifications.isRead, 'no'),
                            gt(notifications.createdAt, lastCheck),
                        ))
                        .orderBy(desc(notifications.createdAt))
                        .limit(10);

                    for (const notif of newNotifs) {
                        const data = JSON.stringify({
                            id: notif.id,
                            title: notif.title,
                            message: notif.message,
                            type: notif.type,
                            link: notif.link,
                            createdAt: notif.createdAt,
                        });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }

                    if (newNotifs.length > 0) {
                        lastCheck = new Date();
                    }

                    // Send heartbeat to keep connection alive
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (error) {
                    console.error('[SSE] Poll error:', error);
                }

                // Schedule next poll only if still active
                if (isActive) {
                    pollTimer = setTimeout(poll, 5000);
                }
            };

            // Start polling after initial delay
            pollTimer = setTimeout(poll, 5000);

            // Handle client disconnect — clear timer FIRST to prevent any further DB queries
            req.signal.addEventListener('abort', () => {
                isActive = false;
                if (pollTimer !== null) {
                    clearTimeout(pollTimer);
                    pollTimer = null;
                }
                try { controller.close(); } catch { /* already closed */ }
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
