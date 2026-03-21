import { Buffer } from 'node:buffer';

export type SapEntityType = 'suppliers' | 'parts' | 'invoices';

export function mapSapRecordToAxiom(entityType: SapEntityType, record: Record<string, unknown>): Record<string, string> {
    const get = (...keys: string[]) => {
        for (const key of keys) {
            const value = record[key];
            if (value !== undefined && value !== null) return String(value).trim();
        }
        return '';
    };

    if (entityType === 'suppliers') {
        return {
            name: get('Name1', 'SupplierName', 'name'),
            contact_email: get('EmailAddress', 'ContactEmail', 'email'),
            status: get('Status', 'status') || 'active',
            country_code: get('Country', 'CountryCode', 'country_code'),
            city: get('City', 'city'),
            risk_score: get('RiskScore', 'risk_score') || '0',
            performance_score: get('PerformanceScore', 'performance_score') || '0',
            esg_score: get('ESGScore', 'esg_score') || '0',
            financial_score: get('FinancialScore', 'financial_score') || '0',
        };
    }

    if (entityType === 'parts') {
        return {
            sku: get('Material', 'MaterialNumber', 'SKU', 'sku'),
            name: get('MaterialDescription', 'Description', 'name'),
            category: get('MaterialGroup', 'Category', 'category') || 'General',
            price: get('NetPrice', 'Price', 'price') || '0',
            stock_level: get('AvailableStock', 'StockLevel', 'stock_level') || '0',
            reorder_point: get('ReorderPoint', 'reorder_point') || '50',
            min_stock_level: get('MinStockLevel', 'min_stock_level') || '20',
            market_trend: get('MarketTrend', 'market_trend') || 'stable',
        };
    }

    return {
        invoice_number: get('InvoiceNumber', 'BELNR', 'invoice_number'),
        order_id: get('OrderId', 'EBELN', 'order_id'),
        supplier_id: get('SupplierId', 'LIFNR', 'supplier_id'),
        amount: get('Amount', 'WRBTR', 'amount') || '0',
        status: get('Status', 'status') || 'pending',
        currency: get('Currency', 'WAERS', 'currency') || 'INR',
        region: get('Region', 'region'),
        country: get('Country', 'country'),
        continent: get('Continent', 'continent'),
    };
}

export function mappedRowsToCsv(rows: Record<string, string>[]) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
        const line = headers
            .map((header) => {
                const raw = (row[header] ?? '').toString();
                const escaped = raw.replace(/"/g, '""');
                // Prevent CSV formula injection: prefix with single quote if starts with =, +, -, or @
                const safe = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
                return `"${safe}"`;
            })
            .join(',');
        lines.push(line);
    }
    return lines.join('\n');
}

/**
 * Test SAP connectivity by sending a lightweight request to the configured base URL.
 * Returns connection status and latency.
 */
export async function testSapConnection(): Promise<{
    connected: boolean;
    latencyMs: number;
    baseUrl: string | null;
    authMethod: string;
    error?: string;
}> {
    const baseUrl = process.env.SAP_BASE_URL;
    if (!baseUrl) {
        return { connected: false, latencyMs: 0, baseUrl: null, authMethod: 'none', error: 'SAP_BASE_URL is not configured.' };
    }

    const token = process.env.SAP_API_TOKEN;
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;

    const authMethod = token ? 'bearer_token' : (username && password ? 'basic_auth' : 'none');

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    } else if (username && password) {
        const basic = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${basic}`;
    }

    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(baseUrl, {
            headers,
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;

        if (response.ok || response.status === 401 || response.status === 403) {
            // Even 401/403 means the server is reachable
            return {
                connected: response.ok,
                latencyMs,
                baseUrl,
                authMethod,
                error: response.ok ? undefined : `Server reachable but returned ${response.status} (${response.statusText}). Check credentials.`,
            };
        }

        return {
            connected: false,
            latencyMs,
            baseUrl,
            authMethod,
            error: `SAP server returned ${response.status}: ${response.statusText}`,
        };
    } catch (error) {
        return {
            connected: false,
            latencyMs: Date.now() - start,
            baseUrl,
            authMethod,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
}

export async function fetchSapEntityData(entitySet: string, params?: Record<string, string>) {
    const baseUrl = process.env.SAP_BASE_URL;
    if (!baseUrl) {
        throw new Error('SAP_BASE_URL is not configured.');
    }

    const url = new URL(entitySet.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value) url.searchParams.set(key, value);
        });
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    const token = process.env.SAP_API_TOKEN;
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    } else if (username && password) {
        const basic = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${basic}`;
    }

    const response = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`SAP request failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const json = await response.json();
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.value)) return json.value;
    if (Array.isArray(json?.d?.results)) return json.d.results;

    return [];
}
