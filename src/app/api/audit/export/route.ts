import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { eq, desc, gte, lte, and, type SQL } from 'drizzle-orm';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { buildCsv } from '@/lib/csv';

const DAY_MS = 24 * 60 * 60 * 1000;

function positiveIntFromEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

const DEFAULT_EXPORT_WINDOW_DAYS = positiveIntFromEnv('AUDIT_EXPORT_DEFAULT_DAYS', 90);
const MAX_EXPORT_WINDOW_DAYS = positiveIntFromEnv('AUDIT_EXPORT_MAX_DAYS', 366);
const MAX_EXPORT_ROWS = positiveIntFromEnv('AUDIT_EXPORT_MAX_ROWS', 10_000);

function parseDateParam(name: string, value: string | null) {
    if (!value) return { date: null, response: null };

    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return {
            date: null,
            response: NextResponse.json({ error: `Invalid ${name} date` }, { status: 400 }),
        };
    }

    if (dateOnly && name === 'to') {
        date.setUTCHours(23, 59, 59, 999);
    }

    return { date, response: null };
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const limited = await enforceRateLimit(req, 'read', session.user.id);
        if (limited) return limited;

        const url = new URL(req.url);
        const dateFrom = url.searchParams.get('from');
        const dateTo = url.searchParams.get('to');

        const parsedFrom = parseDateParam('from', dateFrom);
        if (parsedFrom.response) return parsedFrom.response;

        const parsedTo = parseDateParam('to', dateTo);
        if (parsedTo.response) return parsedTo.response;

        const exportTo = parsedTo.date ?? new Date();
        const exportFrom = parsedFrom.date ?? new Date(exportTo.getTime() - DEFAULT_EXPORT_WINDOW_DAYS * DAY_MS);
        const exportWindowMs = exportTo.getTime() - exportFrom.getTime();

        if (exportWindowMs < 0) {
            return NextResponse.json({ error: 'from date must be before to date' }, { status: 400 });
        }

        if (exportWindowMs > MAX_EXPORT_WINDOW_DAYS * DAY_MS) {
            return NextResponse.json(
                { error: `Audit export range cannot exceed ${MAX_EXPORT_WINDOW_DAYS} days` },
                { status: 400 },
            );
        }

        const conditions: SQL[] = [
            gte(auditLogs.createdAt, exportFrom),
            lte(auditLogs.createdAt, exportTo),
        ];

        const exportedRows = await db
            .select({
                id: auditLogs.id,
                action: auditLogs.action,
                entityType: auditLogs.entityType,
                entityId: auditLogs.entityId,
                details: auditLogs.details,
                createdAt: auditLogs.createdAt,
                userName: users.name,
                userEmail: users.email,
                userRole: users.role,
            })
            .from(auditLogs)
            .leftJoin(users, eq(auditLogs.userId, users.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(auditLogs.createdAt))
            .limit(MAX_EXPORT_ROWS + 1);

        const truncated = exportedRows.length > MAX_EXPORT_ROWS;
        const rows = truncated ? exportedRows.slice(0, MAX_EXPORT_ROWS) : exportedRows;

        // Build CSV
        const headers = [
            'Timestamp',
            'User',
            'Email',
            'Role',
            'Action',
            'Entity Type',
            'Entity ID',
            'Details',
            'Compliance Status',
            'Evidence Ref',
            'Platform',
            'Export Date',
        ];

        const now = new Date();
        const exportDate = now.toISOString();

        const csvRows = rows.map((row) => {
            const timestamp = row.createdAt ? new Date(row.createdAt).toISOString() : '';
            const complianceStatus = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'BULK_APPROVE', 'BULK_REJECT', 'LINK', 'CONVERT']
                .includes(row.action) ? 'COMPLIANT' : 'REVIEW';

            return [
                timestamp,
                row.userName || 'System',
                row.userEmail || '',
                row.userRole || '',
                row.action,
                row.entityType,
                row.entityId,
                row.details,
                complianceStatus,
                `AX-${row.id.split('-')[0].toUpperCase()}`,
                'Axiom Platform',
                exportDate,
            ];
        });

        const csv = buildCsv([headers, ...csvRows]);

        const dateStr = now.toISOString().split('T')[0];
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="axiom-audit-export-${dateStr}.csv"`,
                'Cache-Control': 'no-cache',
                'X-Axiom-Export-From': exportFrom.toISOString(),
                'X-Axiom-Export-To': exportTo.toISOString(),
                'X-Axiom-Export-Row-Limit': MAX_EXPORT_ROWS.toString(),
                'X-Axiom-Export-Truncated': truncated ? 'true' : 'false',
            },
        });
    } catch (error) {
        console.error('[Audit Export] Failed:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
