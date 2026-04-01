import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { eq, desc, gte, lte, and } from 'drizzle-orm';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const url = new URL(req.url);
        const dateFrom = url.searchParams.get('from');
        const dateTo = url.searchParams.get('to');

        const conditions: any[] = [];
        if (dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
        if (dateTo) conditions.push(lte(auditLogs.createdAt, new Date(dateTo)));

        const rows = await db
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
            .orderBy(desc(auditLogs.createdAt));

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
                csvEscape(row.userName || 'System'),
                csvEscape(row.userEmail || ''),
                row.userRole || '',
                row.action,
                row.entityType,
                row.entityId,
                csvEscape(row.details),
                complianceStatus,
                `AX-${row.id.split('-')[0].toUpperCase()}`,
                'Axiom Platform',
                exportDate,
            ].join(',');
        });

        const csv = [headers.join(','), ...csvRows].join('\n');

        const dateStr = now.toISOString().split('T')[0];
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="axiom-audit-export-${dateStr}.csv"`,
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('[Audit Export] Failed:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}

function csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
