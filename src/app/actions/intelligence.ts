'use server'

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db";
import { rfqs } from "@/db/schema";
import { desc } from "drizzle-orm";

const genAI = new GoogleGenerativeAI("AIzaSyApARgWwswo5nb2TVGrj6Wn4BULeLIBOM0");

export async function getMarketTrend(partName: string, category: string) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Supply chain intelligence for ${partName} (${category}) in 2026. Return JSON {trend: "up"|"down"|"stable"|"volatile", reason: "1-sentence context"}`;
        const result = await model.generateContent(prompt);
        const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { trend: "up", reason: "Anticipated 2026 volatility." };
    } catch (e) {
        return { trend: "stable", reason: "Market visibility limited." };
    }
}

export async function getDashboardStats() {
    // Simulated live metrics for Axiom Ultra
    return {
        totalSpend: 14500000,
        activeSuppliers: 124,
        criticalRFQs: 9,
        complianceRate: 94
    };
}

export async function getRecentRFQs() {
    try {
        const data = await db.query.rfqs.findMany({
            orderBy: [desc(rfqs.createdAt)],
            limit: 5
        });

        // Ensure we always have an expiry date or something similar if the UI expects it
        return data.map(rfq => ({
            ...rfq,
            expiryDate: new Date(rfq.createdAt!.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() // Mock expiry 2 weeks after creation
        }));
    } catch (e) {
        console.error("Failed to fetch recent RFQs:", e);
        return [];
    }
}
