'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers, chatHistory } from "@/db/schema";
import { eq, sum, desc, sql, count, asc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

// Initialize Gemini
const genAI = new GoogleGenerativeAI("AIzaSyApARgWwswo5nb2TVGrj6Wn4BULeLIBOM0");

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

export async function analyzeSpend() {
    console.log("Starting analyzeSpend...");
    const context = await getDatabaseContext();
    if (!context) return { summary: "Unable to access database for analysis.", recommendations: [], savingsPotential: 0 };

    const topCategory = context.topCategories[0]?.category || "Unknown";
    const topCategoryAmount = Number(context.topCategories[0]?.total || 0);

    const recommendations = [];
    if (context.riskySuppliers.length > 0) {
        recommendations.push(`Monitor ${context.riskySuppliers.length} high-risk suppliers like ${context.riskySuppliers[0].name}.`);
    }
    recommendations.push(`Consolidate spending in '${topCategory}' to negotiate better volume discounts.`);
    recommendations.push("Review 'sent' orders that haven't moved to 'fulfilled' status.");

    return {
        summary: `Total tracked spend is ${context.stats.totalSpend}, primarily driven by ${topCategory}. There are ${context.riskySuppliers.length} suppliers with risk scores above 50.`,
        recommendations,
        savingsPotential: topCategoryAmount * 0.1,
    };
}

export async function processCopilotQuery(query: string, history: { role: 'user' | 'assistant', content: string }[] = []) {
    console.log("Processing Copilot Query:", query);
    // Key is hardcoded, skipping env check
    // if (!process.env.GEMINI_API_KEY) { ... }

    try {
        console.log("Fetching database context for AI...");
        const context = await getDatabaseContext();

        console.log("Calling Gemini API with Gemma 3...");
        const model = genAI.getGenerativeModel({ model: "gemma-3-4b-it" });

        // Convert messages to a string block for the prompt
        const historyContext = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const prompt = `
            You are Axiom Copilot, an analytical and efficient procurement AI. 
            Your role is to help users manage their supply chain, analyze spend, and mitigate risk using the provided data.
            
            Database State (Current Snapshot):
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
            6. DATA INTEGRITY & GROUNDING: 
               - Use ONLY the provided Database State. 
               - If the user asks about ANYTHING outside the portal (general knowledge, news, unrelated topics), you MUST respond with: "I am a procurement-specialized AI and I am not aware of information outside this portal."
               - Do not attempt to guess or use your internal training data for facts not present in the Database State.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Save both messages
        await saveChatMessage('user', query);
        await saveChatMessage('assistant', text);

        console.log("Gemma Response received:", text.substring(0, 50) + "...");
        return text;
    } catch (error: any) {
        console.error("DEBUG - processCopilotQuery failure:", error);
        return `I encountered an error while processing your request: ${error.message || 'Unknown error'}.`;
    }
}
