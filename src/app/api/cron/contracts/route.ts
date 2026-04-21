import { NextResponse } from 'next/server';
import { db } from '@/db';
import { contracts, suppliers, users } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { createSystemNotification } from '@/app/actions/notifications';
import { isCronAuthorized } from '@/lib/api-security';
import { withPgAdvisoryLock } from '@/lib/db-locks';

const ALERT_WINDOWS = [30, 14, 7];

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const locked = await withPgAdvisoryLock('cron:contracts', async () => {
            const now = new Date();
            let totalAlerts = 0;

            for (const days of ALERT_WINDOWS) {
                const windowEnd = new Date();
                windowEnd.setDate(now.getDate() + days);

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

                const admins = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(eq(users.role, 'admin'));

                for (const contract of expiringContracts) {
                    const daysLeft = Math.ceil(
                        ((contract.validTo?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    const urgency = daysLeft <= 7 ? 'URGENT' : daysLeft <= 14 ? 'WARNING' : 'NOTICE';
                    const type = daysLeft <= 7 ? 'error' : daysLeft <= 14 ? 'warning' : 'info';

                    for (const admin of admins) {
                        await createSystemNotification({
                            userId: admin.id,
                            title: `${urgency} Contract Expiring in ${daysLeft} days`,
                            message: `"${contract.title}" with ${contract.supplierName || 'Unknown Supplier'} expires on ${contract.validTo?.toLocaleDateString()}. Value: ${contract.value}. Renewal: ${contract.renewalStatus || 'manual'}.`,
                            type: type as 'info' | 'warning' | 'error',
                            link: '/sourcing/contracts',
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
        });

        if (!locked.acquired) {
            return NextResponse.json({ success: true, skipped: true, reason: 'already_running' }, { status: 202 });
        }

        return locked.value;
    } catch (error) {
        console.error('[Contract Alerts] Cron failed:', error);
        return NextResponse.json(
            { error: 'Failed to process contract expiry alerts' },
            { status: 500 },
        );
    }
}
