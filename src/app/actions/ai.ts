'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers } from "@/db/schema";
import { eq, sum, desc, sql, count } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is missing from environment!");
        return "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment.";
    }

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
            1. PERSONALITY: Be direct, professional, and data-driven. Avoid "fluff".
            2. REPETITION: Do NOT say "I am Axiom Copilot" or "I am an AI assistant" if there is existing history. Only introduce yourself if the history is empty.
            3. CONTEXT: If the user refers to "it", "this", or "that", use the Conversation History to understand what they mean.
            4. DATA: Use the Database State to answer. If names/details aren't there, say you don't have that specific data but can provide general insights.
            5. FORMATTING: Use Indian Rupee (₹) symbols. Keep responses concise (under 3 sentences) unless asked for a deep dive.
            6. GREETING: If the user says "hi" or "hello" and there is history, just reply naturally without a full re-introduction.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("Gemma Response received:", text.substring(0, 50) + "...");
        return text;
    } catch (error: any) {
        console.error("DEBUG - processCopilotQuery failure:", error);
        return `I encountered an error while processing your request: ${error.message || 'Unknown error'}.`;
    }
}
