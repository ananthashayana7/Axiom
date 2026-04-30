'use server';

import { auth } from "@/auth";
import { db } from "@/db";
import { contracts, fraudAlerts, parts, procurementOrders, rfqs, suppliers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAllCountryCodes, getGeoLocale } from "@/lib/utils/geo-currency";

export type SearchResult = {
    id: string;
    type: 'supplier' | 'rfq' | 'order' | 'part' | 'contract' | 'alert';
    title: string;
    subtitle?: string;
    href: string;
};

type SupplierIntent = {
    countryCode?: string;
    minRisk?: number;
    maxRisk?: number;
    minEsg?: number;
    supplierTerms: string[];
};

type PartIntent = {
    stockMode?: 'critical' | 'low';
    trend?: 'volatile' | 'up' | 'down';
    categoryTerms: string[];
};

const STOP_WORDS = new Set([
    'a', 'all', 'and', 'by', 'for', 'from', 'high', 'in', 'is', 'low', 'of', 'parts', 'suppliers', 'the', 'to', 'with',
]);

const COUNTRY_TERMS = getAllCountryCodes().map((code) => {
    const locale = getGeoLocale(code);
    return {
        code,
        name: locale.countryName.toLowerCase(),
    };
});

function normalize(input: string) {
    return input.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(input: string) {
    return normalize(input)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean);
}

function extractCountryCode(query: string) {
    const normalized = normalize(query);
    const found = COUNTRY_TERMS.find((entry) =>
        normalized.includes(entry.name) || normalized.split(' ').includes(entry.code.toLowerCase())
    );

    return found?.code;
}

function parseSupplierIntent(query: string): SupplierIntent {
    const normalized = normalize(query);
    const tokens = tokenize(query);

    return {
        countryCode: extractCountryCode(query),
        minRisk: normalized.includes('high risk') || normalized.includes('critical risk') ? 60 : undefined,
        maxRisk: normalized.includes('low risk') ? 35 : undefined,
        minEsg: normalized.includes('green') || normalized.includes('esg') || normalized.includes('lowest carbon') ? 65 : undefined,
        supplierTerms: tokens.filter((token) => !STOP_WORDS.has(token) && token.length > 2),
    };
}

function parsePartIntent(query: string): PartIntent {
    const normalized = normalize(query);
    const tokens = tokenize(query);

    return {
        stockMode: normalized.includes('critical') ? 'critical' : normalized.includes('low stock') || normalized.includes('reorder') ? 'low' : undefined,
        trend: normalized.includes('volatile') ? 'volatile' : normalized.includes('rising') ? 'up' : normalized.includes('falling') ? 'down' : undefined,
        categoryTerms: tokens.filter((token) => !STOP_WORDS.has(token) && token.length > 2),
    };
}

function scoreSupplierMatch(
    supplier: typeof suppliers.$inferSelect,
    intent: SupplierIntent,
    query: string
) {
    if (intent.countryCode && supplier.countryCode !== intent.countryCode) return null;
    if (typeof intent.minRisk === 'number' && (supplier.riskScore || 0) < intent.minRisk) return null;
    if (typeof intent.maxRisk === 'number' && (supplier.riskScore || 0) > intent.maxRisk) return null;
    if (typeof intent.minEsg === 'number' && (supplier.esgScore || 0) < intent.minEsg) return null;

    const haystack = normalize([
        supplier.name,
        supplier.contactEmail,
        supplier.city,
        supplier.countryCode,
        ...(supplier.categories || []),
        ...(supplier.isoCertifications || []),
    ].filter(Boolean).join(' '));
    const queryText = normalize(query);
    let score = 0;

    if (haystack.includes(queryText)) score += 6;
    if (intent.countryCode && supplier.countryCode === intent.countryCode) score += 5;
    if ((supplier.riskScore || 0) >= 60 && intent.minRisk) score += 4;
    if ((supplier.esgScore || 0) >= 70 && intent.minEsg) score += 3;

    for (const term of intent.supplierTerms) {
        if (haystack.includes(term)) score += 2;
    }

    return score > 0 ? score : null;
}

function scorePartMatch(part: typeof parts.$inferSelect, intent: PartIntent, query: string) {
    const isCritical = part.stockLevel <= (part.minStockLevel || 20);
    const isLow = !isCritical && part.stockLevel <= (part.reorderPoint || 50);

    if (intent.stockMode === 'critical' && !isCritical) return null;
    if (intent.stockMode === 'low' && !(isCritical || isLow)) return null;
    if (intent.trend && String(part.marketTrend || 'stable').toLowerCase() !== intent.trend) return null;

    const haystack = normalize([part.name, part.sku, part.category, part.description].filter(Boolean).join(' '));
    const queryText = normalize(query);
    let score = 0;

    if (haystack.includes(queryText)) score += 6;
    if (intent.stockMode === 'critical' && isCritical) score += 5;
    if (intent.stockMode === 'low' && (isCritical || isLow)) score += 4;
    if (intent.trend && String(part.marketTrend || 'stable').toLowerCase() === intent.trend) score += 3;

    for (const term of intent.categoryTerms) {
        if (haystack.includes(term)) score += 2;
    }

    return score > 0 ? score : null;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const session = await auth();
    if (!session?.user) return [];

    const role = session.user.role;
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) return [];

    const supplierIntent = parseSupplierIntent(trimmedQuery);
    const partIntent = parsePartIntent(trimmedQuery);
    const results: SearchResult[] = [];

    try {
        if (role !== 'supplier') {
            const supplierRows = await db.select().from(suppliers).orderBy(desc(suppliers.createdAt)).limit(120);
            const matchedSuppliers = supplierRows
                .map((supplier) => ({
                    supplier,
                    score: scoreSupplierMatch(supplier, supplierIntent, trimmedQuery),
                }))
                .filter((entry): entry is { supplier: typeof suppliers.$inferSelect; score: number } => entry.score !== null)
                .sort((left, right) => right.score - left.score)
                .slice(0, 5);

            matchedSuppliers.forEach(({ supplier }) => {
                const countryName = supplier.countryCode ? getGeoLocale(supplier.countryCode).countryName : 'Unmapped region';
                results.push({
                    id: supplier.id,
                    type: 'supplier',
                    title: supplier.name,
                    subtitle: `${countryName} / Risk ${supplier.riskScore || 0} / ESG ${supplier.esgScore || 0}`,
                    href: `/suppliers?supplier=${supplier.id}`,
                });
            });
        }

        if (role !== 'supplier') {
            const partRows = await db.select().from(parts).orderBy(desc(parts.createdAt)).limit(150);
            const matchedParts = partRows
                .map((part) => ({
                    part,
                    score: scorePartMatch(part, partIntent, trimmedQuery),
                }))
                .filter((entry): entry is { part: typeof parts.$inferSelect; score: number } => entry.score !== null)
                .sort((left, right) => right.score - left.score)
                .slice(0, 5);

            matchedParts.forEach(({ part }) => {
                const critical = part.stockLevel <= (part.minStockLevel || 20);
                const low = !critical && part.stockLevel <= (part.reorderPoint || 50);
                results.push({
                    id: part.id,
                    type: 'part',
                    title: part.name,
                    subtitle: `${part.category} / SKU ${part.sku} / ${critical ? 'Critical' : low ? 'Low stock' : 'Available'}`,
                    href: `/sourcing/parts?part=${part.id}`,
                });
            });
        }

        const rfqRows = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(60);
        rfqRows
            .filter((rfq) => normalize([rfq.title, rfq.description, rfq.category].filter(Boolean).join(' ')).includes(normalize(trimmedQuery)))
            .slice(0, 4)
            .forEach((rfq) => {
                results.push({
                    id: rfq.id,
                    type: 'rfq',
                    title: rfq.title,
                    subtitle: `RFQ / ${rfq.status}`,
                    href: role === 'supplier' ? `/portal/rfqs/${rfq.id}` : `/sourcing/rfqs/${rfq.id}`,
                });
            });

        const orderRows = await db.select().from(procurementOrders).orderBy(desc(procurementOrders.createdAt)).limit(60);
        orderRows
            .filter((order) => normalize([order.id, order.status, order.carrier, order.trackingNumber].filter(Boolean).join(' ')).includes(normalize(trimmedQuery)))
            .slice(0, 4)
            .forEach((order) => {
                results.push({
                    id: order.id,
                    type: 'order',
                    title: `Order ${order.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
                    subtitle: `Procurement Order / ${order.status}`,
                    href: role === 'supplier' ? `/portal/orders/${order.id}` : `/sourcing/orders/${order.id}`,
                });
            });

        if (role !== 'supplier') {
            const contractRows = await db.select({
                id: contracts.id,
                title: contracts.title,
                status: contracts.status,
                type: contracts.type,
                supplierName: suppliers.name,
            })
                .from(contracts)
                .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
                .orderBy(desc(contracts.createdAt))
                .limit(60);

            contractRows
                .filter((contract) => normalize([
                    contract.title,
                    contract.status,
                    contract.type,
                    contract.supplierName,
                ].filter(Boolean).join(' ')).includes(normalize(trimmedQuery)))
                .slice(0, 4)
                .forEach((contract) => {
                    results.push({
                        id: contract.id,
                        type: 'contract',
                        title: contract.title,
                        subtitle: `${contract.supplierName || 'Unassigned supplier'} / ${contract.status} / ${(contract.type || 'contract').replace('_', ' ')}`,
                        href: `/sourcing/contracts?contract=${contract.id}`,
                    });
                });
        }

        if (role === 'admin') {
            const alertRows = await db.select({
                id: fraudAlerts.id,
                alertType: fraudAlerts.alertType,
                description: fraudAlerts.description,
                severity: fraudAlerts.severity,
                entityType: fraudAlerts.entityType,
            }).from(fraudAlerts)
                .orderBy(desc(fraudAlerts.createdAt))
                .limit(40);

            alertRows
                .filter((alert) => normalize([
                    alert.alertType,
                    alert.description,
                    alert.severity,
                    alert.entityType,
                ].filter(Boolean).join(' ')).includes(normalize(trimmedQuery)))
                .slice(0, 3)
                .forEach((alert) => {
                    results.push({
                        id: alert.id,
                        type: 'alert',
                        title: `Fraud alert: ${alert.alertType.replace(/_/g, ' ')}`,
                        subtitle: `${alert.severity} severity / ${alert.entityType}`,
                        href: `/admin/fraud-alerts?id=${alert.id}`,
                    });
                });
        }

        return results.slice(0, 10);
    } catch (error) {
        console.error("Global search error:", error);
        return [];
    }
}
