import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dryRunSapImport, executeSapImport } from '@/app/actions/import';
import { fetchSapEntityData, mapSapRecordToAxiom, mappedRowsToCsv, type SapEntityType } from '@/lib/services/sap';

type SyncMode = 'dry-run' | 'commit';

type SessionUser = {
    role?: string | null;
};

type SapSyncBody = {
    entityType?: SapEntityType;
    mode?: SyncMode;
    source?: 'sample' | 'sap';
    csvText?: string;
    records?: Array<Record<string, unknown>>;
    entitySet?: string;
    params?: Record<string, string>;
};

function ensureAdmin(session: unknown) {
    if (!session || typeof session !== 'object') return false;
    const maybeUser = (session as { user?: SessionUser }).user;
    return !!maybeUser && maybeUser.role === 'admin';
}

export async function GET() {
    const session = await auth();
    if (!ensureAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const configured = Boolean(process.env.SAP_BASE_URL && (process.env.SAP_API_TOKEN || (process.env.SAP_USERNAME && process.env.SAP_PASSWORD)));

    return NextResponse.json({
        configured,
        baseUrlConfigured: Boolean(process.env.SAP_BASE_URL),
        authConfigured: Boolean(process.env.SAP_API_TOKEN || (process.env.SAP_USERNAME && process.env.SAP_PASSWORD)),
        message: configured
            ? 'SAP connector is configured. Use POST to sync sample or live SAP data.'
            : 'Configure SAP_BASE_URL with SAP_API_TOKEN (or SAP_USERNAME/SAP_PASSWORD).',
    });
}

export async function POST(req: Request) {
    const session = await auth();
    if (!ensureAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const body = (await req.json()) as SapSyncBody;
        const entityType = (body.entityType || 'suppliers') as SapEntityType;
        const mode = (body.mode || 'dry-run') as SyncMode;
        const source = (body.source || 'sample') as 'sample' | 'sap';

        if (!['suppliers', 'parts', 'invoices'].includes(entityType)) {
            return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
        }
        if (!['dry-run', 'commit'].includes(mode)) {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        let csvText = body.csvText as string | undefined;

        if (source === 'sap') {
            const entitySet = body.entitySet as string;
            if (!entitySet) {
                return NextResponse.json({ error: 'entitySet is required when source=sap' }, { status: 400 });
            }
            const sapRows = await fetchSapEntityData(entitySet, body.params || {});
            const mappedRows = sapRows.map((row: Record<string, unknown>) => mapSapRecordToAxiom(entityType, row));
            csvText = mappedRowsToCsv(mappedRows);
        } else if (!csvText && Array.isArray(body.records)) {
            const mappedRows = body.records.map((row: Record<string, unknown>) => mapSapRecordToAxiom(entityType, row));
            csvText = mappedRowsToCsv(mappedRows);
        }

        if (!csvText || csvText.trim().length === 0) {
            return NextResponse.json({ error: 'No input data provided. Send csvText or records[]' }, { status: 400 });
        }

        if (mode === 'dry-run') {
            const result = await dryRunSapImport(csvText, entityType);
            return NextResponse.json({ source, mode, entityType, ...result });
        }

        const result = await executeSapImport(csvText, entityType);
        return NextResponse.json({ source, mode, entityType, ...result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'SAP sync failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
