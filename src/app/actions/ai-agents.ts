'use server'

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Offer Parsing Agent
 * Extracts structured data from quote documents (PDF/Image)
 */
export async function parseOffer(fileData: string, fileName: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a specialized Procurement AI Agent. Your task is to extract structured data from the attached quote/offer document.
            File Name: ${fileName}
            
            Extract the following fields in JSON format:
            1. items: Array of { sku: string, name: string, quantity: number, unitPrice: number, currency: string }
            2. totalAmount: number
            3. deliveryLeadTime: string (e.g., "2 weeks")
            4. validityPeriod: string
            5. supplierName: string
            6. paymentTerms: string

            Ensure you convert all currency values to numbers. If a field is not found, return null.
            Return ONLY the JSON.
        `;

        // fileData is expected to be a base64 encoded string
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: fileData,
                    mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return { success: true, data: JSON.parse(jsonMatch[0]) };
        }

        return { success: false, error: "Failed to parse JSON from AI response" };
    } catch (error) {
        console.error("Offer Parsing Error:", error);
        return { success: false, error: "Failed to process document" };
    }
}

/**
 * Document Intelligence Agent
 * Cross-references documents for compliance and consistency
 */
export async function analyzeCompliance(documents: { name: string, content: string }[], rfqRequirements: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a Document Intelligence Agent. Cross-reference the following documents against these RFQ requirements:
            
            RFQ Requirements:
            ${rfqRequirements}
            
            Check for:
            1. Technical specification mismatches.
            2. Missing certifications or licenses.
            3. Delivery timeline compliance.
            4. Any red flags or non-standard clauses.

            Return a detailed assessment in JSON format:
            {
                status: "compliant" | "partial" | "non-compliant",
                findings: [ { type: "mismatch" | "missing" | "risk", description: string, severity: "low" | "medium" | "high" } ],
                recommendation: string
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return { success: true, data: JSON.parse(jsonMatch[0]) };
        }

        return { success: false, error: "Failed to parse compliance data" };
    } catch (error) {
        console.error("Compliance Analysis Error:", error);
        return { success: false, error: "Failed to analyze compliance" };
    }
}

/**
 * Cost Analysis Agent
 * Compares quotes with "Should-Cost" data
 */
export async function analyzeCosts(quoteItems: any[], historicalParts: any[]) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a Cost Analysis Agent. Compare the current quote items with our historical/should-cost part data.
            
            Quote Items:
            ${JSON.stringify(quoteItems)}
            
            Historical Data:
            ${JSON.stringify(historicalParts)}
            
            Identify:
            1. Price variances per item.
            2. Potential for negotiation based on market trends.
            3. Total estimated savings if should-cost is achieved.

            Return JSON:
            {
                variances: [ { sku: string, variancePercentage: number, trend: "up" | "down" | "stable" } ],
                negotiationStrategy: string,
                potentialSavings: number
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return { success: true, data: JSON.parse(jsonMatch[0]) };
        }

        return { success: false, error: "Failed to parse cost analysis" };
    } catch (error) {
        console.error("Cost Analysis Error:", error);
        return { success: false, error: "Failed to analyze costs" };
    }
}

/**
 * Supply Chain Risk Intelligence Agent
 * Deep-dive analysis of supplier risk factors
 */
export async function analyzeSupplierRisk(supplierData: any, marketNews?: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a Supply Chain Risk Intelligence Agent. Analyze the risk factors for this supplier.
            
            Supplier Data:
            ${JSON.stringify(supplierData)}
            
            Market Context:
            ${marketNews || "No major market news provided."}
            
            Assess:
            1. Operational risk (Performance, Lead times).
            2. Financial risk (Ratings, Payment trends).
            3. ESG compliance risks.
            4. External disruption risks (Geopolitical, Logistics).

            Return JSON:
            {
                overallRiskLevel: "low" | "medium" | "high" | "critical",
                riskScore: number (0-100),
                mitigationStrategy: string,
                keyAlerts: string[]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return { success: true, data: JSON.parse(jsonMatch[0]) };
        }

        return { success: false, error: "Failed to parse risk analysis" };
    } catch (error) {
        console.error("Risk Analysis Error:", error);
        return { success: false, error: "Failed to analyze risk" };
    }
}

/**
 * Spend Analysis Agent
 * Identifies savings opportunities across the platform
 */
export async function analyzeSpend(orders: any[], suppliers: any[]) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a Spend Analysis Agent. Identify savings and consolidation opportunities.
            
            Order History:
            ${JSON.stringify(orders.slice(0, 50))} 
            
            Supplier Network:
            ${JSON.stringify(suppliers)}
            
            Identify:
            1. Suppliers with overlapping categories (Consolidation potential).
            2. High-volume parts that could benefit from long-term contracts.
            3. Price variations for the same SKU across different suppliers.

            Return JSON:
            {
                totalSavingPotential: number,
                opportunities: [ { type: "consolidation" | "contract" | "arbitrage", description: string, estimatedSavings: number } ],
                actionPlan: string
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return { success: true, data: JSON.parse(jsonMatch[0]) };
        }

        return { success: false, error: "Failed to parse spend analysis" };
    } catch (error) {
        console.error("Spend Analysis Error:", error);
        return { success: false, error: "Failed to analyze spend" };
    }
}
