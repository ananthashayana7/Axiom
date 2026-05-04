'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { auth } from '@/auth';
import { db } from '@/db';
import { invoices, parts, procurementOrders, suppliers, importJobs } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { triggerAgentBundle } from './agents';

type EntityType = 'suppliers' | 'parts' | 'invoices';

type ImportIssue = {
    row: number;
    message: string;
};

type DryRunResult = {
    success: boolean;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    issues: ImportIssue[];
    preview: Record<string, string>[];
};

const MAX_IMPORT_ROWS = 5000;
const MAX_IMPORT_CHARACTERS = 2_000_000;
const MAX_CELL_LENGTH = 512;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ISO_CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

function normalizeHeader(header: string) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeCell(value: string) {
    return value.replace(/\u0000/g, '').trim();
}

/**
 * Checks that the CSV headers contain all required fields for a given entity type.
 * Required fields may be satisfied by any of their accepted aliases.
 * Returns an array of ImportIssue for any missing required fields.
 */
function checkRequiredHeaders(headers: string[], entityType: EntityType): ImportIssue[] {
    const requiredGroups: Record<EntityType, { field: string; aliases: string[] }[]> = {
        suppliers: [
            { field: 'name', aliases: ['name', 'supplier_name'] },
            { field: 'contact_email', aliases: ['contact_email', 'email'] },
        ],
        parts: [
            { field: 'sku', aliases: ['sku', 'material', 'material_number'] },
            { field: 'name', aliases: ['name', 'part_name', 'description'] },
        ],
        invoices: [
            { field: 'invoice_number', aliases: ['invoice_number', 'invoice'] },
            { field: 'order_id', aliases: ['order_id'] },
            { field: 'supplier_id', aliases: ['supplier_id'] },
            { field: 'amount', aliases: ['amount', 'invoice_amount'] },
        ],
    };

    const issues: ImportIssue[] = [];
    for (const group of requiredGroups[entityType]) {
        const found = group.aliases.some(alias => headers.includes(alias));
        if (!found) {
            issues.push({
                row: 1,
                message: `Missing required column: "${group.field}". Accepted header names: ${group.aliases.map(a => `"${a}"`).join(', ')}.`,
            });
        }
    }
    return issues;
}

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    values.push(current.trim());
    return values;
}

function parseCsv(csvText: string) {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length < 2) {
        return { headers: [], rows: [] as Record<string, string>[] };
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);

    const rows = lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const row: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = normalizeCell(cols[i] ?? '');
        }
        return row;
    });

    return { headers, rows };
}

function parseNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasPotentialFormulaPrefix(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^[=+@]/.test(trimmed)) return true;
    if (/^-/.test(trimmed) && !/^-?\d+(\.\d+)?$/.test(trimmed)) return true;
    return false;
}

function validateScoreRange(field: string, value: number | null, rowIndex: number, issues: ImportIssue[]) {
    if (value === null) return;
    if (value < 0 || value > 100) {
        issues.push({ row: rowIndex, message: `${field} must be between 0 and 100.` });
    }
}

function validateNonNegative(field: string, value: number | null, rowIndex: number, issues: ImportIssue[]) {
    if (value === null) return;
    if (value < 0) {
        issues.push({ row: rowIndex, message: `${field} cannot be negative.` });
    }
}

function validateImportEnvelope(csvText: string, headers: string[], rows: Record<string, string>[]) {
    const issues: ImportIssue[] = [];

    if (csvText.length > MAX_IMPORT_CHARACTERS) {
        issues.push({
            row: 0,
            message: `CSV exceeds the ${MAX_IMPORT_CHARACTERS.toLocaleString('en-US')} character safety limit.`,
        });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
        issues.push({
            row: 0,
            message: `CSV exceeds the ${MAX_IMPORT_ROWS.toLocaleString('en-US')} row limit for controlled imports.`,
        });
    }

    const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
    if (duplicateHeaders.length > 0) {
        issues.push({
            row: 1,
            message: `Duplicate column names detected: ${Array.from(new Set(duplicateHeaders)).join(', ')}.`,
        });
    }

    return issues;
}

function inspectRowPayload(row: Record<string, string>, rowIndex: number, issues: ImportIssue[]) {
    for (const [field, value] of Object.entries(row)) {
        if (!value) continue;

        if (value.length > MAX_CELL_LENGTH) {
            issues.push({
                row: rowIndex,
                message: `Value in "${field}" exceeds ${MAX_CELL_LENGTH} characters.`,
            });
        }

        if (CONTROL_CHAR_PATTERN.test(value)) {
            issues.push({
                row: rowIndex,
                message: `Value in "${field}" contains unsupported control characters.`,
            });
        }

        if (hasPotentialFormulaPrefix(value)) {
            issues.push({
                row: rowIndex,
                message: `Potential spreadsheet formula detected in "${field}". Remove leading formula prefixes before import.`,
            });
        }
    }
}

function validateSupplierRow(row: Record<string, string>, rowIndex: number, issues: ImportIssue[]) {
    const name = row.name || row.supplier_name;
    const contactEmail = row.contact_email || row.email;
    const riskScore = parseNumber(row.risk_score || '0') ?? 0;
    const performanceScore = parseNumber(row.performance_score || '0') ?? 0;
    const esgScore = parseNumber(row.esg_score || '0') ?? 0;
    const financialScore = parseNumber(row.financial_score || '0') ?? 0;

    if (!name) issues.push({ row: rowIndex, message: 'Missing supplier name.' });
    if (!contactEmail) issues.push({ row: rowIndex, message: 'Missing contact email.' });

    const status = (row.status || 'active').toLowerCase();
    if (!['active', 'inactive', 'blacklisted'].includes(status)) {
        issues.push({ row: rowIndex, message: 'Invalid supplier status. Use active/inactive/blacklisted.' });
    }

    validateScoreRange('Risk score', riskScore, rowIndex, issues);
    validateScoreRange('Performance score', performanceScore, rowIndex, issues);
    validateScoreRange('ESG score', esgScore, rowIndex, issues);
    validateScoreRange('Financial score', financialScore, rowIndex, issues);

    return {
        name,
        contactEmail,
        status,
        city: row.city || null,
        countryCode: row.country_code || row.country || null,
        riskScore,
        performanceScore,
        esgScore,
        financialScore,
    };
}

function validatePartRow(row: Record<string, string>, rowIndex: number, issues: ImportIssue[]) {
    const sku = row.sku || row.material || row.material_number;
    const name = row.name || row.part_name || row.description;
    const category = row.category || row.material_group || 'General';
    const price = parseNumber(row.price || row.unit_price || '0');
    const stockLevel = parseNumber(row.stock_level || row.stock || '0') ?? 0;
    const reorderPoint = parseNumber(row.reorder_point || '50') ?? 50;
    const minStockLevel = parseNumber(row.min_stock_level || '20') ?? 20;

    if (!sku) issues.push({ row: rowIndex, message: 'Missing SKU/material number.' });
    if (!name) issues.push({ row: rowIndex, message: 'Missing part name/description.' });

    if (price === null) issues.push({ row: rowIndex, message: 'Invalid part price.' });
    validateNonNegative('Part price', price, rowIndex, issues);
    validateNonNegative('Stock level', stockLevel, rowIndex, issues);
    validateNonNegative('Reorder point', reorderPoint, rowIndex, issues);
    validateNonNegative('Minimum stock level', minStockLevel, rowIndex, issues);

    return {
        sku,
        name,
        category,
        price: (price ?? 0).toString(),
        stockLevel,
        marketTrend: row.market_trend || 'stable',
        reorderPoint,
        minStockLevel,
    };
}

function validateInvoiceRow(row: Record<string, string>, rowIndex: number, issues: ImportIssue[]) {
    const invoiceNumber = row.invoice_number || row.invoice;
    const orderId = row.order_id;
    const supplierId = row.supplier_id;
    const amount = parseNumber(row.amount || row.invoice_amount || '');
    const status = (row.status || 'pending').toLowerCase();
    const currency = (row.currency || 'INR').trim().toUpperCase();

    if (!invoiceNumber) issues.push({ row: rowIndex, message: 'Missing invoice number.' });
    if (!orderId) issues.push({ row: rowIndex, message: 'Missing order_id.' });
    if (!supplierId) issues.push({ row: rowIndex, message: 'Missing supplier_id.' });
    if (amount === null) issues.push({ row: rowIndex, message: 'Invalid invoice amount.' });
    if (amount !== null && amount <= 0) issues.push({ row: rowIndex, message: 'Invoice amount must be greater than 0.' });
    if (!['pending', 'matched', 'disputed', 'paid'].includes(status)) {
        issues.push({ row: rowIndex, message: 'Invalid invoice status. Use pending/matched/disputed/paid.' });
    }
    if (!ISO_CURRENCY_CODE_PATTERN.test(currency)) {
        issues.push({ row: rowIndex, message: 'Currency must be a valid 3-letter ISO code.' });
    }

    return {
        invoiceNumber,
        orderId,
        supplierId,
        amount: (amount ?? 0).toString(),
        status,
        currency,
        region: row.region || null,
        country: row.country || null,
        continent: row.continent || null,
    };
}

async function requireAdmin() {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
        throw new Error('Unauthorized');
    }
}

export async function dryRunSapImport(csvText: string, entityType: EntityType): Promise<DryRunResult> {
    await requireAdmin();

    const { headers, rows } = parseCsv(csvText);
    const issues: ImportIssue[] = [];
    const envelopeIssues = validateImportEnvelope(csvText, headers, rows);

    if (!rows.length) {
        return {
            success: false,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            issues: [{ row: 0, message: 'CSV has no data rows.' }],
            preview: [],
        };
    }

    if (envelopeIssues.length > 0) {
        return {
            success: false,
            totalRows: rows.length,
            validRows: 0,
            invalidRows: rows.length,
            issues: envelopeIssues,
            preview: rows.slice(0, 10),
        };
    }

    // Validate required headers before running row-level validation
    const headerIssues = checkRequiredHeaders(headers, entityType);
    if (headerIssues.length > 0) {
        return {
            success: false,
            totalRows: rows.length,
            validRows: 0,
            invalidRows: rows.length,
            issues: headerIssues,
            preview: rows.slice(0, 10),
        };
    }

    for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2;
        inspectRowPayload(rows[i], rowNumber, issues);
        if (entityType === 'suppliers') validateSupplierRow(rows[i], rowNumber, issues);
        if (entityType === 'parts') validatePartRow(rows[i], rowNumber, issues);
        if (entityType === 'invoices') validateInvoiceRow(rows[i], rowNumber, issues);
    }

    const invalidRowsSet = new Set(issues.map((issue) => issue.row));

    return {
        success: true,
        totalRows: rows.length,
        validRows: rows.length - invalidRowsSet.size,
        invalidRows: invalidRowsSet.size,
        issues: issues.slice(0, 50),
        preview: rows.slice(0, 10),
    };
}

export async function executeSapImport(csvText: string, entityType: EntityType) {
    await requireAdmin();

    const { headers, rows } = parseCsv(csvText);
    const issues: ImportIssue[] = [];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (!rows.length) {
        return { success: false, message: 'CSV has no data rows.', inserted, updated, skipped };
    }

    const envelopeIssues = validateImportEnvelope(csvText, headers, rows);
    if (envelopeIssues.length > 0) {
        return {
            success: false,
            message: envelopeIssues.map((issue) => issue.message).join(' '),
            inserted,
            updated,
            skipped,
        };
    }

    // Validate headers before attempting any DB writes
    const headerIssues = checkRequiredHeaders(headers, entityType);
    if (headerIssues.length > 0) {
        return {
            success: false,
            message: headerIssues.map(i => i.message).join(' '),
            inserted,
            updated,
            skipped,
        };
    }

    if (entityType === 'suppliers') {
        for (let i = 0; i < rows.length; i++) {
            const rowNumber = i + 2;
            inspectRowPayload(rows[i], rowNumber, issues);
            const normalized = validateSupplierRow(rows[i], rowNumber, issues);
            if (issues.some((issue) => issue.row === rowNumber)) {
                skipped++;
                continue;
            }

            const [existing] = await db.select({ id: suppliers.id })
                .from(suppliers)
                .where(eq(suppliers.contactEmail, normalized.contactEmail))
                .limit(1);

            if (existing) {
                const supplierStatus = (['active', 'inactive', 'under_review'] as const).includes(normalized.status as any) ? normalized.status : 'active';
                await db.update(suppliers)
                    .set({
                        name: normalized.name,
                        status: supplierStatus,
                        city: normalized.city,
                        countryCode: normalized.countryCode,
                        riskScore: normalized.riskScore,
                        performanceScore: normalized.performanceScore,
                        esgScore: normalized.esgScore,
                        financialScore: normalized.financialScore,
                    })
                    .where(eq(suppliers.id, existing.id));
                updated++;
            } else {
                const supplierStatus = (['active', 'inactive', 'under_review'] as const).includes(normalized.status as any) ? normalized.status : 'active';
                await db.insert(suppliers).values({
                    name: normalized.name,
                    contactEmail: normalized.contactEmail,
                    status: supplierStatus,
                    city: normalized.city,
                    countryCode: normalized.countryCode,
                    riskScore: normalized.riskScore,
                    performanceScore: normalized.performanceScore,
                    esgScore: normalized.esgScore,
                    financialScore: normalized.financialScore,
                });
                inserted++;
            }
        }
    }

    if (entityType === 'parts') {
        for (let i = 0; i < rows.length; i++) {
            const rowNumber = i + 2;
            inspectRowPayload(rows[i], rowNumber, issues);
            const normalized = validatePartRow(rows[i], rowNumber, issues);
            if (issues.some((issue) => issue.row === rowNumber)) {
                skipped++;
                continue;
            }

            const [existing] = await db.select({ id: parts.id })
                .from(parts)
                .where(eq(parts.sku, normalized.sku))
                .limit(1);

            if (existing) {
                await db.update(parts)
                    .set({
                        name: normalized.name,
                        category: normalized.category,
                        price: normalized.price,
                        stockLevel: normalized.stockLevel,
                        marketTrend: normalized.marketTrend,
                        reorderPoint: normalized.reorderPoint,
                        minStockLevel: normalized.minStockLevel,
                    })
                    .where(eq(parts.id, existing.id));
                updated++;
            } else {
                await db.insert(parts).values(normalized);
                inserted++;
            }
        }
    }

    if (entityType === 'invoices') {
        for (let i = 0; i < rows.length; i++) {
            const rowNumber = i + 2;
            inspectRowPayload(rows[i], rowNumber, issues);
            const normalized = validateInvoiceRow(rows[i], rowNumber, issues);
            if (issues.some((issue) => issue.row === rowNumber)) {
                skipped++;
                continue;
            }

            const [orderExists] = await db.select({ id: procurementOrders.id })
                .from(procurementOrders)
                .where(eq(procurementOrders.id, normalized.orderId))
                .limit(1);
            const [supplierExists] = await db.select({ id: suppliers.id })
                .from(suppliers)
                .where(eq(suppliers.id, normalized.supplierId))
                .limit(1);

            if (!orderExists || !supplierExists) {
                skipped++;
                continue;
            }

            const [existing] = await db.select({ id: invoices.id })
                .from(invoices)
                .where(and(
                    eq(invoices.invoiceNumber, normalized.invoiceNumber),
                    eq(invoices.orderId, normalized.orderId),
                ))
                .limit(1);

            if (existing) {
                const invoiceStatus = (['pending', 'matched', 'disputed', 'paid'] as const).includes(normalized.status as any) ? normalized.status : 'pending';
                await db.update(invoices)
                    .set({
                        supplierId: normalized.supplierId,
                        amount: normalized.amount,
                        status: invoiceStatus,
                        currency: normalized.currency,
                        region: normalized.region,
                        country: normalized.country,
                        continent: normalized.continent,
                    })
                    .where(eq(invoices.id, existing.id));
                updated++;
            } else {
                const invoiceStatus = (['pending', 'matched', 'disputed', 'paid'] as const).includes(normalized.status as any) ? normalized.status : 'pending';
                await db.insert(invoices).values({
                    invoiceNumber: normalized.invoiceNumber,
                    orderId: normalized.orderId,
                    supplierId: normalized.supplierId,
                    amount: normalized.amount,
                    status: invoiceStatus,
                    currency: normalized.currency,
                    region: normalized.region,
                    country: normalized.country,
                    continent: normalized.continent,
                });
                inserted++;
            }
        }
    }

    revalidatePath('/suppliers');
    revalidatePath('/sourcing/parts');
    revalidatePath('/sourcing/invoices');
    revalidatePath('/transactions');
    revalidatePath('/admin/import');

    // Refresh core intelligence after import so dashboards and alerts stay in sync.
    try {
        await triggerAgentBundle('post-import');
    } catch (error) {
        console.warn('Post-import agent bundle failed:', error);
    }

    return {
        success: true,
        message: 'Import completed.',
        inserted,
        updated,
        skipped,
        issues: issues.slice(0, 50),
    };
}

// ============================================================================
// IMPORT JOB HISTORY & TRACKING
// ============================================================================

export async function recordImportJob(data: {
    entityType: string;
    fileName: string;
    totalRows: number;
    successRows: number;
    errorRows: number;
    validationReport?: Array<{ row: number; field?: string; issue: string }>;
    fieldMapping?: Record<string, string>;
    sourceSystemId?: string;
}) {
    await requireAdmin();
    const session = await auth();

    const [job] = await db.insert(importJobs).values({
        entityType: data.entityType,
        status: data.errorRows === 0 ? 'completed' : (data.successRows > 0 ? 'completed' : 'failed'),
        fileName: data.fileName,
        totalRows: data.totalRows,
        successRows: data.successRows,
        errorRows: data.errorRows,
        validationReport: data.validationReport ? JSON.stringify(data.validationReport) : null,
        fieldMapping: data.fieldMapping ? JSON.stringify(data.fieldMapping) : null,
        sourceSystemId: data.sourceSystemId,
        importedById: session!.user!.id as string,
        startedAt: new Date(),
        completedAt: new Date(),
    }).returning();

    revalidatePath('/admin/import');
    return job;
}

export async function getImportHistory(limit = 20) {
    await requireAdmin();

    const jobs = await db.select({
        id: importJobs.id,
        entityType: importJobs.entityType,
        status: importJobs.status,
        fileName: importJobs.fileName,
        totalRows: importJobs.totalRows,
        successRows: importJobs.successRows,
        errorRows: importJobs.errorRows,
        sourceSystemId: importJobs.sourceSystemId,
        startedAt: importJobs.startedAt,
        completedAt: importJobs.completedAt,
        createdAt: importJobs.createdAt,
    }).from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(limit);

    return jobs;
}

export async function getImportJobDetails(jobId: string) {
    await requireAdmin();

    const [job] = await db.select()
        .from(importJobs)
        .where(eq(importJobs.id, jobId));

    if (!job) throw new Error('Import job not found');

    return {
        ...job,
        validationReport: job.validationReport ? JSON.parse(job.validationReport) : [],
        fieldMapping: job.fieldMapping ? JSON.parse(job.fieldMapping) : {},
    };
}
