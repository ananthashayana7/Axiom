'use server'

import { db } from "@/db";
import {
    procurementOrders,
    orderItems,
    parts,
    suppliers,
    chatHistory,
    users,
    contacts,
    documents,
    costCenters,
    contracts,
} from "@/db/schema";
import { eq, sum, desc, sql, count, asc, ilike } from "drizzle-orm";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

import { getAiModel } from "@/lib/ai-provider";
import { getCopilotKnowledgeContext } from "@/lib/copilot-knowledge";
import { SUPPORT_FAQS } from "@/lib/support";
import { extractInvoiceFromPdfBuffer, extractPdfTextFromBuffer } from "@/lib/invoices/pdf-fallback";
import JSZip from "jszip";
import { createInvoice, getInvoices } from "./invoices";
import { triggerAgentDispatch } from "./agents";

// Remove hardcoded key, using provider

async function getDatabaseContext() {
    try {
        // Fetch High Level Stats
        const [supCount] = await db.select({ count: count() }).from(suppliers);
        const [pCount] = await db.select({ count: count() }).from(parts);
        const [ordCount] = await db.select({ count: count() }).from(procurementOrders);

        const totalSpendResult = await db.select({ total: sum(procurementOrders.totalAmount) }).from(procurementOrders);
        const totalSpend = totalSpendResult[0]?.total || 0;

        // Fetch Top Categories
        const categorySpend = await db.select({
            category: parts.category,
            total: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`
        })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .groupBy(parts.category)
            .orderBy(sql`sum(${orderItems.quantity} * ${orderItems.unitPrice}) desc`)
            .limit(3);

        // Fetch Risky Suppliers
        const riskySuppliers = await db.select({ name: suppliers.name, score: suppliers.riskScore })
            .from(suppliers)
            .where(sql`${suppliers.riskScore} > 50`)
            .limit(5);

        // Fetch Recent Orders
        const recentOrders = await db.select({
            id: procurementOrders.id,
            amount: procurementOrders.totalAmount,
            status: procurementOrders.status
        })
            .from(procurementOrders)
            .orderBy(desc(procurementOrders.createdAt))
            .limit(5);

        return {
            stats: {
                suppliers: supCount.count,
                parts: pCount.count,
                orders: ordCount.count,
                totalSpend: Number(totalSpend).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
            },
            topCategories: categorySpend,
            riskySuppliers,
            recentOrders,
            timestamp: new Date().toISOString()
        };
    } catch (error: unknown) {
        console.error("Context fetch failed:", error);
        return null;
    }
}

export async function getChatHistory() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const history = await db.select()
            .from(chatHistory)
            .where(eq(chatHistory.userId, session.user.id))
            .orderBy(asc(chatHistory.timestamp));

        return history.map(h => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
            timestamp: h.timestamp
        }));
    } catch (error) {
        console.error("Failed to fetch chat history:", error);
        return [];
    }
}

export async function saveChatMessage(role: 'user' | 'assistant', content: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    try {
        await db.insert(chatHistory).values({
            userId: session.user.id,
            role,
            content,
        });
    } catch (error) {
        console.error("Failed to save chat message:", error);
    }
}

export async function clearChatHistory() {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        await db.delete(chatHistory).where(eq(chatHistory.userId, session.user.id));
        return { success: true };
    } catch (error) {
        console.error("Failed to clear chat history:", error);
        return { success: false, error: "Failed to clear history" };
    }
}

export async function analyzeSpend() {
    const session = await auth();
    if (!session?.user) return { summary: "Unauthorized", recommendations: [], savingsPotential: 0 };
    return await TelemetryService.time("SpendAnalysis", "analyzeSpend", async () => {
        console.log("Starting analyzeSpend...");
        const context = await getDatabaseContext();
        if (!context) return { summary: "Unable to access database for analysis.", recommendations: [], savingsPotential: 0 };

        const topCategory = context.topCategories[0]?.category || "Unknown";
        const topCategoryAmount = Number(context.topCategories[0]?.total || 0);

        const savingsResult = await db.select({ total: sum(procurementOrders.savingsAmount) }).from(procurementOrders);
        const actualSavings = Number(savingsResult[0]?.total || 0);

        const recommendations = [];
        if (context.riskySuppliers.length > 0) {
            recommendations.push(`Monitor ${context.riskySuppliers.length} high-risk suppliers like ${context.riskySuppliers[0].name}.`);
        }
        recommendations.push(`Consolidate spending in '${topCategory}' to negotiate better volume discounts.`);
        recommendations.push("Review 'sent' orders that haven't moved to 'fulfilled' status.");

        const savingsPotential = actualSavings > 0 ? actualSavings : topCategoryAmount * 0.05; // Fallback to 5% only if no data exists

        await TelemetryService.trackMetric("SpendAnalysis", "potential_savings", savingsPotential);

        return {
            summary: `Total tracked spend is ${context.stats.totalSpend}, primarily driven by ${topCategory}. There are ${context.riskySuppliers.length} suppliers with risk scores above 50.`,
            recommendations,
            savingsPotential,
        };
    });
}

export async function getFullAiInsights() {
    const session = await auth();
    if (!session?.user) return null;
    const context = await getDatabaseContext();
    if (!context) return null;

    try {
        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const prompt = `
            You are a senior procurement analyst at Axiom (a Tacto-like platform).
            Analyze this data and provide:
            1. A 2-sentence executive summary.
            2. 3 actionable cost-saving recommendations.
            3. A risk assessment summary.
            4. 2 ESG/Sustainability suggestions.

            Data:
            ${JSON.stringify(context, null, 2)}

            Output MUST be in valid JSON format:
            {
                "summary": "...",
                "savings": ["...", "...", "..."],
                "riskAnalysis": "...",
                "esgSuggestions": ["...", "..."],
                "potentialSavingsAmount": number
            }
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid AI response format");
    } catch (error) {
        console.warn("AI Insight failed, using deterministic fallback:", error);

        // Deterministic Fallback (Heuristic based analysis)
        const topCat = context.topCategories[0]?.category || "General";
        const riskyCount = context.riskySuppliers.length;
        const totalNum = parseInt(context.stats.totalSpend.replace(/[^0-9]/g, '')) || 0;

        return {
            summary: `Automated Assessment: Spend is focused in ${topCat}. ${riskyCount} suppliers require immediate risk review (Score > 50).`,
            savings: [
                `Consolidate demand in '${topCat}' for volume discounts.`,
                `Transition from spot orders to Framework Agreements for high-frequency parts.`,
                "Audit recent freight expenses for redundant logistics costs."
            ],
            riskAnalysis: `${riskyCount} suppliers are currently flagged as high-risk. Recommend performing an on-site audit for ${context.riskySuppliers[0]?.name || 'top risky vendors'}.`,
            esgSuggestions: [
                "Map carbon footprint for 'Tier 1' suppliers to align with ISO 20400.",
                "Request Modern Slavery Statements from top 5 strategic vendors."
            ],
            potentialSavingsAmount: totalNum * 0.05
        };
    }
}

// ──────────────────────────────────────────────────────────
// Copilot Function-Calling Tools (Gemini Tool Use)
// ──────────────────────────────────────────────────────────
type CopilotMessage = { role: 'user' | 'assistant'; content: string };
type CopilotSessionUser = {
    id?: string;
    role?: string | null;
    supplierId?: string | null;
    name?: string | null;
};

type CopilotEntityKind =
    | 'supplier'
    | 'part'
    | 'contact'
    | 'user'
    | 'invoice'
    | 'order'
    | 'document'
    | 'contract'
    | 'cost_center';

type KnowledgeEntry = {
    question: string;
    answer: string;
    source: string;
    route?: string;
    keywords?: string[];
};

const EXTRA_COPILOT_KNOWLEDGE: KnowledgeEntry[] = [
    {
        question: "What is Exception Management?",
        answer: "Exception Management is Axiom's quarantine route for blocked releases, receipt mismatches, finance holds, and other dirty operational data that cannot flow through the happy path.",
        source: "Product Knowledge -> Exception Management",
        route: "/sourcing/exceptions",
        keywords: ["exception management", "quarantine", "dirty data", "mismatch"],
    },
    {
        question: "What is Scenario Modeling?",
        answer: "Scenario Modeling runs deterministic what-if analysis over live Axiom baselines such as supplier risk, invoice currency exposure, open orders, and finance settings. Teams can test price shocks, FX moves, volume changes, supplier switches, and lead-time drift before acting.",
        source: "Product Knowledge -> Scenario Modeling",
        route: "/admin/scenarios",
        keywords: ["scenario modeling", "what if", "price shock", "currency fluctuation", "lead time drift"],
    },
    {
        question: "What is the difference between Book View and Local View?",
        answer: "Book View converts records into the configured reporting currency using fixed reporting-book rates for stable finance rollups. Local View converts display amounts into the operator's local working currency so regional teams read spend in their own operating lens.",
        source: "Product Knowledge -> Currency Lens",
        route: "/admin/settings",
        keywords: ["book view", "local view", "reporting lens", "currency lens", "fx lens"],
    },
    {
        question: "How do Guarded Imports work?",
        answer: "Guarded Imports use dry runs, schema validation, and field-level checks before supplier, part, or invoice data reaches the live database. The goal is to stop malformed or poisoned files before they affect operations.",
        source: "Product Knowledge -> Guarded Imports",
        route: "/admin/import",
        keywords: ["guarded import", "dry run", "schema validation", "csv upload"],
    },
    {
        question: "How do escalation channels work?",
        answer: "Escalation channels are reserved for immediate issues. Triggering one creates an in-app alert and a high-priority email handoff so the named owner knows this needs attention now, not later.",
        source: "Product Knowledge -> Escalation Channels",
        route: "/",
        keywords: ["escalation", "high priority", "in-app alert", "email handoff"],
    },
    {
        question: "How do invoice disputes and release control work?",
        answer: "Axiom keeps invoice release deterministic. Matching state, fraud alerts, and open review tasks decide whether payment release can proceed or whether the invoice must stay in review or dispute.",
        source: "Product Knowledge -> Invoice Controls",
        route: "/sourcing/invoices",
        keywords: ["invoice dispute", "release payment", "review task", "matched invoice"],
    },
];

const SEARCH_STOP_WORDS = new Set([
    "a", "an", "and", "any", "are", "at", "be", "by", "can", "do", "for", "from",
    "give", "help", "how", "i", "in", "into", "is", "it", "me", "my", "of", "on",
    "or", "please", "show", "tell", "the", "their", "there", "this", "to", "us",
    "what", "when", "where", "which", "who", "why", "with", "would",
]);

const ENTITY_KEYWORDS: Record<CopilotEntityKind, string[]> = {
    supplier: ["supplier", "suppliers", "vendor", "vendors"],
    part: ["part", "parts", "product", "products", "sku", "item", "items"],
    contact: ["contact", "contacts", "email", "emails", "phone", "phones"],
    user: ["user", "users", "admin", "admins", "buyer", "buyers", "employee", "employees"],
    invoice: ["invoice", "invoices", "bill", "bills", "payable", "payment"],
    order: ["order", "orders", "po", "purchase order", "purchase orders"],
    document: ["document", "documents", "file", "files", "attachment", "attachments"],
    contract: ["contract", "contracts", "agreement", "agreements"],
    cost_center: ["cost center", "cost centre", "cost centers", "cost centres", "budget code"],
};

const SUPPORTED_INVOICE_CURRENCIES = ["INR", "USD", "EUR", "GBP", "SGD", "AED"];

function normalizeSearchText(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenizeSearch(value: string) {
    return [...new Set(
        normalizeSearchText(value)
            .split(/\s+/)
            .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token))
    )];
}

function formatDateValue(value: Date | string | null | undefined) {
    if (!value) return "Not set";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
}

function formatMoneyValue(amount: number | string | null | undefined, currency = "INR") {
    const numeric = typeof amount === "number" ? amount : Number(amount ?? 0);
    if (!Number.isFinite(numeric)) return "Not set";
    try {
        return new Intl.NumberFormat("en", {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
        }).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString("en-US")}`;
    }
}

function wantsListResponse(query: string) {
    return /\b(list|show|find|search|which|who|display)\b/i.test(query);
}

function wantsCountResponse(query: string) {
    return /\b(how many|count|number of)\b/i.test(query);
}

function wantsContactFields(query: string) {
    return /\b(email|phone|contact|contacts|reach|call)\b/i.test(query);
}

function wantsCreateInvoiceFromDocument(query: string) {
    return /\b(create|log|record|save)\b.*\binvoice\b/i.test(query) || /\binvoice\b.*\b(create|log|record|save)\b/i.test(query);
}

function detectRequestedKinds(query: string) {
    const normalized = normalizeSearchText(query);
    return Object.entries(ENTITY_KEYWORDS)
        .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeSearchText(keyword))))
        .map(([kind]) => kind as CopilotEntityKind);
}

function scoreCandidate(query: string, ...fields: Array<string | number | null | undefined>) {
    const tokens = tokenizeSearch(query);
    const haystack = normalizeSearchText(fields.filter(Boolean).join(" "));
    if (!haystack) return 0;

    let score = 0;
    for (const token of tokens) {
        if (haystack.includes(token)) score += 6;
    }

    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length > 2 && haystack.includes(normalizedQuery)) {
        score += 20;
    }

    return score;
}

function buildMarkdownTable(headers: string[], rows: string[][]) {
    if (rows.length === 0) return "";
    const header = `| ${headers.join(" | ")} |`;
    const divider = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
    return `${header}\n${divider}\n${body}`;
}

async function resolveSupplierIdByName(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const results = await db.select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(ilike(suppliers.name, `%${trimmed}%`))
        .limit(1);
    return results[0]?.id || null;
}

async function getCopilotWorkspaceSnapshot(sessionUser?: CopilotSessionUser | null) {
    const scopedSupplierId = sessionUser?.role === "supplier" ? sessionUser.supplierId || null : null;

    const [
        supplierRows,
        partRows,
        contactRows,
        userRows,
        invoiceRows,
        orderRows,
        documentRows,
        contractRows,
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
            countryCode: suppliers.countryCode,
            city: suppliers.city,
            categories: suppliers.categories,
            segment: suppliers.segment,
            createdAt: suppliers.createdAt,
        })
            .from(suppliers)
            .where(scopedSupplierId ? eq(suppliers.id, scopedSupplierId) : undefined)
            .orderBy(desc(suppliers.createdAt))
            .limit(250),
        db.select({
            id: parts.id,
            sku: parts.sku,
            name: parts.name,
            description: parts.description,
            category: parts.category,
            price: parts.price,
            stockLevel: parts.stockLevel,
            reorderPoint: parts.reorderPoint,
            marketTrend: parts.marketTrend,
            createdAt: parts.createdAt,
        })
            .from(parts)
            .orderBy(desc(parts.createdAt))
            .limit(250),
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
            status: contacts.status,
            supplierId: contacts.supplierId,
            supplierName: suppliers.name,
            createdAt: contacts.createdAt,
        })
            .from(contacts)
            .leftJoin(suppliers, eq(contacts.supplierId, suppliers.id))
            .where(scopedSupplierId ? eq(contacts.supplierId, scopedSupplierId) : undefined)
            .orderBy(desc(contacts.createdAt))
            .limit(250),
        scopedSupplierId
            ? Promise.resolve([])
            : db.select({
                id: users.id,
                name: users.name,
                email: users.email,
                phoneNumber: users.phoneNumber,
                role: users.role,
                department: users.department,
                employeeId: users.employeeId,
                createdAt: users.createdAt,
            })
                .from(users)
                .orderBy(desc(users.createdAt))
                .limit(200),
        getInvoices(),
        db.select({
            id: procurementOrders.id,
            totalAmount: procurementOrders.totalAmount,
            status: procurementOrders.status,
            carrier: procurementOrders.carrier,
            trackingNumber: procurementOrders.trackingNumber,
            estimatedArrival: procurementOrders.estimatedArrival,
            createdAt: procurementOrders.createdAt,
            supplierId: procurementOrders.supplierId,
            supplierName: suppliers.name,
        })
            .from(procurementOrders)
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(scopedSupplierId ? eq(procurementOrders.supplierId, scopedSupplierId) : undefined)
            .orderBy(desc(procurementOrders.createdAt))
            .limit(250),
        db.select({
            id: documents.id,
            name: documents.name,
            type: documents.type,
            url: documents.url,
            supplierId: documents.supplierId,
            supplierName: suppliers.name,
            createdAt: documents.createdAt,
        })
            .from(documents)
            .leftJoin(suppliers, eq(documents.supplierId, suppliers.id))
            .where(scopedSupplierId ? eq(documents.supplierId, scopedSupplierId) : undefined)
            .orderBy(desc(documents.createdAt))
            .limit(250),
        db.select({
            id: contracts.id,
            title: contracts.title,
            type: contracts.type,
            status: contracts.status,
            value: contracts.value,
            validFrom: contracts.validFrom,
            validTo: contracts.validTo,
            supplierId: contracts.supplierId,
            supplierName: suppliers.name,
            createdAt: contracts.createdAt,
        })
            .from(contracts)
            .leftJoin(suppliers, eq(contracts.supplierId, suppliers.id))
            .where(scopedSupplierId ? eq(contracts.supplierId, scopedSupplierId) : undefined)
            .orderBy(desc(contracts.createdAt))
            .limit(250),
        db.select({
            id: costCenters.id,
            code: costCenters.code,
            name: costCenters.name,
            description: costCenters.description,
            department: costCenters.department,
            isActive: costCenters.isActive,
            createdAt: costCenters.createdAt,
        })
            .from(costCenters)
            .orderBy(desc(costCenters.createdAt))
            .limit(200),
    ]);

    return {
        suppliers: supplierRows,
        parts: partRows,
        contacts: contactRows,
        users: userRows,
        invoices: invoiceRows,
        orders: orderRows,
        documents: documentRows,
        contracts: contractRows,
        costCenters: costCenterRows,
    };
}

function buildKnowledgeEntries() {
    const productKnowledge = getCopilotKnowledgeContext();
    const faqEntries: KnowledgeEntry[] = SUPPORT_FAQS.map((faq) => ({
        question: faq.q,
        answer: faq.a,
        source: "Support FAQ",
        keywords: tokenizeSearch(faq.q),
    }));

    const moduleEntries: KnowledgeEntry[] = productKnowledge.modules.map((module) => ({
        question: module.label,
        answer: module.description,
        source: `Product Module -> ${module.label}`,
        route: module.route,
        keywords: tokenizeSearch(`${module.label} ${module.description}`),
    }));

    const workflowEntries: KnowledgeEntry[] = productKnowledge.workflows.map((workflow) => ({
        question: workflow.name,
        answer: `${workflow.summary} Next steps: ${workflow.actions.join("; ")}.`,
        source: `Product Workflow -> ${workflow.name}`,
        keywords: tokenizeSearch(`${workflow.name} ${workflow.summary} ${workflow.actions.join(" ")}`),
    }));

    const agentEntries: KnowledgeEntry[] = productKnowledge.agents.map((agent) => ({
        question: agent.displayName,
        answer: `${agent.description} Category: ${agent.category}. Triggering patterns: ${agent.triggers.join(", ")}.`,
        source: `AI Agent -> ${agent.displayName}`,
        route: "/admin/agents",
        keywords: tokenizeSearch(`${agent.displayName} ${agent.description} ${agent.triggers.join(" ")}`),
    }));

    return [...EXTRA_COPILOT_KNOWLEDGE, ...faqEntries, ...moduleEntries, ...workflowEntries, ...agentEntries];
}

const copilotFunctionDeclarations: never[] = [];

async function executeCopilotFunction(
    fnName: string,
    args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    switch (fnName) {
        case "create_invoice": {
            let supplierId = args.supplierId as string | undefined;
            if (!supplierId && typeof args.supplierName === "string") {
                supplierId = await resolveSupplierIdByName(args.supplierName) || undefined;
            }
            if (!supplierId) {
                return { success: false, error: "Supplier ID is required. Please specify a supplier name or ID." };
            }
            return await createInvoice({
                supplierId,
                invoiceNumber: String(args.invoiceNumber || ""),
                amount: Number(args.amount),
                currency: typeof args.currency === "string" ? args.currency : "INR",
                invoiceDate: typeof args.invoiceDate === "string" ? args.invoiceDate : undefined,
                dueDate: typeof args.dueDate === "string" ? args.dueDate : undefined,
                taxAmount: typeof args.taxAmount === "number" ? args.taxAmount : undefined,
                subtotal: typeof args.subtotal === "number" ? args.subtotal : undefined,
                paymentTerms: typeof args.paymentTerms === "string" ? args.paymentTerms : undefined,
                purchaseOrderRef: typeof args.purchaseOrderRef === "string" ? args.purchaseOrderRef : undefined,
            });
        }
        case "search_invoices": {
            const results = await getInvoices({
                invoiceNumber: typeof args.invoiceNumber === "string" ? args.invoiceNumber : undefined,
                status: typeof args.status === "string" ? args.status : undefined,
                currency: typeof args.currency === "string" ? args.currency : undefined,
                country: typeof args.country === "string" ? args.country : undefined,
                dateFrom: typeof args.dateFrom === "string" ? args.dateFrom : undefined,
                dateTo: typeof args.dateTo === "string" ? args.dateTo : undefined,
            });
            return { success: true, data: results.slice(0, 20) };
        }
        default:
            return { success: false, error: `Unknown function: ${fnName}` };
    }
}

type WorkspaceSnapshot = Awaited<ReturnType<typeof getCopilotWorkspaceSnapshot>>;
type SearchHit = { kind: CopilotEntityKind; score: number; title: string; record: Record<string, unknown> };

function buildWorkspaceCountTable(snapshot: WorkspaceSnapshot) {
    return buildMarkdownTable(
        ["Entity", "Visible Count"],
        [
            ["Suppliers", String(snapshot.suppliers.length)],
            ["Parts", String(snapshot.parts.length)],
            ["Contacts", String(snapshot.contacts.length)],
            ["Users", String(snapshot.users.length)],
            ["Invoices", String(snapshot.invoices.length)],
            ["Orders", String(snapshot.orders.length)],
            ["Documents", String(snapshot.documents.length)],
            ["Contracts", String(snapshot.contracts.length)],
            ["Cost Centers", String(snapshot.costCenters.length)],
        ]
    );
}

function findBestKnowledgeEntry(query: string) {
    const entries = buildKnowledgeEntries();
    const ranked = entries
        .map((entry) => ({
            entry,
            score: scoreCandidate(query, entry.question, entry.answer, entry.route, entry.keywords?.join(" ")),
        }))
        .filter((result) => result.score > 0)
        .sort((left, right) => right.score - left.score);

    return ranked[0]?.score >= 12 ? ranked[0].entry : null;
}

function extractInvoiceLookupFilters(query: string) {
    const currencyMatch = query.toUpperCase().match(/\b(INR|USD|EUR|GBP|SGD|AED)\b/);
    const invoiceNumberMatch = query.match(/\b(?:invoice|inv)[^A-Za-z0-9]{0,3}([A-Za-z0-9./-]{3,})\b/i);
    const status = ["pending", "matched", "disputed", "paid"].find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(query));

    return {
        invoiceNumber: invoiceNumberMatch?.[1],
        status,
        currency: currencyMatch && SUPPORTED_INVOICE_CURRENCIES.includes(currencyMatch[1]) ? currencyMatch[1] : undefined,
    };
}

function formatInvoiceRows(rows: Awaited<ReturnType<typeof getInvoices>>) {
    return buildMarkdownTable(
        ["Invoice", "Supplier", "Status", "Amount", "Invoice Date"],
        rows.slice(0, 8).map((invoice) => ([
            invoice.invoiceNumber,
            invoice.supplierName || "Unknown supplier",
            invoice.status || "unknown",
            formatMoneyValue(invoice.amount, invoice.currency || "INR"),
            formatDateValue(invoice.invoiceDate),
        ]))
    );
}

async function maybeHandleInvoiceLookup(query: string) {
    if (!/\binvoice|invoices|bill|bills\b/i.test(query)) {
        return null;
    }

    if (!/\b(find|show|list|search|lookup|pending|matched|disputed|paid)\b/i.test(query)) {
        return null;
    }

    const filters = extractInvoiceLookupFilters(query);
    const rows = await getInvoices(filters);

    if (rows.length === 0) {
        return "I checked the visible invoice records and did not find a match for that filter set.\n\n(Source: Workspace -> Invoices)";
    }

    return [
        "I pulled the matching invoices directly from the Axiom workspace.",
        formatInvoiceRows(rows),
        "(Source: Workspace -> Invoices)",
    ].join("\n\n");
}

function collectWorkspaceHits(query: string, snapshot: WorkspaceSnapshot) {
    const requestedKinds = detectRequestedKinds(query);
    const restrictToRequested = requestedKinds.length > 0;
    const hits: SearchHit[] = [];

    const addHit = (kind: CopilotEntityKind, title: string, record: Record<string, unknown>, ...fields: Array<string | number | null | undefined>) => {
        if (restrictToRequested && !requestedKinds.includes(kind)) return;
        const score = scoreCandidate(query, title, ...fields);
        if (score > 0) {
            hits.push({ kind, title, record, score });
        }
    };

    snapshot.suppliers.forEach((supplier) => addHit(
        "supplier",
        supplier.name,
        supplier as unknown as Record<string, unknown>,
        supplier.name,
        supplier.contactEmail,
        supplier.countryCode,
        supplier.city,
        supplier.categories?.join(" "),
        supplier.segment,
        supplier.status,
        supplier.lifecycleStatus,
        supplier.riskScore,
    ));
    snapshot.parts.forEach((part) => addHit(
        "part",
        part.name,
        part as unknown as Record<string, unknown>,
        part.name,
        part.sku,
        part.description,
        part.category,
        part.marketTrend,
    ));
    snapshot.contacts.forEach((contact) => addHit(
        "contact",
        contact.name,
        contact as unknown as Record<string, unknown>,
        contact.name,
        contact.email,
        contact.phone,
        contact.company,
        contact.jobTitle,
        contact.supplierName,
    ));
    snapshot.users.forEach((user) => addHit(
        "user",
        user.name,
        user as unknown as Record<string, unknown>,
        user.name,
        user.email,
        user.phoneNumber,
        user.role,
        user.department,
        user.employeeId,
    ));
    snapshot.invoices.forEach((invoice) => addHit(
        "invoice",
        invoice.invoiceNumber,
        invoice as unknown as Record<string, unknown>,
        invoice.invoiceNumber,
        invoice.supplierName,
        invoice.currency,
        invoice.status,
        invoice.country,
        invoice.region,
        invoice.purchaseOrderRef,
    ));
    snapshot.orders.forEach((order) => addHit(
        "order",
        String(order.id),
        order as unknown as Record<string, unknown>,
        order.id,
        order.supplierName,
        order.status,
        order.carrier,
        order.trackingNumber,
    ));
    snapshot.documents.forEach((document) => addHit(
        "document",
        document.name,
        document as unknown as Record<string, unknown>,
        document.name,
        document.type,
        document.supplierName,
        document.url,
    ));
    snapshot.contracts.forEach((contract) => addHit(
        "contract",
        contract.title,
        contract as unknown as Record<string, unknown>,
        contract.title,
        contract.type,
        contract.status,
        contract.supplierName,
    ));
    snapshot.costCenters.forEach((costCenter) => addHit(
        "cost_center",
        `${costCenter.code} ${costCenter.name}`,
        costCenter as unknown as Record<string, unknown>,
        costCenter.code,
        costCenter.name,
        costCenter.description,
        costCenter.department,
        costCenter.isActive,
    ));

    return hits.sort((left, right) => right.score - left.score).slice(0, 8);
}

function renderWorkspaceHitDetail(hit: SearchHit, _query: string) {
    switch (hit.kind) {
        case "supplier": {
            const supplier = hit.record as WorkspaceSnapshot["suppliers"][number];
            return [
                `### Supplier: ${supplier.name}`,
                `- Status: ${supplier.status || "unknown"}`,
                `- Lifecycle: ${supplier.lifecycleStatus || "unknown"}`,
                `- Risk score: ${supplier.riskScore ?? 0}`,
                `- Performance score: ${supplier.performanceScore ?? 0}`,
                `- Contact email: ${supplier.contactEmail || "Not set"}`,
                `- Geography: ${[supplier.city, supplier.countryCode].filter(Boolean).join(", ") || "Not set"}`,
                `- Categories: ${supplier.categories?.join(", ") || "Not set"}`,
                "(Source: Workspace -> Suppliers)",
            ].join("\n");
        }
        case "part": {
            const part = hit.record as WorkspaceSnapshot["parts"][number];
            return [
                `### Part: ${part.name}`,
                `- SKU: ${part.sku}`,
                `- Category: ${part.category}`,
                `- Price: ${formatMoneyValue(part.price, "INR")}`,
                `- Stock level: ${part.stockLevel}`,
                `- Reorder point: ${part.reorderPoint ?? "Not set"}`,
                `- Market trend: ${part.marketTrend || "stable"}`,
                part.description ? `- Description: ${part.description}` : null,
                "(Source: Workspace -> Parts)",
            ].filter(Boolean).join("\n");
        }
        case "contact": {
            const contact = hit.record as WorkspaceSnapshot["contacts"][number];
            return [
                `### Contact: ${contact.name}`,
                `- Email: ${contact.email}`,
                `- Phone: ${contact.phone || "Not set"}`,
                `- Company: ${contact.company || contact.supplierName || "Not set"}`,
                `- Job title: ${contact.jobTitle || "Not set"}`,
                `- Region: ${[contact.region, contact.country].filter(Boolean).join(", ") || "Not set"}`,
                `- Currency lens: ${contact.currency || "INR"}`,
                "(Source: Workspace -> Contacts)",
            ].join("\n");
        }
        case "user": {
            const user = hit.record as WorkspaceSnapshot["users"][number];
            return [
                `### User: ${user.name}`,
                `- Email: ${user.email}`,
                `- Phone: ${user.phoneNumber || "Not set"}`,
                `- Role: ${user.role || "user"}`,
                `- Department: ${user.department || "Not set"}`,
                `- Employee ID: ${user.employeeId || "Not set"}`,
                "(Source: Workspace -> Users)",
            ].join("\n");
        }
        case "invoice": {
            const invoice = hit.record as WorkspaceSnapshot["invoices"][number];
            return [
                `### Invoice: ${invoice.invoiceNumber}`,
                `- Supplier: ${invoice.supplierName || "Unknown supplier"}`,
                `- Status: ${invoice.status || "unknown"}`,
                `- Amount: ${formatMoneyValue(invoice.amount, invoice.currency || "INR")}`,
                `- Invoice date: ${formatDateValue(invoice.invoiceDate)}`,
                `- Due date: ${formatDateValue(invoice.dueDate)}`,
                `- PO reference: ${invoice.purchaseOrderRef || "Not set"}`,
                "(Source: Workspace -> Invoices)",
            ].join("\n");
        }
        case "order": {
            const order = hit.record as WorkspaceSnapshot["orders"][number];
            return [
                `### Order: ${String(order.id).slice(0, 8).toUpperCase()}`,
                `- Supplier: ${order.supplierName || "Unknown supplier"}`,
                `- Status: ${order.status || "unknown"}`,
                `- Total amount: ${formatMoneyValue(order.totalAmount, "INR")}`,
                `- Carrier: ${order.carrier || "Not set"}`,
                `- Tracking number: ${order.trackingNumber || "Not set"}`,
                `- Estimated arrival: ${formatDateValue(order.estimatedArrival)}`,
                "(Source: Workspace -> Orders)",
            ].join("\n");
        }
        case "document": {
            const document = hit.record as WorkspaceSnapshot["documents"][number];
            return [
                `### Document: ${document.name}`,
                `- Type: ${document.type || "other"}`,
                `- Supplier: ${document.supplierName || "Unknown supplier"}`,
                `- URL: ${document.url || "Not set"}`,
                `- Created: ${formatDateValue(document.createdAt)}`,
                "(Source: Workspace -> Documents)",
            ].join("\n");
        }
        case "contract": {
            const contract = hit.record as WorkspaceSnapshot["contracts"][number];
            return [
                `### Contract: ${contract.title}`,
                `- Supplier: ${contract.supplierName || "Unknown supplier"}`,
                `- Type: ${contract.type || "one_off"}`,
                `- Status: ${contract.status || "draft"}`,
                `- Value: ${formatMoneyValue(contract.value, "INR")}`,
                `- Validity: ${formatDateValue(contract.validFrom)} to ${formatDateValue(contract.validTo)}`,
                "(Source: Workspace -> Contracts)",
            ].join("\n");
        }
        case "cost_center": {
            const costCenter = hit.record as WorkspaceSnapshot["costCenters"][number];
            return [
                `### Cost Center: ${costCenter.code}`,
                `- Name: ${costCenter.name}`,
                `- Department: ${costCenter.department || "Not set"}`,
                `- Status: ${costCenter.isActive === "yes" ? "Active" : "Inactive"}`,
                costCenter.description ? `- Description: ${costCenter.description}` : null,
                "(Source: Workspace -> Cost Centers)",
            ].filter(Boolean).join("\n");
        }
        default:
            return `I found ${hit.title} in the visible workspace data.\n\n(Source: Workspace)`;
    }
}

function renderWorkspaceHitList(hits: SearchHit[]) {
    return buildMarkdownTable(
        ["Entity", "Match", "Key Detail", "Source"],
        hits.slice(0, 6).map((hit) => {
            if (hit.kind === "supplier") {
                const supplier = hit.record as WorkspaceSnapshot["suppliers"][number];
                return ["Supplier", supplier.name, `Risk ${supplier.riskScore ?? 0} · ${supplier.contactEmail}`, "Suppliers"];
            }
            if (hit.kind === "part") {
                const part = hit.record as WorkspaceSnapshot["parts"][number];
                return ["Part", part.name, `${part.sku} · ${part.category}`, "Parts"];
            }
            if (hit.kind === "contact") {
                const contact = hit.record as WorkspaceSnapshot["contacts"][number];
                return ["Contact", contact.name, `${contact.email} · ${contact.company || contact.supplierName || "No company"}`, "Contacts"];
            }
            if (hit.kind === "user") {
                const user = hit.record as WorkspaceSnapshot["users"][number];
                return ["User", user.name, `${user.email} · ${user.role || "user"}`, "Users"];
            }
            if (hit.kind === "invoice") {
                const invoice = hit.record as WorkspaceSnapshot["invoices"][number];
                return ["Invoice", invoice.invoiceNumber, `${invoice.supplierName || "Unknown"} · ${invoice.status}`, "Invoices"];
            }
            if (hit.kind === "order") {
                const order = hit.record as WorkspaceSnapshot["orders"][number];
                return ["Order", String(order.id).slice(0, 8).toUpperCase(), `${order.supplierName || "Unknown"} · ${order.status}`, "Orders"];
            }
            if (hit.kind === "document") {
                const document = hit.record as WorkspaceSnapshot["documents"][number];
                return ["Document", document.name, `${document.type || "other"} · ${document.supplierName || "Unknown"}`, "Documents"];
            }
            if (hit.kind === "contract") {
                const contract = hit.record as WorkspaceSnapshot["contracts"][number];
                return ["Contract", contract.title, `${contract.status || "draft"} · ${contract.supplierName || "Unknown"}`, "Contracts"];
            }
            const costCenter = hit.record as WorkspaceSnapshot["costCenters"][number];
            return ["Cost Center", costCenter.code, `${costCenter.name} · ${costCenter.department || "No department"}`, "Cost Centers"];
        })
    );
}

function answerFromWorkspaceSnapshot(query: string, snapshot: WorkspaceSnapshot) {
    if (/\bcustomer|customers\b/i.test(query)) {
        return [
            "Axiom does not currently expose a dedicated `customers` table in this workspace snapshot.",
            "The closest live entities I can answer from are suppliers, contacts, users, invoices, orders, documents, contracts, and cost centers.",
            "(Source: Workspace Schema)",
        ].join("\n\n");
    }

    if (wantsCountResponse(query) || /\b(database|workspace data|what data can you see)\b/i.test(query)) {
        return [
            "Here is the current visible database footprint for this session.",
            buildWorkspaceCountTable(snapshot),
            "(Source: Workspace Snapshot)",
        ].join("\n\n");
    }

    const hits = collectWorkspaceHits(query, snapshot);
    if (hits.length === 0) {
        return null;
    }

    if (wantsListResponse(query) || hits.length > 1) {
        if (wantsContactFields(query) && hits[0].kind === "contact") {
            return renderWorkspaceHitDetail(hits[0], query);
        }

        return [
            "I searched the live Axiom workspace for the closest matching records.",
            renderWorkspaceHitList(hits),
            "(Source: Workspace Snapshot)",
        ].join("\n\n");
    }

    return renderWorkspaceHitDetail(hits[0], query);
}

function formatOfflineCurrency(value: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

function buildOfflineCopilotResponse(
    query: string,
    context: Awaited<ReturnType<typeof getDatabaseContext>>
) {
    const intro = "Axiom Copilot is running in guided demo mode right now because live AI generation is unavailable. I can still answer from the current Axiom workspace snapshot.";

    if (!context) {
        return [
            intro,
            "I could not read the current workspace data snapshot, so the safest next step is to open the target module directly from the sidebar and verify the latest records there.",
            "Best modules to demo next: Suppliers, Orders, Invoices, Spend Intelligence, Risk Intelligence, and Tasks.",
        ].join("\n\n");
    }

    const normalizedQuery = query.toLowerCase();
    const topCategory = context.topCategories[0];
    const topRiskySupplier = context.riskySuppliers[0];
    const recentOrder = context.recentOrders[0];
    const summaryLine = `Current snapshot: ${context.stats.suppliers} suppliers, ${context.stats.parts} parts, ${context.stats.orders} orders, and total tracked spend of ${context.stats.totalSpend}.`;

    if (/(graph|chart|visual)/.test(normalizedQuery) && context.topCategories.length > 0) {
        const chart = {
            type: "chart",
            chartType: "bar",
            title: "Top Spend Categories",
            data: context.topCategories.map((category) => ({
                name: category.category,
                value: Number(category.total || 0),
            })),
            xAxisKey: "name",
            keys: ["value"],
            insight: `${topCategory?.category || "Top category"} is currently leading the spend profile.`,
        };

        return [
            intro,
            summaryLine,
            "```json",
            JSON.stringify(chart, null, 2),
            "```",
            "(Source: Database Stats)",
        ].join("\n");
    }

    if (/(spend|saving|cost|price|budget)/.test(normalizedQuery)) {
        return [
            intro,
            summaryLine,
            topCategory
                ? `Spend focus: ${topCategory.category} is the top tracked category at ${formatOfflineCurrency(Number(topCategory.total || 0))}.`
                : "Spend focus: no category breakdown is available in the current snapshot.",
            topRiskySupplier
                ? `Risk note: ${topRiskySupplier.name} is the highest-risk visible supplier with a score of ${topRiskySupplier.score}.`
                : "Risk note: no supplier is currently above the high-risk threshold in this snapshot.",
            "Best demo next steps: open Spend Intelligence for the portfolio view, Savings for realized impact, and Sourcing Orders for line-level drill-down.",
            "(Source: Database Stats)",
        ].join("\n\n");
    }

    if (/(risk|fraud|compliance|issue|alert)/.test(normalizedQuery)) {
        return [
            intro,
            summaryLine,
            topRiskySupplier
                ? `Highest visible risk: ${topRiskySupplier.name} is currently flagged at ${topRiskySupplier.score}.`
                : "Highest visible risk: no supplier is currently above the configured high-risk threshold.",
            "Best demo next steps: open Risk Intelligence for supplier risk posture, Fraud Alerts for anomaly triage, and Compliance for expiring obligations and evidence gaps.",
            "(Source: Database Stats)",
        ].join("\n\n");
    }

    if (/(invoice|payment|receipt|match|payable)/.test(normalizedQuery)) {
        return [
            intro,
            summaryLine,
            recentOrder
                ? `Most recent visible order: ${recentOrder.id.slice(0, 8).toUpperCase()} is currently ${recentOrder.status} with a value of ${formatOfflineCurrency(Number(recentOrder.amount || 0))}.`
                : "There is no recent order visible in the current snapshot.",
            "Best demo next steps: open Invoice Records for document capture, Financial Matching for three-way match review, and Transactions for a unified finance trail.",
            "(Source: Database Stats)",
        ].join("\n\n");
    }

    if (/(supplier|vendor|source|rfq|order|contract)/.test(normalizedQuery)) {
        return [
            intro,
            summaryLine,
            topCategory
                ? `Current sourcing signal: ${topCategory.category} is the strongest spend concentration to talk through in the demo.`
                : "Current sourcing signal: use Orders, RFQs, and Contracts to walk through the end-to-end process.",
            "Best demo next steps: Suppliers for profile and scorecards, RFQs for competitive events, Orders for execution, and Contracts for governance.",
            "(Source: Database Stats)",
        ].join("\n\n");
    }

    return [
        intro,
        summaryLine,
        topCategory
            ? `A good starting story is ${topCategory.category}, since it anchors the current spend profile.`
            : "A good starting story is the main dashboard, then drill into suppliers, orders, and invoices.",
        "If you want, ask about spend, supplier risk, invoices, sourcing workflows, or request a chart and I will answer from the current snapshot.",
        "(Source: Database Stats)",
    ].join("\n\n");
}

export async function processCopilotQuery(
    query: string,
    history: CopilotMessage[] = [],
    attachment?: { data: string; name: string; mimeType?: string }
) {
    return await TelemetryService.time("AxiomCopilot", "processQuery", async () => {
        const session = await auth();
        if (!session?.user?.id) {
            return "Unauthorized. Please sign in to use Axiom Copilot.";
        }

        const context = await getDatabaseContext();
        const productKnowledge = getCopilotKnowledgeContext();
        const workspace = await getCopilotWorkspaceSnapshot(session.user);
        try {
            const normalizedQuery = query.toLowerCase();

            if (attachment && attachment.data) {
                return await processDocumentAttachment(query, attachment, context, history, session.user, workspace);
            }

            // Fast-path operational intents: allow Copilot to run AI agents directly.
            const agentIntentMap: Array<{ keywords: string[]; agentName: import("./agents").AgentName; label: string }> = [
                { keywords: ['run fraud', 'fraud scan', 'fraud detection'], agentName: 'fraud-detection', label: 'Fraud Detection' },
                { keywords: ['run payment', 'optimize payment', 'payment optimizer'], agentName: 'payment-optimizer', label: 'Payment Optimizer' },
                { keywords: ['run demand', 'demand forecast', 'forecast demand'], agentName: 'demand-forecasting', label: 'Demand Forecasting' },
                { keywords: ['run bottleneck', 'workflow bottleneck'], agentName: 'predictive-bottleneck', label: 'Predictive Bottleneck' },
                { keywords: ['run remediation', 'auto remediation'], agentName: 'auto-remediation', label: 'Auto-Remediation' },
            ];

            const matchedIntent = agentIntentMap.find((intent) =>
                intent.keywords.some((keyword) => normalizedQuery.includes(keyword))
            );

            if (matchedIntent) {
                const agentResult = await triggerAgentDispatch(matchedIntent.agentName);
                const directResponse = agentResult.success
                    ? `Executed ${matchedIntent.label} successfully.\n\nResult: ${agentResult.summary.details || agentResult.reasoning || 'Run completed.'}`
                    : `I attempted to run ${matchedIntent.label}, but it needs attention: ${agentResult.summary.details || agentResult.error || 'Unknown error'}${agentResult.dashboardHref ? `\n\nNext best route: ${agentResult.dashboardHref}` : ''}`;

                await saveChatMessage('user', query);
                await saveChatMessage('assistant', directResponse);
                return directResponse;
            }

            const invoiceLookup = await maybeHandleInvoiceLookup(query);
            if (invoiceLookup) {
                await saveChatMessage('user', query);
                await saveChatMessage('assistant', invoiceLookup);
                await TelemetryService.trackEvent("AxiomCopilot", "invoice_lookup", { query_length: query.length });
                return invoiceLookup;
            }

            const workspaceAnswer = answerFromWorkspaceSnapshot(query, workspace);
            if (workspaceAnswer) {
                await saveChatMessage('user', query);
                await saveChatMessage('assistant', workspaceAnswer);
                await TelemetryService.trackEvent("AxiomCopilot", "workspace_answer", { query_length: query.length });
                return workspaceAnswer;
            }

            const knowledgeEntry = findBestKnowledgeEntry(query);
            if (knowledgeEntry) {
                const knowledgeResponse = [
                    knowledgeEntry.answer,
                    knowledgeEntry.route ? `Best route: \`${knowledgeEntry.route}\`` : null,
                    `(Source: ${knowledgeEntry.source})`,
                ].filter(Boolean).join("\n\n");

                await saveChatMessage('user', query);
                await saveChatMessage('assistant', knowledgeResponse);
                await TelemetryService.trackEvent("AxiomCopilot", "knowledge_answer", { query_length: query.length });
                return knowledgeResponse;
            }

            const deterministicFallback = buildOfflineCopilotResponse(query, context);
            await saveChatMessage('user', query);
            await saveChatMessage('assistant', deterministicFallback);
            await TelemetryService.trackEvent("AxiomCopilot", "fallback_answer", { query_length: query.length });
            return deterministicFallback;

            const model = await getAiModel("gemini-2.5-flash", {
                tools: [{ functionDeclarations: copilotFunctionDeclarations }],
            });
            if (!model) throw new Error("AI model not available");
            const historyContext = history.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            const prompt = `
                You are Axiom Copilot, an analytical and efficient procurement AI. 
                Your role is to help users manage their supply chain, analyze spend, mitigate risk, understand how the Axiom app works, and reason over uploaded business files.
                You can also CREATE invoices and SEARCH invoices using the tools provided. When a user asks you to log, record, or create an invoice, use the create_invoice tool. When they ask to find or list invoices, use the search_invoices tool.
                 
                Database State (Snapshot):
                ${JSON.stringify(context, null, 2)}

                Product Knowledge:
                ${JSON.stringify(productKnowledge, null, 2)}
                 
                Conversation History:
                ${historyContext || "No previous messages."}
                
                Current User Message: "${query}"
                
                RULES:
                1. PERSONALITY: Be direct, professional, and data-driven. Strictly no "fluff".
                2. REPETITION & GREETINGS: 
                   - DO NOT say "I am Axiom Copilot" if there is existing history.
                   - DO NOT use time-of-day greetings (Good morning/afternoon/evening).
                   - If history exists, do NOT say "Hello" or use any greeting—directly answer the query.
                 3. CONTEXT: Maintain awareness of previous messages for follow-up questions.
                 4. VISUALIZATION: 
                    - Use Markdown Tables (GFM) for comparisons or long lists. 
                   - **IMPORTANT**: DO NOT wrap Markdown Tables in triple backticks. Use raw Markdown pipes (|).
                   - When the user asks for a "graph", "chart", or "visual", output a JSON code block with language 'json' in this EXACT format:
                   {
                     "type": "chart",
                     "chartType": "bar",
                     "title": "Clear Title",
                     "data": [{"name": "Category X", "value": 100}, {"name": "Category Y", "value": 200}],
                     "xAxisKey": "name",
                     "keys": ["value"],
                     "insight": "Short technical insight."
                   }
                   - Supported chartType values: "bar", "pie", "line", "area", "scatter", "radar"
                   - Use "bar" for comparing categories, "pie" for proportions, "line" for trends over time, "area" for cumulative trends, "scatter" for correlations, "radar" for multi-metric comparison.
                   - Choose the most appropriate chart type for the data being visualized.
                 5. FORMATTING: Use the appropriate currency symbol based on the data context. Default to ₹ for Indian Rupee values.
                 6. GROUNDING & RELIABILITY: 
                    - Answer using the provided "Database State", "Product Knowledge", uploaded file content (if any), and conversation history.
                    - If a user asks about Axiom features, workflows, modules, support processes, or AI agents, answer from "Product Knowledge" even if the exact live database record is unavailable.
                    - If a user asks for an exact live record that is not present in the current data, say that the exact record is not visible in the current snapshot, then give the most relevant workflow, module, agent, or next step instead of stopping there.
                    - DO NOT hallucinate names, numbers, or dates.
                    - When the request is specific or multi-step, reason carefully and provide a concise, actionable answer with bullets or a table.
                    - Cite your sources. Example: "(Source: Database Stats)", "(Source: Product Knowledge → Requisitions)", or "(Source: Uploaded CSV Preview)".
                 7. TOOL USE:
                    - When the user wants to create/log/record an invoice, call the create_invoice function with extracted details.
                    - When the user wants to search/find/list invoices, call the search_invoices function.
                    - After executing a tool, summarize the result to the user clearly.
             `;

            const result = await model!.generateContent(prompt);
            const response = result.response;

            // Check if the model wants to call a function
            const functionCalls = response.functionCalls() || [];
            if (functionCalls.length > 0) {
                const fc = functionCalls[0];
                const fnResult = await executeCopilotFunction(fc.name, fc.args as Record<string, unknown>);

                // Send function result back to the model for a natural language summary
                const followUp = await model!.generateContent([
                    { text: prompt },
                    { functionCall: { name: fc.name, args: fc.args } },
                    { functionResponse: { name: fc.name, response: fnResult } },
                ]);
                const text = followUp.response.text();

                await saveChatMessage('user', query);
                await saveChatMessage('assistant', text);
                await TelemetryService.trackEvent("AxiomCopilot", "function_call_success", { function: fc.name });
                return text;
            }

            const text = response.text();

            await saveChatMessage('user', query);
            await saveChatMessage('assistant', text);
            await TelemetryService.trackEvent("AxiomCopilot", "query_success", { query_length: query.length });

            return text;
        } catch (error: unknown) {
            await TelemetryService.trackError("AxiomCopilot", "query_failed", error, { query });
            const fallback = buildOfflineCopilotResponse(query, context);
            await saveChatMessage('user', query);
            await saveChatMessage('assistant', fallback);
            return fallback;
        }
    }, { query_preview: query.substring(0, 30) });
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const TEXT_ATTACHMENT_EXTENSIONS = new Set(['csv', 'tsv', 'txt', 'json', 'md', 'log']);
const XLSX_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
]);

function getHistoryContext(history: { role: 'user' | 'assistant'; content: string }[], limit = 8) {
    return history.slice(-limit).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
}

function getFileExtension(fileName: string) {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() ?? '' : '';
}

function normalizeAttachmentMimeType(attachment: { name: string; mimeType?: string }) {
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

    const limitedRows = rows.slice(0, 8).map((row) => row.slice(0, 6).map((cell) => sanitizeCell(cell || '')));
    const headerRow = limitedRows[0].map((cell, index) => cell || `Column ${index + 1}`);
    const bodyRows = limitedRows.slice(1);

    const header = `| ${headerRow.join(' | ')} |`;
    const divider = `| ${headerRow.map(() => '---').join(' | ')} |`;
    const body = bodyRows.length > 0
        ? bodyRows.map((row) => `| ${headerRow.map((_, index) => row[index] || '').join(' | ')} |`).join('\n')
        : `| ${headerRow.map(() => '').join(' | ')} |`;

    return `### ${title}\n${header}\n${divider}\n${body}`;
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

        const rows = parseWorksheetRows(worksheetXml, sharedStrings);
        previews.push(formatTablePreview(rows, `${sheetNameMatches[index] || `Sheet ${index + 1}`}`));
    }

    return `## Workbook Preview: ${fileName}\n\n${previews.join('\n\n')}`;
}

async function buildAttachmentPreview(attachment: { data: string; name: string; mimeType?: string }) {
    const fileName = attachment.name;
    const mimeType = normalizeAttachmentMimeType(attachment);
    const extension = getFileExtension(fileName);

    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        return {
            mode: 'inline' as const,
            mimeType,
            contentLabel: fileName,
            extractedText: undefined,
        };
    }

    if (extension === 'xlsx' || XLSX_MIME_TYPES.has(mimeType)) {
        return {
            mode: 'text' as const,
            mimeType,
            contentLabel: 'Uploaded XLSX workbook preview',
            extractedText: await extractSpreadsheetPreview(attachment.data, fileName),
        };
    }

    if (extension === 'xls' || mimeType === 'application/vnd.ms-excel') {
        return {
            mode: 'text' as const,
            mimeType,
            contentLabel: 'Legacy Excel workbook notice',
            extractedText: `The user uploaded a legacy Excel workbook named "${fileName}". Automatic parsing for binary .xls workbooks is limited in this environment, so explain what can be inferred from the filename/context and advise the user to re-upload as .xlsx or .csv for row-level analysis.`,
        };
    }

    const decodedText = Buffer.from(attachment.data, 'base64').toString('utf-8');

    if (extension === 'csv') {
        return {
            mode: 'text' as const,
            mimeType,
            contentLabel: 'Uploaded CSV preview',
            extractedText: buildDelimitedPreview(decodedText, fileName, ','),
        };
    }

    if (extension === 'tsv') {
        return {
            mode: 'text' as const,
            mimeType,
            contentLabel: 'Uploaded TSV preview',
            extractedText: buildDelimitedPreview(decodedText, fileName, '\t'),
        };
    }

    if (TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
        return {
            mode: 'text' as const,
            mimeType,
            contentLabel: `Uploaded ${extension.toUpperCase()} content`,
            extractedText: `## ${fileName}\n\n${decodedText.slice(0, 8000)}`,
        };
    }

    return {
        mode: 'text' as const,
        mimeType,
        contentLabel: 'Uploaded file excerpt',
        extractedText: `## ${fileName}\n\n${decodedText.slice(0, 8000)}`,
    };
}

function findSupplierMatchesByName(name: string | null | undefined, workspace: WorkspaceSnapshot) {
    if (!name) return [];
    return workspace.suppliers
        .map((supplier) => ({
            supplier,
            score: scoreCandidate(name, supplier.name, supplier.contactEmail, supplier.city, supplier.countryCode),
        }))
        .filter((result) => result.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3);
}

function buildDocumentCrossCheckSection(options: {
    supplierName?: string | null;
    invoiceNumber?: string | null;
    purchaseOrderRef?: string | null;
}, workspace: WorkspaceSnapshot) {
    const notes: string[] = [];
    const supplierMatches = findSupplierMatchesByName(options.supplierName, workspace);
    if (supplierMatches.length > 0) {
        notes.push(`- Supplier match: ${supplierMatches[0].supplier.name} (${supplierMatches[0].supplier.contactEmail})`);
    } else if (options.supplierName) {
        notes.push(`- Supplier match: no direct supplier record found for "${options.supplierName}"`);
    }

    if (options.invoiceNumber) {
        const duplicate = workspace.invoices.find((invoice) => invoice.invoiceNumber.toLowerCase() === options.invoiceNumber?.toLowerCase());
        notes.push(duplicate
            ? `- Existing invoice check: ${duplicate.invoiceNumber} already exists for ${duplicate.supplierName || "an existing supplier"}`
            : `- Existing invoice check: no exact invoice number match found for ${options.invoiceNumber}`);
    }

    if (options.purchaseOrderRef) {
        const matchingOrder = workspace.orders.find((order) => String(order.id).toLowerCase().includes(options.purchaseOrderRef!.toLowerCase()));
        notes.push(matchingOrder
            ? `- Order reference check: matched order ${String(matchingOrder.id).slice(0, 8).toUpperCase()}`
            : `- Order reference check: no direct order match found for ${options.purchaseOrderRef}`);
    }

    return notes.length > 0 ? `### Workspace Cross-Check\n${notes.join("\n")}` : null;
}

function buildDeterministicDocumentResponse(fileName: string, sections: Array<string | null | undefined>) {
    return [
        `## Document Analysis: ${fileName}`,
        ...sections.filter(Boolean),
        "(Source: Deterministic Document Parsing + Workspace Snapshot)",
    ].join("\n\n");
}

async function processDocumentAttachment(
    query: string,
    attachment: { data: string; name: string; mimeType?: string },
    context: Awaited<ReturnType<typeof getDatabaseContext>>,
    history: CopilotMessage[],
    _sessionUser: CopilotSessionUser,
    workspace: WorkspaceSnapshot
): Promise<string> {
    const fileName = attachment.name;
    const productKnowledge = getCopilotKnowledgeContext();

    // Validate file size — base64 encoding increases size by ~33% (1/0.75 ≈ 1.37)
    if (attachment.data.length > MAX_FILE_SIZE_BYTES * 1.37) {
        const response = "⚠️ The uploaded file exceeds the 10 MB limit. Please upload a smaller file.";
        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', response);
        return response;
    }

    const mimeType = normalizeAttachmentMimeType(attachment);
    const extension = getFileExtension(fileName);
    const buffer = Buffer.from(attachment.data, 'base64');

    if (mimeType.startsWith('image/')) {
        const response = buildDeterministicDocumentResponse(fileName, [
            "Axiom Copilot is running in deterministic document mode.",
            "Image OCR is not enabled in this grounded path, so I cannot reliably extract text from screenshots or scanned images without introducing hallucinated values.",
            "### Suggested Next Steps\n- Re-upload this document as a searchable PDF.\n- Upload the source CSV/XLSX/TXT if the file started as structured data.\n- Use the relevant invoice, supplier, or import route for manual review.",
        ]);
        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', response);
        return response;
    }

    if (mimeType === 'application/pdf') {
        const invoiceExtraction = await extractInvoiceFromPdfBuffer(fileName, buffer);
        const pdfText = (invoiceExtraction?.text || await extractPdfTextFromBuffer(fileName, buffer) || "").trim();
        const extracted = invoiceExtraction?.data;
        const fieldRows = extracted
            ? [
                ["Supplier", extracted.supplierName || "Not found"],
                ["Invoice Number", extracted.invoiceNumber || "Not found"],
                ["Amount", extracted.amount !== null ? formatMoneyValue(extracted.amount, extracted.currency || "INR") : "Not found"],
                ["Currency", extracted.currency || "Not found"],
                ["Invoice Date", extracted.invoiceDate || "Not found"],
                ["Due Date", extracted.dueDate || "Not found"],
                ["Payment Terms", extracted.paymentTerms || "Not found"],
                ["PO Reference", extracted.purchaseOrderRef || "Not found"],
            ]
            : [];

        let createSection: string | null = null;
        if (extracted && wantsCreateInvoiceFromDocument(query)) {
            const supplierId = await resolveSupplierIdByName(extracted.supplierName || "");
            if (supplierId && extracted.invoiceNumber && extracted.amount !== null) {
                const createResult = await createInvoice({
                    supplierId,
                    invoiceNumber: extracted.invoiceNumber,
                    amount: extracted.amount,
                    currency: extracted.currency || "INR",
                    invoiceDate: extracted.invoiceDate || undefined,
                    dueDate: extracted.dueDate || undefined,
                    taxAmount: extracted.taxAmount ?? undefined,
                    subtotal: extracted.subtotal ?? undefined,
                    paymentTerms: extracted.paymentTerms || undefined,
                    purchaseOrderRef: extracted.purchaseOrderRef || undefined,
                    lineItems: extracted.lineItems,
                });
                createSection = createResult.success
                    ? "### Action\nInvoice creation succeeded from the parsed PDF."
                    : `### Action\nInvoice creation could not complete: ${createResult.error || "Unknown error"}`;
            } else {
                createSection = "### Action\nI parsed the invoice fields, but I could not safely create the invoice because supplier mapping or mandatory invoice values were incomplete.";
            }
        }

        const response = buildDeterministicDocumentResponse(fileName, [
            "Axiom Copilot parsed this PDF without relying on live AI generation.",
            extracted ? buildMarkdownTable(["Field", "Value"], fieldRows) : "I could not extract a stable invoice field set from this PDF.",
            buildDocumentCrossCheckSection({
                supplierName: extracted?.supplierName,
                invoiceNumber: extracted?.invoiceNumber,
                purchaseOrderRef: extracted?.purchaseOrderRef,
            }, workspace),
            pdfText ? `### Text Excerpt\n${pdfText.slice(0, 1200)}` : null,
            createSection,
            "### Suggested Next Steps\n- Review supplier and invoice matches in `/sourcing/invoices`.\n- Use `/admin/import` for bulk structured data.\n- Route mismatches to `/sourcing/exceptions` if the document does not align with the live record.",
        ]);

        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', response);
        return response;
    }

    const attachmentPreview = await buildAttachmentPreview(attachment);
    const response = buildDeterministicDocumentResponse(fileName, [
        "Axiom Copilot parsed this file through the deterministic document path.",
        attachmentPreview.extractedText,
        extension === 'xls'
            ? "### Format Note\nLegacy `.xls` parsing is limited. Re-save the workbook as `.xlsx` or `.csv` for stronger row-level extraction."
            : null,
        "### Suggested Next Steps\n- Use `/admin/import` for schema-validated ingestion.\n- Use `/sourcing/invoices` or `/transactions` if this file belongs to a finance flow.\n- Use `/contacts`, `/suppliers`, or `/sourcing/parts` if this file is a master-data update.",
    ]);

    await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
    await saveChatMessage('assistant', response);
    return response;

    try {
        const model = await getAiModel("gemini-2.5-flash", {
            tools: [{ functionDeclarations: copilotFunctionDeclarations }],
        });
        if (!model) throw new Error("AI model not available");

        const historyContext = getHistoryContext(history, 8);
        const attachmentPreview = await buildAttachmentPreview(attachment);

        const prompt = `
You are Axiom Copilot, an AI-powered procurement document analyst.
A user has uploaded a document named "${fileName}".
${query ? `The user's instruction: "${query}"` : "The user wants you to analyze this document."}

Database State (Snapshot):
${JSON.stringify(context, null, 2)}

Product Knowledge:
${JSON.stringify(productKnowledge, null, 2)}

Conversation History:
${historyContext || "No previous messages."}

INSTRUCTIONS:
1. Identify the document type (invoice, receipt, purchase order, goods receipt, contract, quotation, shipping manifest, spreadsheet, CSV, log, or other).
2. Extract ALL key data points in a structured format using Markdown tables whenever the file is tabular:
   - For invoices/receipts: vendor name, invoice number, date, line items (description, quantity, unit price, total), subtotal, tax, grand total, payment terms.
   - For purchase orders: PO number, supplier, items, quantities, delivery date, terms.
   - For contracts: parties, effective dates, key clauses, renewal terms, value.
   - For goods logs/receipts: GRN number, items received, quantities, condition, date.
   - For quotations: supplier, items quoted, validity, pricing, lead times.
   - For CSV/TSV/XLSX/tabular files: explain the columns, summarize notable rows or totals, flag suspicious blanks/outliers, and suggest how to import or reconcile the data in Axiom.
3. After the breakdown, provide a "📋 Suggested Next Steps" section with 3-5 actionable options the user can take within Axiom, such as:
   - "Create a new purchase order from this invoice"
   - "Match this invoice against existing PO"
   - "Flag discrepancies for review"
   - "Add supplier to Axiom"
   - "Run cost analysis against historical data"
   - "Import these items into inventory"
   - "Compare pricing with existing contracts"
   - "Schedule payment optimization"
4. If you detect anomalies (mismatched amounts, unusual pricing, duplicate entries), flag them as "⚠️ Anomalies Detected".
5. Format currency appropriately based on the document content. Default to ₹ for INR.
6. Use Markdown formatting for clear readability.
7. If some fields are missing or partially unreadable, say what is missing and continue with the usable evidence instead of failing.
8. When helpful, connect the analysis to relevant Axiom modules, routes, or AI agents from Product Knowledge.
9. TOOL USE: If the user explicitly asks to "log", "create", "save", or "record" an invoice from this document, use the create_invoice tool with the data extracted from the document. If the user asks to search or find invoices, use the search_invoices tool.
 
GROUNDING: Extract data ONLY from the uploaded document, document preview, Database State, Product Knowledge, and conversation history. Do NOT hallucinate values.`;

        const result = attachmentPreview.mode === 'inline'
            ? await model!.generateContent([
                prompt,
                {
                    inlineData: {
                        data: attachment.data,
                        mimeType: attachmentPreview.mimeType
                    }
                }
            ])
            : await model!.generateContent(`${prompt}

${attachmentPreview.contentLabel}:
${attachmentPreview.extractedText}`);

        const response = result.response;

        // Handle function calls from document analysis
        const functionCalls = response.functionCalls() || [];
        if (functionCalls.length > 0) {
            const fc = functionCalls[0];
            const fnResult = await executeCopilotFunction(fc.name, fc.args as Record<string, unknown>);

            const contentParts = attachmentPreview.mode === 'inline'
                ? [
                    { text: prompt },
                    { inlineData: { data: attachment.data, mimeType: attachmentPreview.mimeType } },
                    { functionCall: { name: fc.name, args: fc.args } },
                    { functionResponse: { name: fc.name, response: fnResult } },
                ]
                : [
                    { text: `${prompt}\n\n${attachmentPreview.contentLabel}:\n${attachmentPreview.extractedText}` },
                    { functionCall: { name: fc.name, args: fc.args } },
                    { functionResponse: { name: fc.name, response: fnResult } },
                ];

            const followUp = await model!.generateContent(contentParts);
            const text = followUp.response.text();

            await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
            await saveChatMessage('assistant', text);
            await TelemetryService.trackEvent("AxiomCopilot", "document_function_call", { function: fc.name, fileName });
            return text;
        }

        const text = response.text();

        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', text);
        await TelemetryService.trackEvent("AxiomCopilot", "document_parsed", { fileName, query_length: query.length });

        return text;
    } catch (error) {
        console.error("Document processing error, using fallback:", error);
        await TelemetryService.trackError("AxiomCopilot", "document_parse_failed", error, { fileName });

        try {
            const attachmentPreview = await buildAttachmentPreview(attachment);
            const decoded = attachmentPreview.extractedText ?? Buffer.from(attachment.data, 'base64').toString('utf-8');
            const amounts = [...decoded.matchAll(/(?:rs\.?|inr|usd|eur|\$)?\s*([\d,]+(?:\.\d{2})?)/gi)]
                .map((match) => parseFloat(match[1].replace(/,/g, '')))
                .filter((value) => !Number.isNaN(value) && value > 0);
            const dateMatches = [...decoded.matchAll(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/g)].map((match) => match[1]);
            const totalAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
            const guidedFallback = `## Document Analysis: ${fileName}\n\n` +
                `> Axiom is using guided document review mode, so this is a best-effort extraction built from the file preview.\n\n` +
                `**Detected Amounts:** ${amounts.length > 0 ? amounts.slice(0, 8).map((amount) => `INR ${amount.toLocaleString()}`).join(', ') : 'None found'}\n\n` +
                `**Estimated Total:** ${totalAmount ? `INR ${totalAmount.toLocaleString()}` : 'Could not determine'}\n\n` +
                `**Dates Found:** ${dateMatches.length > 0 ? dateMatches.slice(0, 5).join(', ') : 'None found'}\n\n` +
                `### Suggested Next Steps\n\n` +
                `1. Manual review — open the document and cross-reference it with the relevant invoice, order, or supplier record.\n` +
                `2. Import structured data — use Admin → Import for CSV or workbook driven flows.\n` +
                `3. Run cost analysis — compare the detected amounts against Savings or Spend Intelligence.\n` +
                `4. Route follow-up — create a task or support ticket if the document needs team review.\n`;

            await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
            await saveChatMessage('assistant', guidedFallback);
            return guidedFallback;
        } catch {
            const guidedFallback = `## Document Received: ${fileName}\n\n` +
                `The file is available, but automatic extraction could not complete in this pass. You can still continue in guided review mode.\n\n` +
                `### Suggested Next Steps\n\n` +
                `1. Review the file manually against the relevant invoice, order, or supplier record.\n` +
                `2. Re-upload as .xlsx or .csv if you want row-level parsing.\n` +
                `3. Continue the workflow through Import, Invoices, or Tasks.\n`;

            await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
            await saveChatMessage('assistant', guidedFallback);
            return guidedFallback;
        }

        // Heuristic fallback: try to decode base64 text and extract basic info
        let fallbackText: string;
        try {
            const attachmentPreview = await buildAttachmentPreview(attachment);
            const decoded = attachmentPreview.extractedText ?? Buffer.from(attachment.data, 'base64').toString('utf-8');
            const amounts = [...decoded.matchAll(/(?:₹|rs\.?|inr|usd|\$|eur)?\s*([\d,]+(?:\.\d{2})?)/gi)]
                .map(m => parseFloat(m[1].replace(/,/g, '')))
                .filter(n => !Number.isNaN(n) && n > 0);
            const dateMatches = [...decoded.matchAll(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/g)].map(m => m[1]);
            const totalAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

            fallbackText = `## 📄 Document Analysis: ${fileName}\n\n` +
                `> ⚠️ AI model unavailable — showing heuristic extraction.\n\n` +
                `**Detected Amounts:** ${amounts.length > 0 ? amounts.slice(0, 8).map(a => `₹${a.toLocaleString()}`).join(', ') : 'None found'}\n\n` +
                `**Estimated Total:** ${totalAmount ? `₹${totalAmount.toLocaleString()}` : 'Could not determine'}\n\n` +
                `**Dates Found:** ${dateMatches.length > 0 ? dateMatches.slice(0, 5).join(', ') : 'None found'}\n\n` +
                `---\n\n` +
                `### 📋 Suggested Next Steps\n\n` +
                `1. **Re-upload with AI enabled** — Configure your Gemini API key in Admin → Settings for full document intelligence.\n` +
                `2. **Manual review** — Open the document and cross-reference with existing purchase orders or invoices.\n` +
                `3. **Import data** — Use Admin → Import to upload structured CSV data into Axiom.\n` +
                `4. **Run cost analysis** — Compare the detected amounts against historical pricing or Savings intelligence.\n` +
                `5. **Convert legacy spreadsheets** — If this was an .xls workbook, re-save it as .xlsx or .csv for richer extraction.\n`;
        } catch {
            fallbackText = `## 📄 Document Received: ${fileName}\n\n` +
                `I received your document but couldn't process it automatically. ` +
                `Please ensure your AI API key is configured in **Admin → Settings** for full document intelligence.\n\n` +
                `### 📋 Suggested Next Steps\n\n` +
                `1. **Configure AI** — Add a Gemini API key in Admin → Settings.\n` +
                `2. **Try again** — Re-upload the document after configuration.\n` +
                `3. **Manual entry** — Use Admin → Import to input data manually.\n`;
        }

        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', fallbackText);
        return fallbackText;
    }
}
