import { NextResponse } from 'next/server';
import { db } from '@/db';
import { contracts, suppliers, users } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { createNotification } from '@/app/actions/notifications';

function isCronAuthorized(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const header = req.headers.get('x-cron-token');
    return bearer === secret || header === secret;
}

const ALERT_WINDOWS = [30, 14, 7]; // days before expiry

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        let totalAlerts = 0;

        for (const days of ALERT_WINDOWS) {
            const windowEnd = new Date();
            windowEnd.setDate(now.getDate() + days);

            // Find contracts expiring within this window that are still active
            const expiringContracts = await db
                .select({
                    id: contracts.id,
                    title: contracts.title,
                    supplierId: contracts.supplierId,
                    validTo: contracts.validTo,
                    value: contracts.value,
                    renewalStatus: contracts.renewalStatus,
                    supplierName: suppliers.name,
                })
                .from(contracts)
                .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
                .where(and(
                    eq(contracts.status, 'active'),
                    lte(contracts.validTo, windowEnd),
                    gte(contracts.validTo, now),
                ));

            if (expiringContracts.length === 0) continue;

            // Get all admin users to notify
            const admins = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.role, 'admin'));

            for (const contract of expiringContracts) {
                const daysLeft = Math.ceil(
                    ((contract.validTo?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24)
                );

                const urgency = daysLeft <= 7 ? '🔴 URGENT' : daysLeft <= 14 ? '🟡 WARNING' : '🔵 NOTICE';
                const type = daysLeft <= 7 ? 'error' : daysLeft <= 14 ? 'warning' : 'info';

                for (const admin of admins) {
                    await createNotification({
                        userId: admin.id,
                        title: `${urgency} Contract Expiring in ${daysLeft} days`,
                        message: `"${contract.title}" with ${contract.supplierName || 'Unknown Supplier'} expires on ${contract.validTo?.toLocaleDateString()}. Value: ${contract.value}. Renewal: ${contract.renewalStatus || 'manual'}.`,
                        type: type as 'info' | 'warning' | 'error',
                        link: `/sourcing/contracts`,
                    });
                    totalAlerts++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            alertsSent: totalAlerts,
            checkedWindows: ALERT_WINDOWS,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Contract Alerts] Cron failed:', error);
        return NextResponse.json(
            { error: 'Failed to process contract expiry alerts' },
            { status: 500 }
        );
    }
}
