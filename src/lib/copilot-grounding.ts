import JSZip from "jszip";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
    contacts,
    costCenters,
    documents,
    invoices,
    parts,
    procurementOrders,
    suppliers,
    users,
} from "@/db/schema";
import { extractInvoiceFromPdfBuffer, extractPdfTextFromBuffer } from "@/lib/invoices/pdf-fallback";

export type CopilotAttachment = {
    data: string;
    name: string;
    mimeType?: string;
};

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type SupplierRecord = {
    id: string;
    name: string;
    contactEmail: string;
    status: string | null;
    lifecycleStatus: string | null;
    riskScore: number | null;
    performanceScore: number | null;
    esgScore: number | null;
    financialScore: number | null;
    onTimeDeliveryRate: string | null;
};

type PartRecord = {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    category: string;
    price: string | null;
    stockLevel: number;
    marketTrend: string | null;
};

type ContactRecord = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    region: string | null;
    country: string | null;
    currency: string | null;
    supplierName: string | null;
};

type UserRecord = {
    id: string;
    name: string;
    email: string;
    role: string | null;
    department: string | null;
    phoneNumber: string | null;
};

type InvoiceRecord = {
    id: string;
    invoiceNumber: string;
    amount: string;
    currency: string | null;
    status: string | null;
    supplierName: string | null;
    invoiceDate: Date | null;
    dueDate: Date | null;
    country: string | null;
};

type OrderRecord = {
    id: string;
    status: string | null;
    totalAmount: string | null;
    supplierName: string | null;
    createdAt: Date | null;
};

type DocumentRecord = {
    id: string;
    name: string;
    type: string | null;
    url: string | null;
    supplierName: string | null;
};

type CostCenterRecord = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    department: string | null;
};

type WorkspaceIndex = {
    suppliers: SupplierRecord[];
    parts: PartRecord[];
    contacts: ContactRecord[];
    users: UserRecord[];
    invoices: InvoiceRecord[];
    orders: OrderRecord[];
    documents: DocumentRecord[];
    costCenters: CostCenterRecord[];
};

type FaqEntry = {
    id: string;
    question: string;
    keywords: string[];
    answer: string;
    routes?: string[];
};

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set(['csv', 'tsv', 'txt', 'json', 'md', 'log']);
const XLSX_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
]);

const STOPWORDS = new Set([
    'a', 'about', 'all', 'an', 'and', 'any', 'are', 'at', 'by', 'can', 'contact', 'contacts',
    'database', 'detail', 'details', 'do', 'email', 'emails', 'find', 'for', 'from', 'get',
    'give', 'how', 'i', 'in', 'inside', 'internal', 'is', 'it', 'its', 'list', 'lookup', 'me',
    'my', 'name', 'of', 'on', 'or', 'our', 'phone', 'phones', 'please', 'record', 'records',
    'search', 'show', 'the', 'their', 'them', 'there', 'these', 'this', 'to', 'us', 'what',
    'when', 'where', 'which', 'who', 'with', 'work', 'workspace', 'you',
]);

const FAQ_ENTRIES: FaqEntry[] = [
    {
        id: 'password-reset',
        question: 'How do I reset my password?',
        keywords: ['reset password', 'forgot password', 'password reset', 'login recovery'],
        answer: 'Password recovery is admin-mediated in the current workspace. Users should contact their administrator from the login page flow, and the support mailbox is `pma.axiom.support@gmail.com` for follow-up coordination.',
        routes: ['/support', '/login'],
    },
    {
        id: 'import-data',
        question: 'How do I import data into Axiom?',
        keywords: ['import data', 'sap import', 'csv import', 'upload supplier csv', 'guarded import'],
        answer: 'Use `Admin -> Import Data` for guarded CSV ingestion. The flow is admin-gated, validates schema before commit, and is the right entry point for suppliers, parts, and invoice datasets.',
        routes: ['/admin/import'],
    },
    {
        id: 'currency-lens',
        question: 'What is the difference between Local View and Book View?',
        keywords: ['book view', 'local view', 'currency toggle', 'reporting lens', 'fx lens'],
        answer: 'Local View is the operator lens: it converts display values into the user local operating currency. Book View is the finance lens: it converts the same records into fixed reporting-book rates for stable executive rollups. Source invoices and orders never change; only the display and reporting lens changes.',
        routes: ['/admin/settings'],
    },
    {
        id: 'three-way-match',
        question: 'How does three-way matching work?',
        keywords: ['three way match', '3 way match', 'financial matching', 'invoice matching'],
        answer: 'Axiom compares the purchase order, the goods receipt, and the supplier invoice before payment release. Invoices can be disputed, re-run through deterministic rules, or released only after the controls pass.',
        routes: ['/admin/financial-matching', '/sourcing/goods-receipts', '/sourcing/invoices'],
    },
    {
        id: 'exception-management',
        question: 'How does exception management work?',
        keywords: ['exception management', 'quarantine', 'mismatch queue', 'goods receipt mismatch', 'finance hold'],
        answer: 'Exception Management is the operational quarantine route for dirty data, blocked supplier releases, finance holds, and mismatched receipts or invoices. It is where teams triage items that should not continue through the happy-path workflow.',
        routes: ['/sourcing/exceptions'],
    },
    {
        id: 'scenario-modeling',
        question: 'What does Scenario Modeling do?',
        keywords: ['scenario modeling', 'scenario lab', 'what if analysis', 'scenario analysis'],
        answer: 'Scenario Modeling now runs deterministic what-if analysis over live Axiom baselines such as open orders, supplier risk posture, invoice currency exposure, and finance settings. The user supplies the shock; Axiom shows the assumptions, basis, and operational impact instead of pretending to know the outside market automatically.',
        routes: ['/admin/scenarios'],
    },
    {
        id: 'supplier-portal',
        question: 'How do suppliers access the system?',
        keywords: ['supplier portal', 'supplier login', 'vendor portal'],
        answer: 'Supplier accounts are created by administrators and are restricted to the Supplier Portal. Suppliers only see their own RFQs, orders, requests, documents, and profile context.',
        routes: ['/portal', '/login'],
    },
    {
        id: 'audit-trail',
        question: 'Can I export the audit trail?',
        keywords: ['audit trail export', 'export evidence', 'audit csv', 'compliance evidence export'],
        answer: 'Yes. The admin audit surface is read/export focused. Use the audit route to export evidence as CSV for point-in-time review and compliance support.',
        routes: ['/admin/audit'],
    },
    {
        id: 'support-email',
        question: 'What is the support contact email?',
        keywords: ['support email', 'support contact', 'help email'],
        answer: 'The shared support mailbox is `pma.axiom.support@gmail.com`.',
        routes: ['/support'],
    },
    {
        id: 'ai-agents',
        question: 'What are AI Agents?',
        keywords: ['ai agents', 'fraud detection', 'demand forecast', 'payment optimizer'],
        answer: 'AI Agents are specialized workflows that can be triggered manually, by schedule, or from Copilot. They cover operational jobs such as fraud detection, demand forecasting, remediation, and scenario analysis.',
        routes: ['/admin/agents'],
    },
];

function normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeQuery(query: string) {
    return normalizeWhitespace(query.toLowerCase());
}

function tokenizeQuery(query: string) {
    const normalized = normalizeQuery(query);
    return normalized
        .split(/[^a-z0-9@._/-]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function expandFollowUpQuery(query: string, history: ChatMessage[]) {
    const normalized = normalizeQuery(query);
    const followUpPattern = /\b(it|that|those|them|there|he|she|they|their|its)\b/;
    const isShort = tokenizeQuery(query).length <= 2;
    if (!followUpPattern.test(normalized) && !isShort) {
        return query;
    }

    const lastUserMessage = [...history].reverse().find((message) => message.role === 'user' && message.content !== query);
    if (!lastUserMessage) {
        return query;
    }

    return `${lastUserMessage.content}\nFollow-up: ${query}`;
}

function formatCurrency(amount: number | string | null | undefined, currency = 'INR') {
    const numericAmount = typeof amount === 'number' ? amount : Number(amount ?? 0);
    if (!Number.isFinite(numericAmount)) return `${currency} 0`;
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericAmount);
    } catch {
        return `${numericAmount.toFixed(2)} ${currency}`;
    }
}

function formatDate(value: Date | null | undefined) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
}

function markdownTable(headers: string[], rows: string[][]) {
    const head = `| ${headers.join(' | ')} |`;
    const divider = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
    return [head, divider, body].join('\n');
}

function rankMatches<T>(items: T[], query: string, mapper: (item: T) => string) {
    const normalizedQuery = normalizeQuery(query);
    const tokens = tokenizeQuery(query);

    return items
        .map((item) => {
            const haystack = normalizeQuery(mapper(item));
            let score = 0;

            if (normalizedQuery && haystack.includes(normalizedQuery)) {
                score += 12;
            }

            for (const token of tokens) {
                if (haystack === token) {
                    score += 8;
                } else if (haystack.startsWith(token)) {
                    score += 5;
                } else if (haystack.includes(token)) {
                    score += 2;
                }
            }

            return { item, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.item);
}

function guessEntity(query: string) {
    const normalized = normalizeQuery(query);

    if (/\bcustomer|customers\b/.test(normalized)) return 'customer';
    if (/\bcost center|cost centre|costcenter|costcentre|department code\b/.test(normalized)) return 'costCenter';
    if (/\bcontact|contacts|email|phone|mobile\b/.test(normalized)) return 'contact';
    if (/\bsupplier|suppliers|vendor|vendors\b/.test(normalized)) return 'supplier';
    if (/\bpart|parts|product|products|sku|catalog\b/.test(normalized)) return 'part';
    if (/\buser|users|admin|admins|employee|employees|buyer|buyers\b/.test(normalized)) return 'user';
    if (/\binvoice|invoices|bill|bills|payable\b/.test(normalized)) return 'invoice';
    if (/\border|orders|purchase order|po\b/.test(normalized)) return 'order';
    if (/\bdocument|documents|file|files|contract pdf|attachment\b/.test(normalized)) return 'document';
    return null;
}

function isCountQuery(query: string) {
    return /\bhow many|count|total number|number of\b/.test(normalizeQuery(query));
}

function extractRiskThreshold(query: string) {
    const normalized = normalizeQuery(query);
    const greater = normalized.match(/(?:risk|score)\s*(?:>=|>|above|over|at least)\s*(\d{1,3})/);
    if (greater?.[1]) {
        return { operator: 'gte' as const, value: Number(greater[1]) };
    }

    const lower = normalized.match(/(?:risk|score)\s*(?:<=|<|below|under|at most)\s*(\d{1,3})/);
    if (lower?.[1]) {
        return { operator: 'lte' as const, value: Number(lower[1]) };
    }

    return null;
}

function isCapabilityQuery(query: string) {
    return /\bwhat can you answer|what can you do|what do you know|what is in the database|which tables|what data\b/.test(normalizeQuery(query));
}

function matchFaq(query: string) {
    const normalized = normalizeQuery(query);
    const scored = FAQ_ENTRIES.map((entry) => {
        const score = entry.keywords.reduce((total, keyword) => {
            const normalizedKeyword = normalizeQuery(keyword);
            return normalized.includes(normalizedKeyword) ? total + normalizedKeyword.split(' ').length + 1 : total;
        }, 0);

        return { entry, score };
    }).sort((left, right) => right.score - left.score);

    return scored[0] && scored[0].score >= 2 ? scored[0].entry : null;
}

async function getWorkspaceIndex(): Promise<WorkspaceIndex> {
    const [
        supplierRows,
        partRows,
        contactRows,
        userRows,
        invoiceRows,
        orderRows,
        documentRows,
        costCenterRows,
    ] = await Promise.all([
        db.select({
            id: suppliers.id,
            name: suppliers.name,
            contactEmail: suppliers.contactEmail,
            status: suppliers.status,
            lifecycleStatus: suppliers.lifecycleStatus,
            riskScore: suppliers.riskScore,
            performanceScore: suppliers.performanceScore,
            esgScore: suppliers.esgScore,
            financialScore: suppliers.financialScore,
            onTimeDeliveryRate: suppliers.onTimeDeliveryRate,
        }).from(suppliers).orderBy(desc(suppliers.riskScore)),
        db.select({
            id: parts.id,
            sku: parts.sku,
            name: parts.name,
            description: parts.description,
            category: parts.category,
            price: parts.price,
            stockLevel: parts.stockLevel,
            marketTrend: parts.marketTrend,
        }).from(parts).orderBy(desc(parts.createdAt)),
        db.select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
            phone: contacts.phone,
            company: contacts.company,
            jobTitle: contacts.jobTitle,
            region: contacts.region,
            country: contacts.country,
            currency: contacts.currency,
            supplierName: suppliers.name,
        }).from(contacts).leftJoin(suppliers, eq(contacts.supplierId, suppliers.id)).orderBy(desc(contacts.createdAt)),
        db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            department: users.department,
            phoneNumber: users.phoneNumber,
        }).from(users).orderBy(desc(users.createdAt)),
        db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            currency: invoices.currency,
            status: invoices.status,
            supplierName: suppliers.name,
            invoiceDate: invoices.invoiceDate,
            dueDate: invoices.dueDate,
            country: invoices.country,
        }).from(invoices).leftJoin(suppliers, eq(invoices.supplierId, suppliers.id)).orderBy(desc(invoices.createdAt)),
        db.select({
            id: procurementOrders.id,
            status: procurementOrders.status,
            totalAmount: procurementOrders.totalAmount,
            supplierName: suppliers.name,
            createdAt: procurementOrders.createdAt,
        }).from(procurementOrders).leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id)).orderBy(desc(procurementOrders.createdAt)),
        db.select({
            id: documents.id,
            name: documents.name,
            type: documents.type,
            url: documents.url,
            supplierName: suppliers.name,
        }).from(documents).leftJoin(suppliers, eq(documents.supplierId, suppliers.id)).orderBy(desc(documents.createdAt)),
        db.select({
            id: costCenters.id,
            code: costCenters.code,
            name: costCenters.name,
            description: costCenters.description,
            department: costCenters.department,
        }).from(costCenters).orderBy(desc(costCenters.createdAt)),
    ]);

    return {
        suppliers: supplierRows,
        parts: partRows,
        contacts: contactRows,
        users: userRows,
        invoices: invoiceRows.map((row) => ({ ...row, amount: String(row.amount ?? '0') })),
        orders: orderRows.map((row) => ({ ...row, totalAmount: row.totalAmount ? String(row.totalAmount) : null })),
        documents: documentRows,
        costCenters: costCenterRows,
    };
}

function buildCapabilityResponse(index: WorkspaceIndex) {
    return [
        "## Axiom Copilot Coverage",
        "I answer from Axiom's own structured sources first, not from free-form AI generation.",
        "",
        `Current workspace coverage: ${index.suppliers.length} suppliers, ${index.parts.length} parts, ${index.contacts.length} contacts, ${index.users.length} users, ${index.invoices.length} invoices, ${index.orders.length} orders, ${index.documents.length} documents, and ${index.costCenters.length} cost centers.`,
        "",
        "### What I can answer directly",
        "- Supplier details, risk posture, contact email, and lifecycle state",
        "- Parts / products, SKUs, pricing, stock level, and category",
        "- Contacts, users, departments, and phone / email details",
        "- Invoices, orders, documents, and cost center records",
        "- Product workflow questions from the Axiom knowledge base",
        "- Parsed PDF, CSV, TSV, TXT, JSON, and XLSX uploads",
        "",
        "### Boundary",
        "- This workspace does not expose a dedicated `customers` table right now, so I answer from suppliers, contacts, users, products, orders, invoices, and documents instead.",
        "",
        "(Source: Workspace Index, Axiom Knowledge Base)",
    ].join("\n");
}

function buildFaqResponse(entry: FaqEntry) {
    const routeLine = entry.routes && entry.routes.length > 0
        ? `Routes: ${entry.routes.join(', ')}`
        : null;

    return [
        `## ${entry.question}`,
        entry.answer,
        routeLine,
        "(Source: Axiom Knowledge Base)",
    ].filter(Boolean).join("\n\n");
}

function buildSupplierResponse(query: string, index: WorkspaceIndex) {
    const riskFilter = extractRiskThreshold(query);
    const normalized = normalizeQuery(query);
    let matches = rankMatches(index.suppliers, query, (supplier) => [
        supplier.name,
        supplier.contactEmail,
        supplier.status,
        supplier.lifecycleStatus,
    ].filter(Boolean).join(' '));

    if (riskFilter) {
        matches = matches.filter((supplier) => {
            const risk = supplier.riskScore ?? 0;
            return riskFilter.operator === 'gte' ? risk >= riskFilter.value : risk <= riskFilter.value;
        });
    }

    if (matches.length === 0 || /\bhigh risk|risky|watchlist\b/.test(normalized)) {
        matches = [...index.suppliers].sort((left, right) => (right.riskScore ?? 0) - (left.riskScore ?? 0));
        if (riskFilter) {
            matches = matches.filter((supplier) => {
                const risk = supplier.riskScore ?? 0;
                return riskFilter.operator === 'gte' ? risk >= riskFilter.value : risk <= riskFilter.value;
            });
        }
    }

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.suppliers.length;
        return [
            "## Supplier Count",
            `${count} supplier record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Suppliers)",
        ].join("\n\n");
    }

    const rows = matches.slice(0, 8).map((supplier) => [
        supplier.name,
        String(supplier.riskScore ?? 0),
        supplier.status || '-',
        supplier.lifecycleStatus || '-',
        supplier.contactEmail,
    ]);

    return [
        "## Supplier Records",
        rows.length > 0
            ? markdownTable(['Name', 'Risk', 'Status', 'Lifecycle', 'Contact'], rows)
            : "No supplier matched this query in the current workspace snapshot.",
        "Route: /suppliers",
        "(Source: Workspace -> Suppliers)",
    ].join("\n\n");
}

function buildPartResponse(query: string, index: WorkspaceIndex) {
    let matches = rankMatches(index.parts, query, (part) => [
        part.sku,
        part.name,
        part.description,
        part.category,
        part.marketTrend,
    ].filter(Boolean).join(' '));

    if (matches.length === 0) {
        matches = [...index.parts];
    }

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.parts.length;
        return [
            "## Parts Count",
            `${count} part record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Parts Catalog)",
        ].join("\n\n");
    }

    const rows = matches.slice(0, 8).map((part) => [
        part.sku,
        part.name,
        part.category,
        formatCurrency(part.price, 'INR'),
        String(part.stockLevel),
    ]);

    return [
        "## Parts / Products",
        rows.length > 0
            ? markdownTable(['SKU', 'Name', 'Category', 'Price', 'Stock'], rows)
            : "No part or product matched this query in the current workspace snapshot.",
        "Route: /sourcing/parts",
        "(Source: Workspace -> Parts Catalog)",
    ].join("\n\n");
}

function buildContactResponse(query: string, index: WorkspaceIndex) {
    const matches = rankMatches(index.contacts, query, (contact) => [
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.jobTitle,
        contact.region,
        contact.country,
        contact.supplierName,
    ].filter(Boolean).join(' '));

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.contacts.length;
        return [
            "## Contact Count",
            `${count} contact record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Contacts)",
        ].join("\n\n");
    }

    const rows = (matches.length > 0 ? matches : index.contacts).slice(0, 8).map((contact) => [
        contact.name,
        contact.company || '-',
        contact.email,
        contact.phone || '-',
        contact.region || contact.country || '-',
    ]);

    return [
        "## Contact Details",
        rows.length > 0
            ? markdownTable(['Name', 'Company', 'Email', 'Phone', 'Region'], rows)
            : "No contact matched this query in the current workspace snapshot.",
        "Route: /contacts",
        "(Source: Workspace -> Contacts)",
    ].join("\n\n");
}

function buildUserResponse(query: string, index: WorkspaceIndex) {
    const normalized = normalizeQuery(query);
    let matches = rankMatches(index.users, query, (user) => [
        user.name,
        user.email,
        user.department,
        user.role,
        user.phoneNumber,
    ].filter(Boolean).join(' '));

    if (/\badmin|admins|administrator\b/.test(normalized)) {
        matches = (matches.length > 0 ? matches : index.users).filter((user) => user.role === 'admin');
    }

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.users.length;
        return [
            "## User Count",
            `${count} user record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Users)",
        ].join("\n\n");
    }

    const rows = (matches.length > 0 ? matches : index.users).slice(0, 8).map((user) => [
        user.name,
        user.email,
        user.role || '-',
        user.department || '-',
        user.phoneNumber || '-',
    ]);

    return [
        "## Workspace Users",
        rows.length > 0
            ? markdownTable(['Name', 'Email', 'Role', 'Department', 'Phone'], rows)
            : "No user matched this query in the current workspace snapshot.",
        "(Source: Workspace -> Users)",
    ].join("\n\n");
}

function buildInvoiceResponse(query: string, index: WorkspaceIndex) {
    const matches = rankMatches(index.invoices, query, (invoice) => [
        invoice.invoiceNumber,
        invoice.status,
        invoice.currency,
        invoice.supplierName,
        invoice.country,
    ].filter(Boolean).join(' '));

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.invoices.length;
        return [
            "## Invoice Count",
            `${count} invoice record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Invoices)",
        ].join("\n\n");
    }

    const rows = (matches.length > 0 ? matches : index.invoices).slice(0, 8).map((invoice) => [
        invoice.invoiceNumber,
        invoice.supplierName || '-',
        formatCurrency(invoice.amount, invoice.currency || 'INR'),
        invoice.status || '-',
        formatDate(invoice.invoiceDate),
    ]);

    return [
        "## Invoice Records",
        rows.length > 0
            ? markdownTable(['Invoice #', 'Supplier', 'Amount', 'Status', 'Date'], rows)
            : "No invoice matched this query in the current workspace snapshot.",
        "Route: /sourcing/invoices",
        "(Source: Workspace -> Invoices)",
    ].join("\n\n");
}

function buildOrderResponse(query: string, index: WorkspaceIndex) {
    const matches = rankMatches(index.orders, query, (order) => [
        order.id,
        order.status,
        order.supplierName,
        order.totalAmount,
    ].filter(Boolean).join(' '));

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.orders.length;
        return [
            "## Order Count",
            `${count} order record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Orders)",
        ].join("\n\n");
    }

    const rows = (matches.length > 0 ? matches : index.orders).slice(0, 8).map((order) => [
        order.id.slice(0, 8).toUpperCase(),
        order.supplierName || '-',
        formatCurrency(order.totalAmount, 'INR'),
        order.status || '-',
        formatDate(order.createdAt),
    ]);

    return [
        "## Purchase Orders",
        rows.length > 0
            ? markdownTable(['Order', 'Supplier', 'Value', 'Status', 'Created'], rows)
            : "No order matched this query in the current workspace snapshot.",
        "Route: /sourcing/orders",
        "(Source: Workspace -> Orders)",
    ].join("\n\n");
}

function buildDocumentResponse(query: string, index: WorkspaceIndex) {
    const matches = rankMatches(index.documents, query, (document) => [
        document.name,
        document.type,
        document.supplierName,
        document.url,
    ].filter(Boolean).join(' '));

    if (isCountQuery(query)) {
        const count = matches.length > 0 ? matches.length : index.documents.length;
        return [
            "## Document Count",
            `${count} document record${count === 1 ? '' : 's'} matched this request.`,
            "(Source: Workspace -> Documents)",
        ].join("\n\n");
    }

    const rows = (matches.length > 0 ? matches : index.documents).slice(0, 8).map((document) => [
        document.name,
        document.type || '-',
        document.supplierName || '-',
        document.url || '-',
    ]);

    return [
        "## Documents",
        rows.length > 0
            ? markdownTable(['Name', 'Type', 'Supplier', 'URL'], rows)
            : "No document matched this query in the current workspace snapshot.",
        "(Source: Workspace -> Documents)",
    ].join("\n\n");
}

function buildCostCenterResponse(query: string, index: WorkspaceIndex) {
    const matches = rankMatches(index.costCenters, query, (costCenter) => [
        costCenter.code,
        costCenter.name,
        costCenter.description,
        costCenter.department,
    ].filter(Boolean).join(' '));

    const rows = (matches.length > 0 ? matches : index.costCenters).slice(0, 8).map((costCenter) => [
        costCenter.code,
        costCenter.name,
        costCenter.department || '-',
        costCenter.description || '-',
    ]);

    return [
        "## Cost Centers",
        rows.length > 0
            ? markdownTable(['Code', 'Name', 'Department', 'Description'], rows)
            : "No cost center matched this query in the current workspace snapshot.",
        "(Source: Workspace -> Cost Centers)",
    ].join("\n\n");
}

function buildCrossEntityResponse(query: string, index: WorkspaceIndex) {
    const suppliersMatch = rankMatches(index.suppliers, query, (supplier) => `${supplier.name} ${supplier.contactEmail}`).slice(0, 3);
    const partsMatch = rankMatches(index.parts, query, (part) => `${part.sku} ${part.name} ${part.category}`).slice(0, 3);
    const contactsMatch = rankMatches(index.contacts, query, (contact) => `${contact.name} ${contact.email} ${contact.company || ''}`).slice(0, 3);
    const docsMatch = rankMatches(index.documents, query, (document) => `${document.name} ${document.type || ''} ${document.supplierName || ''}`).slice(0, 3);

    const sections: string[] = ["## Workspace Search"];

    if (suppliersMatch.length > 0) {
        sections.push("### Suppliers");
        sections.push(markdownTable(
            ['Name', 'Risk', 'Contact'],
            suppliersMatch.map((supplier) => [supplier.name, String(supplier.riskScore ?? 0), supplier.contactEmail]),
        ));
    }

    if (partsMatch.length > 0) {
        sections.push("### Parts");
        sections.push(markdownTable(
            ['SKU', 'Name', 'Category'],
            partsMatch.map((part) => [part.sku, part.name, part.category]),
        ));
    }

    if (contactsMatch.length > 0) {
        sections.push("### Contacts");
        sections.push(markdownTable(
            ['Name', 'Email', 'Company'],
            contactsMatch.map((contact) => [contact.name, contact.email, contact.company || '-']),
        ));
    }

    if (docsMatch.length > 0) {
        sections.push("### Documents");
        sections.push(markdownTable(
            ['Name', 'Type', 'Supplier'],
            docsMatch.map((document) => [document.name, document.type || '-', document.supplierName || '-']),
        ));
    }

    if (sections.length === 1) {
        sections.push("I could not find a strong match for that query in the current workspace index.");
        sections.push("Try a supplier name, SKU, contact email, invoice number, or document name.");
    }

    sections.push("(Source: Workspace Search Index)");
    return sections.join("\n\n");
}

export async function buildDeterministicCopilotResponse(query: string, history: ChatMessage[] = []) {
    const effectiveQuery = expandFollowUpQuery(query, history);
    const faq = matchFaq(effectiveQuery);
    if (faq) {
        return buildFaqResponse(faq);
    }

    const index = await getWorkspaceIndex();

    if (isCapabilityQuery(effectiveQuery)) {
        return buildCapabilityResponse(index);
    }

    const entity = guessEntity(effectiveQuery);
    if (entity === 'customer') {
        return [
            "## Customer Coverage",
            "The current workspace snapshot does not expose a dedicated `customers` table.",
            "Copilot is grounded on suppliers, parts, contacts, users, invoices, orders, documents, and cost centers in this environment.",
            "(Source: Workspace Schema Snapshot)",
        ].join("\n\n");
    }

    switch (entity) {
        case 'supplier':
            return buildSupplierResponse(effectiveQuery, index);
        case 'part':
            return buildPartResponse(effectiveQuery, index);
        case 'contact':
            return buildContactResponse(effectiveQuery, index);
        case 'user':
            return buildUserResponse(effectiveQuery, index);
        case 'invoice':
            return buildInvoiceResponse(effectiveQuery, index);
        case 'order':
            return buildOrderResponse(effectiveQuery, index);
        case 'document':
            return buildDocumentResponse(effectiveQuery, index);
        case 'costCenter':
            return buildCostCenterResponse(effectiveQuery, index);
        default:
            return buildCrossEntityResponse(effectiveQuery, index);
    }
}

function getFileExtension(fileName: string) {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() ?? '' : '';
}

function normalizeAttachmentMimeType(attachment: CopilotAttachment) {
    const mimeType = attachment.mimeType?.toLowerCase();
    if (mimeType) return mimeType;

    const extension = getFileExtension(attachment.name);
    if (extension === 'pdf') return 'application/pdf';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    if (extension === 'csv') return 'text/csv';
    if (extension === 'tsv') return 'text/tab-separated-values';
    if (extension === 'txt' || extension === 'log' || extension === 'md') return 'text/plain';
    if (extension === 'json') return 'application/json';
    if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (extension === 'xls') return 'application/vnd.ms-excel';
    return 'application/octet-stream';
}

function decodeXmlEntities(value: string) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#10;/g, '\n')
        .replace(/&#13;/g, '\r')
        .replace(/&amp;/g, '&');
}

function sanitizeCell(value: string) {
    return value.replace(/\s+/g, ' ').trim();
}

function parseDelimitedLine(line: string, delimiter: string) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === delimiter && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    values.push(current.trim());
    return values;
}

function formatTablePreview(rows: string[][], title: string) {
    if (rows.length === 0) {
        return `### ${title}\nNo rows could be extracted.`;
    }

    const limitedRows = rows.slice(0, 10).map((row) => row.slice(0, 6).map((cell) => sanitizeCell(cell || '')));
    const headerRow = limitedRows[0].map((cell, index) => cell || `Column ${index + 1}`);
    const bodyRows = limitedRows.slice(1);

    return [
        `### ${title}`,
        markdownTable(
            headerRow,
            bodyRows.length > 0 ? bodyRows.map((row) => headerRow.map((_, index) => row[index] || '')) : [headerRow.map(() => '')],
        ),
    ].join("\n");
}

function buildDelimitedPreview(text: string, fileName: string, delimiter: string) {
    const rows = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 10)
        .map((line) => parseDelimitedLine(line, delimiter));

    return formatTablePreview(rows, `${fileName} Preview`);
}

function columnReferenceToIndex(reference: string) {
    const letters = reference.replace(/[^A-Z]/gi, '').toUpperCase();
    let result = 0;
    for (const letter of letters) {
        result = result * 26 + (letter.charCodeAt(0) - 64);
    }
    return Math.max(result - 1, 0);
}

function extractSharedStrings(xml: string) {
    const matches = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)];
    return matches.map((match) => decodeXmlEntities(match[1]));
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
    const rows: string[][] = [];

    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const rowXml = rowMatch[1];
        const row: string[] = [];

        for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
            const attributes = cellMatch[1];
            const cellXml = cellMatch[2];
            const refMatch = attributes.match(/\br="([A-Z]+[0-9]+)"/i);
            const typeMatch = attributes.match(/\bt="([^"]+)"/i);
            const columnIndex = refMatch ? columnReferenceToIndex(refMatch[1]) : row.length;
            const valueMatch = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/i);
            const inlineMatch = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/i);

            let value = '';
            if (typeMatch?.[1] === 's' && valueMatch) {
                value = sharedStrings[Number(valueMatch[1])] ?? '';
            } else if (inlineMatch) {
                value = decodeXmlEntities(inlineMatch[1]);
            } else if (valueMatch) {
                value = decodeXmlEntities(valueMatch[1]);
            }

            row[columnIndex] = sanitizeCell(value);
        }

        if (row.some((cell) => cell && cell.length > 0)) {
            rows.push(row);
        }

        if (rows.length >= 10) {
            break;
        }
    }

    return rows;
}

async function extractSpreadsheetPreview(base64Data: string, fileName: string) {
    const zip = await JSZip.loadAsync(Buffer.from(base64Data, 'base64'));
    const sharedStringsFile = zip.file('xl/sharedStrings.xml');
    const workbookFile = zip.file('xl/workbook.xml');
    const sharedStringsXml = sharedStringsFile ? await sharedStringsFile.async('string') : undefined;
    const workbookXml = workbookFile ? await workbookFile.async('string') : undefined;
    const sharedStrings = sharedStringsXml ? extractSharedStrings(sharedStringsXml) : [];

    const sheetNameMatches = workbookXml
        ? [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((match) => decodeXmlEntities(match[1]))
        : [];

    const worksheetFiles = Object.keys(zip.files)
        .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
        .sort()
        .slice(0, 3);

    if (worksheetFiles.length === 0) {
        return `### ${fileName}\nNo worksheet data could be extracted from this workbook.`;
    }

    const previews: string[] = [];
    for (const [index, worksheetPath] of worksheetFiles.entries()) {
        const worksheetFile = zip.file(worksheetPath);
        if (!worksheetFile) continue;

        const worksheetXml = await worksheetFile.async('string');
        previews.push(formatTablePreview(
            parseWorksheetRows(worksheetXml, sharedStrings),
            sheetNameMatches[index] || `Sheet ${index + 1}`,
        ));
    }

    return `## Workbook Preview: ${fileName}\n\n${previews.join('\n\n')}`;
}

type ParsedAttachment = {
    documentType: string;
    contentKind: 'pdf' | 'spreadsheet' | 'tabular' | 'text' | 'image' | 'unknown';
    preview: string;
    extractedText: string;
    detectedFields: Array<[string, string]>;
};

function detectDocumentType(fileName: string, extractedText: string) {
    const extension = getFileExtension(fileName);
    const normalized = normalizeQuery(`${fileName} ${extractedText.slice(0, 2000)}`);

    if (extension === 'pdf' && /\binvoice|tax invoice|amount due|purchase order\b/.test(normalized)) return 'Invoice PDF';
    if (/\bcontract|agreement|msa|framework agreement\b/.test(normalized)) return 'Contract / Agreement';
    if (/\bquotation|quote|pricing\b/.test(normalized)) return 'Quotation';
    if (/\bgoods receipt|grn|received quantity\b/.test(normalized)) return 'Goods Receipt';
    if (extension === 'xlsx' || extension === 'xls' || extension === 'csv' || extension === 'tsv') return 'Structured tabular file';
    if (extension === 'json' || extension === 'txt' || extension === 'md' || extension === 'log') return 'Text document';
    if (extension === 'pdf') return 'PDF document';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'Image document';
    return 'Document';
}

async function parseAttachment(attachment: CopilotAttachment): Promise<ParsedAttachment> {
    const mimeType = normalizeAttachmentMimeType(attachment);
    const extension = getFileExtension(attachment.name);

    if (attachment.data.length > MAX_ATTACHMENT_SIZE_BYTES * 1.37) {
        return {
            documentType: 'Attachment',
            contentKind: 'unknown',
            preview: "The uploaded file exceeds the 10 MB limit for deterministic parsing.",
            extractedText: '',
            detectedFields: [],
        };
    }

    if (mimeType.startsWith('image/')) {
        return {
            documentType: 'Image document',
            contentKind: 'image',
            preview: "Deterministic OCR is not configured for image-only uploads in this workspace. Upload a text-backed PDF, CSV, TXT, JSON, or XLSX file for grounded parsing.",
            extractedText: '',
            detectedFields: [],
        };
    }

    if (mimeType === 'application/pdf') {
        const buffer = Buffer.from(attachment.data, 'base64');
        const pdfText = await extractPdfTextFromBuffer(attachment.name, buffer);
        const invoiceExtraction = await extractInvoiceFromPdfBuffer(attachment.name, buffer);
        const extractedText = pdfText || invoiceExtraction?.text || '';
        const fields: Array<[string, string]> = [];

        if (invoiceExtraction?.data.supplierName) fields.push(['Supplier', invoiceExtraction.data.supplierName]);
        if (invoiceExtraction?.data.invoiceNumber) fields.push(['Invoice Number', invoiceExtraction.data.invoiceNumber]);
        if (invoiceExtraction?.data.amount !== null && invoiceExtraction?.data.amount !== undefined) {
            fields.push(['Amount', formatCurrency(invoiceExtraction.data.amount, invoiceExtraction.data.currency || 'INR')]);
        }
        if (invoiceExtraction?.data.currency) fields.push(['Currency', invoiceExtraction.data.currency]);
        if (invoiceExtraction?.data.invoiceDate) fields.push(['Invoice Date', invoiceExtraction.data.invoiceDate]);
        if (invoiceExtraction?.data.dueDate) fields.push(['Due Date', invoiceExtraction.data.dueDate]);
        if (invoiceExtraction?.data.purchaseOrderRef) fields.push(['PO Reference', invoiceExtraction.data.purchaseOrderRef]);

        const preview = extractedText
            ? `### Text Preview\n\`\`\`\n${extractedText.slice(0, 1800).trim()}\n\`\`\``
            : "No text layer could be extracted from this PDF.";

        return {
            documentType: detectDocumentType(attachment.name, extractedText),
            contentKind: 'pdf',
            preview,
            extractedText,
            detectedFields: fields,
        };
    }

    if (extension === 'xlsx' || XLSX_MIME_TYPES.has(mimeType)) {
        const preview = await extractSpreadsheetPreview(attachment.data, attachment.name);
        return {
            documentType: 'Structured tabular file',
            contentKind: 'spreadsheet',
            preview,
            extractedText: preview,
            detectedFields: [],
        };
    }

    if (extension === 'xls' || mimeType === 'application/vnd.ms-excel') {
        return {
            documentType: 'Legacy spreadsheet',
            contentKind: 'spreadsheet',
            preview: `The workbook "${attachment.name}" is a legacy .xls file. Re-upload it as .xlsx or .csv for row-level deterministic parsing.`,
            extractedText: '',
            detectedFields: [],
        };
    }

    const decodedText = Buffer.from(attachment.data, 'base64').toString('utf-8');

    if (extension === 'csv') {
        const preview = buildDelimitedPreview(decodedText, attachment.name, ',');
        return {
            documentType: 'Structured tabular file',
            contentKind: 'tabular',
            preview,
            extractedText: decodedText,
            detectedFields: [],
        };
    }

    if (extension === 'tsv') {
        const preview = buildDelimitedPreview(decodedText, attachment.name, '\t');
        return {
            documentType: 'Structured tabular file',
            contentKind: 'tabular',
            preview,
            extractedText: decodedText,
            detectedFields: [],
        };
    }

    if (TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
        const preview = `### ${attachment.name}\n\n\`\`\`\n${decodedText.slice(0, 1800)}\n\`\`\``;
        return {
            documentType: detectDocumentType(attachment.name, decodedText),
            contentKind: 'text',
            preview,
            extractedText: decodedText,
            detectedFields: [],
        };
    }

    return {
        documentType: 'Document',
        contentKind: 'unknown',
        preview: `I can see the file "${attachment.name}", but this format does not have a deterministic parser configured here yet.`,
        extractedText: '',
        detectedFields: [],
    };
}

function buildDocumentCrossCheck(parsed: ParsedAttachment, index: WorkspaceIndex) {
    const signals: string[] = [];

    const supplierField = parsed.detectedFields.find(([label]) => label === 'Supplier')?.[1];
    if (supplierField) {
        const supplierMatches = rankMatches(index.suppliers, supplierField, (supplier) => `${supplier.name} ${supplier.contactEmail}`);
        if (supplierMatches[0]) {
            signals.push(`Supplier match: ${supplierMatches[0].name} (risk ${supplierMatches[0].riskScore ?? 0}, contact ${supplierMatches[0].contactEmail}).`);
        }
    }

    const invoiceField = parsed.detectedFields.find(([label]) => label === 'Invoice Number')?.[1];
    if (invoiceField) {
        const invoiceMatches = rankMatches(index.invoices, invoiceField, (invoice) => `${invoice.invoiceNumber} ${invoice.supplierName || ''}`);
        if (invoiceMatches[0]) {
            signals.push(`Invoice match: ${invoiceMatches[0].invoiceNumber} is already present with status ${invoiceMatches[0].status || 'unknown'}.`);
        }
    }

    const poField = parsed.detectedFields.find(([label]) => label === 'PO Reference')?.[1];
    if (poField) {
        const orderMatches = rankMatches(index.orders, poField, (order) => `${order.id} ${order.supplierName || ''} ${order.status || ''}`);
        if (orderMatches[0]) {
            signals.push(`Order match: ${orderMatches[0].id.slice(0, 8).toUpperCase()} is visible in the order book with status ${orderMatches[0].status || 'unknown'}.`);
        }
    }

    if (signals.length === 0 && parsed.extractedText) {
        const supplierNameMatches = index.suppliers.filter((supplier) =>
            normalizeQuery(parsed.extractedText).includes(normalizeQuery(supplier.name)),
        ).slice(0, 2);

        supplierNameMatches.forEach((supplier) => {
            signals.push(`Supplier name found in document text: ${supplier.name} (risk ${supplier.riskScore ?? 0}).`);
        });
    }

    return signals;
}

export async function buildDeterministicDocumentResponse(
    query: string,
    attachment: CopilotAttachment,
    history: ChatMessage[] = [],
) {
    const effectiveQuery = expandFollowUpQuery(query, history);
    const parsed = await parseAttachment(attachment);
    const index = await getWorkspaceIndex();
    const crossCheck = buildDocumentCrossCheck(parsed, index);

    const nextSteps = [
        parsed.documentType.includes('Invoice')
            ? "Open `/sourcing/invoices` or `/admin/financial-matching` to reconcile this document against live records."
            : "Open the most relevant operational route and compare this document against the current workspace records.",
        "Use `/admin/import` if the file should become structured workspace data instead of a one-off review artifact.",
        "If the file carries supplier obligations, cross-check `/admin/compliance` and `/suppliers` before approving anything downstream.",
    ];

    return [
        `## Parsed Document: ${attachment.name}`,
        `Type: ${parsed.documentType}`,
        `Requested focus: ${effectiveQuery || 'General document analysis'}`,
        parsed.detectedFields.length > 0
            ? [
                "### Extracted Fields",
                markdownTable(
                    ['Field', 'Value'],
                    parsed.detectedFields.map(([label, value]) => [label, value]),
                ),
            ].join("\n\n")
            : null,
        "### Parsed Evidence",
        parsed.preview,
        crossCheck.length > 0
            ? [
                "### Workspace Cross-Check",
                ...crossCheck.map((signal) => `- ${signal}`),
            ].join("\n")
            : null,
        [
            "### Suggested Next Steps",
            ...nextSteps.map((step, index2) => `${index2 + 1}. ${step}`),
        ].join("\n"),
        "(Source: Parsed Attachment, Workspace Index)",
    ].filter(Boolean).join("\n\n");
}
