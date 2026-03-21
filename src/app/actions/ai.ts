'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers, chatHistory } from "@/db/schema";
import { eq, sum, desc, sql, count, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

import { getAiModel } from "@/lib/ai-provider";
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

export async function processCopilotQuery(
    query: string,
    history: { role: 'user' | 'assistant', content: string }[] = [],
    attachment?: { data: string; name: string }
) {
    return await TelemetryService.time("AxiomCopilot", "processQuery", async () => {
        const context = await getDatabaseContext();
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
                    ? `Executed ${matchedIntent.label} successfully.\n\nResult: ${agentResult.reasoning || 'Run completed.'}`
                    : `I attempted to run ${matchedIntent.label}, but it failed: ${agentResult.error || 'Unknown error'}`;

                await saveChatMessage('user', query);
                await saveChatMessage('assistant', directResponse);
                return directResponse;
            }

            const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
            const historyContext = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            const prompt = `
                You are Axiom Copilot, an analytical and efficient procurement AI. 
                Your role is to help users manage their supply chain, analyze spend, and mitigate risk using the provided data.
                
                Database State (Snapshot):
                ${JSON.stringify(context, null, 2)}
                
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
                   - Answer ONLY based on the provided "Database State" or history.
                   - If a user asks for information not present in the data, state: "I do not have access to that specific data in my current enterprise snapshot."
                   - DO NOT hallucinate names, numbers, or dates.
                   - Cite your sources. Example: "(Source: Database Stats)" or "(Source: Recent Orders)".
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
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

async function processDocumentAttachment(
    query: string,
    attachment: { data: string; name: string },
    context: Awaited<ReturnType<typeof getDatabaseContext>>,
    history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
    const fileName = attachment.name;
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

    // Validate file size — base64 encoding increases size by ~33% (1/0.75 ≈ 1.37)
    if (attachment.data.length > MAX_FILE_SIZE_BYTES * 1.37) {
        const response = "⚠️ The uploaded file exceeds the 10 MB limit. Please upload a smaller file.";
        await saveChatMessage('user', `[Document: ${fileName}] ${query}`);
        await saveChatMessage('assistant', response);
        return response;
    }

    try {
        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");

        const historyContext = history.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const prompt = `
You are Axiom Copilot, an AI-powered procurement document analyst.
A user has uploaded a document named "${fileName}".
${query ? `The user's instruction: "${query}"` : "The user wants you to analyze this document."}

Database State (Snapshot):
${JSON.stringify(context, null, 2)}

Conversation History:
${historyContext || "No previous messages."}

INSTRUCTIONS:
1. Identify the document type (invoice, receipt, purchase order, goods receipt, contract, quotation, shipping manifest, or other).
2. Extract ALL key data points in a structured format using Markdown tables:
   - For invoices/receipts: vendor name, invoice number, date, line items (description, quantity, unit price, total), subtotal, tax, grand total, payment terms.
   - For purchase orders: PO number, supplier, items, quantities, delivery date, terms.
   - For contracts: parties, effective dates, key clauses, renewal terms, value.
   - For goods logs/receipts: GRN number, items received, quantities, condition, date.
   - For quotations: supplier, items quoted, validity, pricing, lead times.
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

GROUNDING: Extract data ONLY from the uploaded document. Do NOT hallucinate values.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: attachment.data,
                    mimeType
                }
            }
        ]);

        const response = await result.response;
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
            const decoded = Buffer.from(attachment.data, 'base64').toString('utf-8');
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
                `2. **Manual review** — Open the document and cross-reference with existing purchase orders.\n` +
                `3. **Import data** — Use Admin → Import to manually input the extracted data.\n` +
                `4. **Run cost analysis** — Compare the detected amounts against historical pricing.\n`;
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
