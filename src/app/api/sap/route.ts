import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dryRunSapImport, executeSapImport } from '@/app/actions/import';
import { fetchSapEntityData, mapSapRecordToAxiom, mappedRowsToCsv, testSapConnection, type SapEntityType } from '@/lib/services/sap';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall, readJsonBody } from '@/lib/api-security';

type SyncMode = 'dry-run' | 'commit';

type SessionUser = {
    role?: string | null;
};

type SapAction = 'sync' | 'test-connection' | 'schema';

type SapSyncBody = {
    action?: SapAction;
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

export async function GET(req: Request) {
    const session = await auth();
    if (!ensureAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const limited = await enforceRateLimit(req, 'read', (session as any).user?.id);
    if (limited) return limited;

    const baseUrl = process.env.SAP_BASE_URL;
    const hasAuth = Boolean(process.env.SAP_API_TOKEN || (process.env.SAP_USERNAME && process.env.SAP_PASSWORD));
    const configured = Boolean(baseUrl && hasAuth);

    return NextResponse.json({
        configured,
        baseUrlConfigured: Boolean(baseUrl),
        authConfigured: hasAuth,
        authMethod: process.env.SAP_API_TOKEN ? 'bearer_token' : (process.env.SAP_USERNAME ? 'basic_auth' : 'none'),
        supportedEntities: ['suppliers', 'parts', 'invoices'],
        endpoints: {
            sync: 'POST /api/sap { action: "sync", entityType, mode, source, ... }',
            testConnection: 'POST /api/sap { action: "test-connection" }',
            schema: 'POST /api/sap { action: "schema", entityType }',
        },
        message: configured
            ? 'SAP connector is configured. Use POST to sync, test connection, or view schema.'
            : 'Configure SAP_BASE_URL with SAP_API_TOKEN (or SAP_USERNAME/SAP_PASSWORD).',
    });
}

export async function POST(req: Request) {
    const blocked = enforceMutationFirewall(req);
    if (blocked) return blocked;

    const session = await auth();
    if (!ensureAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const limited = await enforceRateLimit(req, 'write', (session as any).user?.id);
    if (limited) return limited;

    try {
        const body = await readJsonBody<SapSyncBody>(req);
        const action = body.action || 'sync';

        // Action: test-connection — Verify SAP connectivity
        if (action === 'test-connection') {
            const result = await testSapConnection();
            return NextResponse.json(result, { status: result.connected ? 200 : 503 });
        }

        // Action: schema — Return field mapping for an entity type
        if (action === 'schema') {
            const entityType = (body.entityType || 'suppliers') as SapEntityType;
            if (!['suppliers', 'parts', 'invoices'].includes(entityType)) {
                return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
            }
            return NextResponse.json(getSapSchema(entityType));
        }

        // Action: sync (default) — Import data from SAP or sample
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
            if (!/^[\w\-.]+$/.test(entitySet)) {
                return NextResponse.json({ error: 'Invalid entitySet format' }, { status: 400 });
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
        const status = message.includes('request body') || message.includes('application/json') || message.includes('JSON')
            ? 400
            : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

/**
 * Returns the SAP → Axiom field mapping schema for a given entity type
 */
function getSapSchema(entityType: SapEntityType) {
    const schemas: Record<SapEntityType, { axiomField: string; sapFields: string[]; required: boolean }[]> = {
        suppliers: [
            { axiomField: 'name', sapFields: ['Name1', 'SupplierName', 'name'], required: true },
            { axiomField: 'contact_email', sapFields: ['EmailAddress', 'ContactEmail', 'email'], required: true },
            { axiomField: 'status', sapFields: ['Status', 'status'], required: false },
            { axiomField: 'country_code', sapFields: ['Country', 'CountryCode', 'country_code'], required: false },
            { axiomField: 'city', sapFields: ['City', 'city'], required: false },
            { axiomField: 'risk_score', sapFields: ['RiskScore', 'risk_score'], required: false },
            { axiomField: 'performance_score', sapFields: ['PerformanceScore', 'performance_score'], required: false },
            { axiomField: 'esg_score', sapFields: ['ESGScore', 'esg_score'], required: false },
            { axiomField: 'financial_score', sapFields: ['FinancialScore', 'financial_score'], required: false },
        ],
        parts: [
            { axiomField: 'sku', sapFields: ['Material', 'MaterialNumber', 'SKU', 'sku'], required: true },
            { axiomField: 'name', sapFields: ['MaterialDescription', 'Description', 'name'], required: true },
            { axiomField: 'category', sapFields: ['MaterialGroup', 'Category', 'category'], required: false },
            { axiomField: 'price', sapFields: ['NetPrice', 'Price', 'price'], required: false },
            { axiomField: 'stock_level', sapFields: ['AvailableStock', 'StockLevel', 'stock_level'], required: false },
            { axiomField: 'reorder_point', sapFields: ['ReorderPoint', 'reorder_point'], required: false },
            { axiomField: 'min_stock_level', sapFields: ['MinStockLevel', 'min_stock_level'], required: false },
            { axiomField: 'market_trend', sapFields: ['MarketTrend', 'market_trend'], required: false },
        ],
        invoices: [
            { axiomField: 'invoice_number', sapFields: ['InvoiceNumber', 'BELNR', 'invoice_number'], required: true },
            { axiomField: 'order_id', sapFields: ['OrderId', 'EBELN', 'order_id'], required: false },
            { axiomField: 'supplier_id', sapFields: ['SupplierId', 'LIFNR', 'supplier_id'], required: false },
            { axiomField: 'amount', sapFields: ['Amount', 'WRBTR', 'amount'], required: true },
            { axiomField: 'status', sapFields: ['Status', 'status'], required: false },
            { axiomField: 'currency', sapFields: ['Currency', 'WAERS', 'currency'], required: false },
            { axiomField: 'region', sapFields: ['Region', 'region'], required: false },
            { axiomField: 'country', sapFields: ['Country', 'country'], required: false },
            { axiomField: 'continent', sapFields: ['Continent', 'continent'], required: false },
        ],
    };

    return {
        entityType,
        fields: schemas[entityType],
        description: `Field mapping from SAP OData to Axiom ${entityType} schema. The first matching SAP field name is used.`,
    };
}
