'use server'

import { auth } from "@/auth";

import { getAiModel } from "@/lib/ai-provider";

// Providers are now managed by getAiModel()

function safeParseJsonMatch(jsonMatch: RegExpMatchArray | null): { success: true; data: unknown } | { success: false; error: string } {
    if (!jsonMatch) return { success: false, error: "No JSON found in AI response" };
    try {
        return { success: true, data: JSON.parse(jsonMatch[0]) };
    } catch {
        return { success: false, error: "AI returned invalid JSON" };
    }
}

function decodeTextFromBase64(data: string) {
    try {
        return Buffer.from(data, "base64").toString("utf-8");
    } catch {
        return "";
    }
}

function extractAmounts(text: string) {
    return [...text.matchAll(/(?:₹|rs\.?|inr|usd|\$|eur)?\s*([\d.,]+)\b/gi)]
        .map(m => parseFloat(m[1].replace(/,/g, "")))
        .filter(n => !Number.isNaN(n));
}

function deriveTrend(prev: number, current: number): "up" | "down" | "stable" {
    if (current > prev * 1.05) return "up";
    if (current < prev * 0.95) return "down";
    return "stable";
}

function riskLevelFromScore(score: number): "low" | "medium" | "high" | "critical" {
    if (score > 85) return "critical";
    if (score > 65) return "high";
    if (score > 45) return "medium";
    return "low";
}

type ComplianceFinding = { type: "mismatch" | "missing" | "risk"; description: string; severity: "low" | "medium" | "high" };
type ComplianceStatus = "compliant" | "partial" | "non-compliant";
type Variance = { sku: string; variancePercentage: number; trend: "up" | "down" | "stable" };
type HistoricalPart = {
    id?: string;
    sku?: string;
    shouldCost?: number;
    unitPrice?: number;
    price?: number;
    avgPrice?: number;
};
type OrderLike = { totalAmount?: number; amount?: number; status?: string };
type SupplierLike = { category?: string; name?: string };
const RISK_WEIGHT_ON_TIME = 0.3;
const RISK_WEIGHT_QUALITY = 0.3;
const RISK_WEIGHT_FINANCIAL = 0.4;
const PARTIAL_COMPLIANCE_THRESHOLD = 0.5;
const MIN_PARTIAL_THRESHOLD = 1;
const ESTIMATED_CONSOLIDATION_SAVINGS_RATE = 0.05;
const TOTAL_SAVINGS_PERCENTAGE = 0.04;
const NEW_ITEM_VARIANCE_PERCENTAGE = 100; // sentinel variance when no baseline exists

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
            GROUNDING: Answer ONLY based on the provided document. If data is missing, return null.
            Return ONLY the JSON.
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
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
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse JSON from AI response" };
    } catch (error) {
        console.error("Offer Parsing Error, using heuristic fallback:", error);
        const text = decodeTextFromBase64(fileData);
        const amounts = extractAmounts(text);
        const totalAmount = amounts.length ? Math.max(...amounts) : 0;
        const deliveryMatch = text.match(/(\d+)\s*(weeks?|week|days?|day)/i);
        const deliveryLeadTime = deliveryMatch ? deliveryMatch[0] : "4 weeks";
        const supplierMatch = text.match(/supplier[:\-]\s*([A-Za-z0-9 .-]+)/i);
        const paymentMatch = text.match(/net\s*\d+|advance|prepaid|cod/i);

        return {
            success: true,
            data: {
                items: [],
                totalAmount,
                deliveryLeadTime,
                validityPeriod: "30 days",
                supplierName: supplierMatch ? supplierMatch[1].trim() : "Unknown Supplier",
                paymentTerms: paymentMatch ? paymentMatch[0] : "Standard",
                note: "Heuristic parse used because AI model was unavailable."
            }
        };
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

            GROUNDING: Answer ONLY based on the provided documents.
            Return a detailed assessment in JSON format:
            {
                status: "compliant" | "partial" | "non-compliant",
                findings: [ { type: "mismatch" | "missing" | "risk", description: string, severity: "low" | "medium" | "high" } ],
                recommendation: string
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse compliance data" };
    } catch (error) {
        console.error("Compliance Analysis Error, using heuristic fallback:", error);
        const keywords = rfqRequirements
            .split(/[\n,;]+/)
            .map(k => k.trim())
            .filter(k => k.length > 2);

        const combinedDocs = documents.map(d => `${d.name}: ${d.content}`.toLowerCase()).join(" ");
        const missing: ComplianceFinding[] = [];

        for (const key of keywords) {
            const normalized = key.toLowerCase();
            if (!combinedDocs.includes(normalized)) {
                missing.push({
                    type: "missing",
                    description: `Requirement "${key}" not explicitly found in provided documents.`,
                    severity: "medium"
                });
            }
        }

        // allow up to configured percentage missing to remain "partial"
        const partialThreshold = Math.max(MIN_PARTIAL_THRESHOLD, Math.floor(keywords.length * PARTIAL_COMPLIANCE_THRESHOLD));
        const status: ComplianceStatus =
            missing.length === 0 ? "compliant" :
                missing.length <= partialThreshold ? "partial" : "non-compliant";

        const recommendation = (missing.length === 0
            ? "All stated requirements are present. Proceed to commercial evaluation."
            : `Review ${missing.length} missing requirement(s) and request updated documentation from suppliers.`) + " (Heuristic check – verify manually.)";

        return { success: true, data: { status, findings: missing, recommendation } };
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

            GROUNDING: Use historical data explicitly. If missing, say so.
            Return JSON:
            {
                variances: [ { sku: string, variancePercentage: number, trend: "up" | "down" | "stable" } ],
                negotiationStrategy: string,
                potentialSavings: number
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse cost analysis" };
    } catch (error) {
        console.error("Cost Analysis Error, using heuristic fallback:", error);
        const historicalMap = new Map<string, HistoricalPart>();
        (historicalParts as HistoricalPart[]).forEach((p) => {
            const key = p.sku || p.id;
            if (key) historicalMap.set(key, p);
        });

        let potentialSavings = 0;
        const variances = quoteItems.map((item, index) => {
            const sku = item.sku || item.part?.sku || item.name || `ITEM_${index + 1}`;
            const quoted = Number(item.unitPrice ?? item.price ?? item.amount ?? item.totalAmount ?? 0);
            const history = historicalMap.get(sku) || (item.partId ? historicalMap.get(item.partId) : undefined);
            const baseline = Number((history?.shouldCost ?? history?.unitPrice ?? history?.price ?? history?.avgPrice ?? quoted ?? 0));
            let varianceRaw = 0;
            if (baseline > 0) {
                varianceRaw = ((quoted - baseline) / baseline) * 100;
            } else if (quoted > 0) {
                varianceRaw = NEW_ITEM_VARIANCE_PERCENTAGE; // treat as new pricing without baseline
            }
            const quantity = Number(item.quantity || 1);
            if (baseline > 0) {
                const delta = baseline - quoted;
                if (delta > 0) {
                    potentialSavings += delta * quantity;
                }
            }
            const safeBaseline = baseline > 0 ? baseline : 1;
            const safeQuoted = quoted > 0 ? quoted : safeBaseline;

            return {
                sku,
                variancePercentage: Math.round(varianceRaw),
                trend: deriveTrend(safeBaseline, safeQuoted)
            } as Variance;
        });

        const hotSku = variances.sort((a, b) => b.variancePercentage - a.variancePercentage)[0];
        const negotiationStrategy = hotSku
            ? `Anchor negotiations on ${hotSku.sku} where variance is ${hotSku.variancePercentage}% above historical. Push for baseline pricing first, then volume rebates. (Heuristic fallback — validate numbers manually.)`
            : "Compare quotes against recent purchases and request best-and-final offers for top SKUs. (Heuristic fallback — validate numbers manually.)";

        return { success: true, data: { variances, negotiationStrategy, potentialSavings } };
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

            GROUNDING: Base risk score ONLY on provided metrics.
            Return JSON:
            {
                overallRiskLevel: "low" | "medium" | "high" | "critical",
                riskScore: number (0-100),
                mitigationStrategy: string,
                keyAlerts: string[]
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse risk analysis" };
    } catch (error) {
        console.error("Risk Analysis Error, using heuristic fallback:", error);
        const onTime = Number(supplierData.onTimeDelivery || supplierData.onTime || 90);
        const quality = Number(supplierData.qualityScore || supplierData.quality || 90);
        const financial = Number(supplierData.riskScore || supplierData.financialRisk || 50);

        const riskScore = Math.round(
            (100 - onTime) * RISK_WEIGHT_ON_TIME +
            (100 - quality) * RISK_WEIGHT_QUALITY +
            financial * RISK_WEIGHT_FINANCIAL
        );
        const boundedScore = Math.min(100, Math.max(0, riskScore));
        const overallRiskLevel = riskLevelFromScore(boundedScore);

        const keyAlerts = [];
        if (onTime < 90) keyAlerts.push("On-time delivery below 90%");
        if (quality < 85) keyAlerts.push("Quality score below 85%");
        if (financial > 60) keyAlerts.push("Financial risk above threshold");

        return {
            success: true,
            data: {
                overallRiskLevel,
                riskScore: boundedScore,
                mitigationStrategy: "Diversify volume across 2 suppliers and request quarterly scorecards. (Heuristic fallback — validate).",
                keyAlerts: [...keyAlerts, "Heuristic scoring used because AI model was unavailable."]
            }
        };
    }
}

/**
 * Spend Analysis Agent
 * Identifies savings opportunities across the platform
 */
export async function analyzeSpend(orders: OrderLike[], suppliers: SupplierLike[]) {
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

            GROUNDING: Analyze ONLY the provided orders and suppliers.
            Return JSON:
            {
                totalSavingPotential: number,
                opportunities: [ { type: "consolidation" | "contract" | "arbitrage", description: string, estimatedSavings: number } ],
                actionPlan: string
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse spend analysis" };
    } catch (error) {
        console.error("Spend Analysis Error, using heuristic fallback:", error);
        const total = orders.reduce((acc, o) => acc + Number(o.totalAmount || o.amount || 0), 0);
        const avg = orders.length ? total / orders.length : 0;
        const overlappingCategories = new Set<string>();
        suppliers.forEach((s) => {
            if (s.category) overlappingCategories.add(s.category);
        });

        const opportunities = Array.from(overlappingCategories).slice(0, 3).map((cat) => ({
            type: "consolidation",
            description: `Consolidate spend in category '${cat}' with 1-2 strategic suppliers.`,
            estimatedSavings: Math.round(avg * ESTIMATED_CONSOLIDATION_SAVINGS_RATE)
        }));

        return {
            success: true,
            data: {
                totalSavingPotential: Math.round(total * TOTAL_SAVINGS_PERCENTAGE),
                opportunities,
                actionPlan: "Negotiate volume contracts for top categories, rebid high-variance SKUs, and enforce approval for off-contract spend. (Heuristic fallback — validate figures.)"
            }
        };
    }
}
/**
 * Contract Intelligence Agent
 * Extracts legal terms from contract documents
 */
export async function parseContractDocument(fileData: string, fileName: string) {
    const session = await auth();
    if (!session) return { success: false, error: "Unauthorized" };

    try {
        const prompt = `
            You are a specialized Legal AI Agent. Your task is to extract key legal terms from the attached contract document.
            File Name: ${fileName}
            
            Extract the following fields in JSON format:
            1. effectiveDate: string (ISO date format YYYY-MM-DD if found)
            2. expirationDate: string (ISO date format YYYY-MM-DD if found)
            3. noticePeriodDays: number (notice required for termination/renewal)
            4. liabilityCapAmount: number (monetary value of liability cap)
            5. priceLockDurationMonths: number (how long prices are fixed)
            6. autoRenewal: boolean (true if the contract auto-renews)
            7. summary: string (1-2 sentence summary of the contract purpose)

            If a field is not found, return null. 
            For liabilityCapAmount, convert "2x contract value" or similar relative terms to a best-guess number if possible, or null.
            GROUNDING: Extract ONLY from provided contract text.
            Return ONLY the JSON.
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
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
            const parsed = safeParseJsonMatch(jsonMatch);
            if (parsed.success) return parsed;
        }

        return { success: false, error: "Failed to parse legal data from AI response" };
    } catch (error) {
        console.error("Contract Parsing Error, using heuristic fallback:", error);
        const text = decodeTextFromBase64(fileData);
        const dateMatches = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|20\d{2}\/\d{2}\/\d{2})\b/g)].map(m => m[1]);
        const liabilityMatch = text.match(/(?:cap|liability)[^0-9]{0,10}([\d.,]+)/i);
        const renewal = /auto[-\s]?renew/i.test(text);

        return {
            success: true,
            data: {
                effectiveDate: dateMatches[0] || null,
                expirationDate: dateMatches[1] || null,
                noticePeriodDays: 30,
                liabilityCapAmount: liabilityMatch ? parseFloat(liabilityMatch[1].replace(/,/g, "")) : null,
                priceLockDurationMonths: 12,
                autoRenewal: renewal,
                summary: "Heuristic contract summary generated without AI model. Review key dates and liability terms manually."
            }
        };
    }
}
