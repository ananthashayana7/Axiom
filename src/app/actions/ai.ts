'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers, chatHistory } from "@/db/schema";
import { eq, sum, desc, sql, count, asc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

import { getAiModel } from "@/lib/ai-provider";

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
                totalSpend: `₹${Number(totalSpend).toLocaleString()}`
            },
            topCategories: categorySpend,
            riskySuppliers,
            recentOrders,
            timestamp: new Date().toISOString()
        };
    } catch (error: any) {
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
        const model = await getAiModel("gemini-1.5-flash");
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

export async function processCopilotQuery(query: string, history: { role: 'user' | 'assistant', content: string }[] = []) {
    return await TelemetryService.time("AxiomCopilot", "processQuery", async () => {
        const context = await getDatabaseContext();
        try {
            const model = await getAiModel("gemini-1.5-flash");
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
                5. FORMATTING: Use Indian Rupee (₹) symbols for currency.
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
        } catch (error: any) {
            await TelemetryService.trackError("AxiomCopilot", "query_failed", error, { query });
            // Fallback
            if (query.toLowerCase().includes("risk")) {
                return `I'm currently operating in offline mode. Based on my last snapshot, I've identified ${context?.riskySuppliers.length || 0} high-risk suppliers.`;
            }
            return `Axiom Copilot is temporarily restricted. Please check your AI API configuration in Admin Settings or contact support if the issue persists.`;
        }
    }, { query_preview: query.substring(0, 30) });
}
