'use server'

import { db } from "@/db";
import { procurementOrders, orderItems, parts, suppliers } from "@/db/schema";
import { eq, sum, desc, sql } from "drizzle-orm";

export async function analyzeSpend() {
    // 1. Calculate top spending category
    const categorySpend = await db.select({
        category: parts.category,
        total: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`
    })
        .from(orderItems)
        .innerJoin(parts, eq(orderItems.partId, parts.id))
        .groupBy(parts.category)
        .orderBy(sql`sum(${orderItems.quantity} * ${orderItems.unitPrice}) desc`)
        .limit(1);

    const topCategory = categorySpend[0];
    const topCategoryName = topCategory?.category || "Unknown";
    const topCategoryAmount = Number(topCategory?.total || 0);

    // 2. Risk analysis (suppliers with high risk score)
    const riskySuppliers = await db.select()
        .from(suppliers)
        .where(sql`${suppliers.riskScore} > 50`);

    // Construct sentences
    const recommendations = [];
    if (riskySuppliers.length > 0) {
        recommendations.push(`Monitor ${riskySuppliers.length} high-risk suppliers (` + riskySuppliers.map(s => s.name).join(", ") + ").");
    }
    recommendations.push(`Optimize procurement in '${topCategoryName}' which accounts for the highest spend.`);
    recommendations.push("Consider consolidating tail-spend suppliers.");

    return {
        summary: `Total tracked spend is dominated by ${topCategoryName} (₹${topCategoryAmount.toFixed(2)}). Database indicates ${riskySuppliers.length} high-risk suppliers active.`,
        recommendations,
        savingsPotential: topCategoryAmount * 0.1, // Mock heuristic 10%
    };
}

export async function processCopilotQuery(query: string) {
    const q = query.toLowerCase();

    // 1. Identity & Role
    if (q.includes("who are you") || q.includes("what are you") || q.includes("who r u")) {
        return "I am Axiom Copilot, your specialized AI assistant for procurement intelligence. I can analyze your spending patterns, track supplier risks, and help you find savings across your organization.";
    }

    if (q.includes("how are you") || q.includes("what's up") || q.includes("what are you up to")) {
        return "I'm doing great! I just finished scanning your latest procurement orders and supplier risk profiles. Is there something specific you'd like me to look into?";
    }

    // 2. Help/Capabilities
    if (q.includes("help") || q.includes("what can you do") || q.includes("capabilities")) {
        return "I can help with several things:\n- **Spend Analysis**: Ask 'What is our total spend?'\n- **Risk Assessment**: Ask 'Which suppliers are high risk?'\n- **Supplier Info**: Ask 'List our active suppliers.'\n- **Savings**: Ask 'Where can we save money?'";
    }

    // 3. Supplier Listing
    if (q.includes("list suppliers") || q.includes("show suppliers") || q.includes("who are our suppliers")) {
        const allSuppliers = await db.select().from(suppliers).limit(10);
        const names = allSuppliers.map(s => s.name).join(", ");
        return `We currently have ${allSuppliers.length} suppliers registered. Some of them are: ${names}. You can view the full list in the Suppliers page.`;
    }

    // 4. Detailed Data Analysis (using existing logic)
    const analysis = await analyzeSpend();

    if (q.includes("spend") || q.includes("cost") || q.includes("money") || q.includes("raw material")) {
        return analysis.summary;
    }

    if (q.includes("risk") || q.includes("dangerous") || q.includes("blacklist")) {
        return analysis.recommendations[0] || "I don't see any immediate high-risk suppliers flagged in the system right now.";
    }

    if (q.includes("saving") || q.includes("optimize") || q.includes("cheap")) {
        return `We've identified a potential saving of ₹${analysis.savingsPotential.toLocaleString()} (approx 10%). I recommend focusing on ${analysis.summary.split('by ')[1].split(' (')[0]} category for better deals.`;
    }

    // 5. Default Response
    return "I've analyzed your procurement data, and here's a quick summary: " + analysis.summary + " What else would you like to know?";
}
