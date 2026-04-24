'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers, chatHistory } from "@/db/schema";
import { eq, sum, desc, sql, count, asc, ilike } from "drizzle-orm";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

import { getAiModel } from "@/lib/ai-provider";
import { getCopilotKnowledgeContext } from "@/lib/copilot-knowledge";
import JSZip from "jszip";
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

import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { createInvoice, getInvoices } from "./invoices";

const copilotFunctionDeclarations: FunctionDeclaration[] = [
    {
        name: "create_invoice",
        description: "Create a new invoice record in Axiom. Use when a user asks to log, record, or create an invoice.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                supplierId: { type: SchemaType.STRING, description: "The supplier/vendor ID" },
                supplierName: { type: SchemaType.STRING, description: "Supplier name to look up if supplierId is unknown" },
                invoiceNumber: { type: SchemaType.STRING, description: "Invoice number/reference" },
                amount: { type: SchemaType.NUMBER, description: "Total invoice amount" },
                currency: { type: SchemaType.STRING, description: "3-letter ISO currency code (default INR)" },
                invoiceDate: { type: SchemaType.STRING, description: "Invoice date in YYYY-MM-DD format" },
                dueDate: { type: SchemaType.STRING, description: "Payment due date in YYYY-MM-DD format" },
                taxAmount: { type: SchemaType.NUMBER, description: "Tax amount" },
                subtotal: { type: SchemaType.NUMBER, description: "Subtotal before tax" },
                paymentTerms: { type: SchemaType.STRING, description: "Payment terms e.g. Net 30" },
                purchaseOrderRef: { type: SchemaType.STRING, description: "Referenced PO number" },
            },
            required: ["invoiceNumber", "amount"],
        },
    },
    {
        name: "search_invoices",
        description: "Search and filter invoices in Axiom. Use when user asks to find, list, show, or look up invoices.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                invoiceNumber: { type: SchemaType.STRING, description: "Invoice number to search for" },
                status: { type: SchemaType.STRING, description: "Filter by status: pending, matched, disputed, paid" },
                currency: { type: SchemaType.STRING, description: "Filter by currency code" },
                country: { type: SchemaType.STRING, description: "Filter by country" },
                dateFrom: { type: SchemaType.STRING, description: "Start date filter YYYY-MM-DD" },
                dateTo: { type: SchemaType.STRING, description: "End date filter YYYY-MM-DD" },
            },
        },
    },
];

async function resolveSupplierIdByName(name: string): Promise<string | null> {
    const results = await db.select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(ilike(suppliers.name, `%${name}%`))
        .limit(1);
    return results[0]?.id || null;
}

async function executeCopilotFunction(
    fnName: string,
    args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    switch (fnName) {
        case "create_invoice": {
            let supplierId = args.supplierId as string | undefined;
            if (!supplierId && args.supplierName) {
                supplierId = await resolveSupplierIdByName(args.supplierName as string) || undefined;
            }
            if (!supplierId) {
                return { success: false, error: "Supplier ID is required. Please specify a supplier name or ID." };
            }
            return await createInvoice({
                supplierId,
                invoiceNumber: args.invoiceNumber as string,
                amount: Number(args.amount),
                currency: (args.currency as string) || 'INR',
                invoiceDate: args.invoiceDate as string | undefined,
                dueDate: args.dueDate as string | undefined,
                taxAmount: args.taxAmount ? Number(args.taxAmount) : undefined,
                subtotal: args.subtotal ? Number(args.subtotal) : undefined,
                paymentTerms: args.paymentTerms as string | undefined,
                purchaseOrderRef: args.purchaseOrderRef as string | undefined,
            });
        }
        case "search_invoices": {
            const results = await getInvoices({
                invoiceNumber: args.invoiceNumber as string | undefined,
                status: args.status as string | undefined,
                currency: args.currency as string | undefined,
                country: args.country as string | undefined,
                dateFrom: args.dateFrom as string | undefined,
                dateTo: args.dateTo as string | undefined,
            });
            return { success: true, data: results.slice(0, 20) };
        }
        default:
            return { success: false, error: `Unknown function: ${fnName}` };
    }
}

export async function processCopilotQuery(
    query: string,
    history: { role: 'user' | 'assistant', content: string }[] = [],
    attachment?: { data: string; name: string; mimeType?: string }
) {
    return await TelemetryService.time("AxiomCopilot", "processQuery", async () => {
        const context = await getDatabaseContext();
        const productKnowledge = getCopilotKnowledgeContext();
        try {
            const normalizedQuery = query.toLowerCase();

            // If a file is attached, process it with the PDF/document parser
            if (attachment && attachment.data) {
                return await processDocumentAttachment(query, attachment, context, history);
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

            const result = await model.generateContent(prompt);
            const response = result.response;

            // Check if the model wants to call a function
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const fc = functionCalls[0];
                const fnResult = await executeCopilotFunction(fc.name, fc.args as Record<string, unknown>);

                // Send function result back to the model for a natural language summary
                const followUp = await model.generateContent([
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
            // Fallback
            if (query.toLowerCase().includes("risk")) {
                return `I'm currently operating in offline mode. Based on my last snapshot, I've identified ${context?.riskySuppliers.length || 0} high-risk suppliers.`;
            }
            return `Axiom Copilot is temporarily restricted. Please check your AI API configuration in Admin Settings or contact support if the issue persists.`;
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

async function processDocumentAttachment(
    query: string,
    attachment: { data: string; name: string; mimeType?: string },
    context: Awaited<ReturnType<typeof getDatabaseContext>>,
    history: { role: 'user' | 'assistant'; content: string }[]
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
            ? await model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: attachment.data,
                        mimeType: attachmentPreview.mimeType
                    }
                }
            ])
            : await model.generateContent(`${prompt}

${attachmentPreview.contentLabel}:
${attachmentPreview.extractedText}`);

        const response = result.response;

        // Handle function calls from document analysis
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
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

            const followUp = await model.generateContent(contentParts);
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

        // Heuristic fallback: try to decode base64 text and extract basic info
        let fallbackText: string;
        try {
            const attachmentPreview = await buildAttachmentPreview(attachment);
            const decoded = attachmentPreview.extractedText ?? Buffer.from(attachment.data, 'base64').toString('utf-8');
            const amounts = [...decoded.matchAll(/(?:₹|rs\.?|inr|usd|\$|eur)?\s*([\d,]+(?:\.\d{2})?)/gi)]
                .map(m => parseFloat(m[1].replace(/,/g, '')))
                .filter(n => !Number.isNaN(n) && n > 0);
            const dateMatches = [...decoded.matchAll(/\b(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/g)].map(m => m[1]);
            const totalAmount = amounts.length > 0 ? Math.max(...amounts) : null;

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
