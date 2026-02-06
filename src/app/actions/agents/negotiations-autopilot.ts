/**
 * Negotiations Autopilot Agent
 * AI-powered negotiation strategy and counter-offer generation
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    rfqs, rfqSuppliers, rfqItems, suppliers, parts, procurementOrders
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAiModel } from "@/lib/ai-provider";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult, NegotiationStrategy } from "@/lib/ai/agent-types";

/**
 * Generate AI-powered negotiation strategy for an RFQ
 */
export async function generateNegotiationStrategy(
    rfqId: string,
    targetSupplierId: string
): Promise<AgentResult<NegotiationStrategy>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "negotiations-autopilot",
            timestamp: new Date()
        };
    }

    try {
        // Get RFQ details
        const rfqData = await db
            .select({
                id: rfqs.id,
                title: rfqs.title,
                description: rfqs.description,
                status: rfqs.status
            })
            .from(rfqs)
            .where(eq(rfqs.id, rfqId))
            .limit(1);

        if (rfqData.length === 0) {
            return {
                success: false,
                error: "RFQ not found",
                confidence: 0,
                executionTimeMs: Date.now() - startTime,
                agentName: "negotiations-autopilot",
                timestamp: new Date()
            };
        }

        // Get all supplier quotes for this RFQ
        const supplierQuotes = await db
            .select({
                supplierId: rfqSuppliers.supplierId,
                supplierName: suppliers.name,
                quoteAmount: rfqSuppliers.quoteAmount,
                status: rfqSuppliers.status,
                riskScore: suppliers.riskScore,
                performanceScore: suppliers.performanceScore,
                onTimeDeliveryRate: suppliers.onTimeDeliveryRate
            })
            .from(rfqSuppliers)
            .innerJoin(suppliers, eq(rfqSuppliers.supplierId, suppliers.id))
            .where(eq(rfqSuppliers.rfqId, rfqId));

        // Get target supplier details
        const targetSupplier = supplierQuotes.find(s => s.supplierId === targetSupplierId);
        if (!targetSupplier || !targetSupplier.quoteAmount) {
            return {
                success: false,
                error: "Target supplier hasn't submitted a quote",
                confidence: 0,
                executionTimeMs: Date.now() - startTime,
                agentName: "negotiations-autopilot",
                timestamp: new Date()
            };
        }

        // Get historical pricing for these parts
        const rfqItemsData = await db
            .select({
                partId: rfqItems.partId,
                partName: parts.name,
                partSku: parts.sku,
                quantity: rfqItems.quantity,
                historicalPrice: parts.price
            })
            .from(rfqItems)
            .innerJoin(parts, eq(rfqItems.partId, parts.id))
            .where(eq(rfqItems.rfqId, rfqId));

        // Get historical orders with this supplier
        const historicalOrders = await db
            .select({
                totalAmount: procurementOrders.totalAmount,
                createdAt: procurementOrders.createdAt,
                savingsAmount: procurementOrders.savingsAmount
            })
            .from(procurementOrders)
            .where(eq(procurementOrders.supplierId, targetSupplierId))
            .orderBy(desc(procurementOrders.createdAt))
            .limit(10);

        // Calculate alternatives
        const competitiveQuotes = supplierQuotes
            .filter(s => s.supplierId !== targetSupplierId && s.quoteAmount)
            .map(s => ({
                id: s.supplierId,
                name: s.supplierName,
                estimatedPrice: Number(s.quoteAmount)
            }))
            .sort((a, b) => a.estimatedPrice - b.estimatedPrice);

        // Generate strategy using AI
        const strategy = await generateStrategyWithAI({
            rfq: rfqData[0],
            targetSupplier,
            competitiveQuotes,
            rfqItems: rfqItemsData,
            historicalOrders,
            allQuotes: supplierQuotes
        });

        await TelemetryService.trackMetric(
            "NegotiationsAutopilot",
            "strategy_generated",
            strategy.suggestedCounterOffer
        );

        return {
            success: true,
            data: strategy,
            confidence: 78,
            executionTimeMs: Date.now() - startTime,
            agentName: "negotiations-autopilot",
            timestamp: new Date(),
            reasoning: `Analyzed ${competitiveQuotes.length} competing quotes and ${historicalOrders.length} historical orders to generate negotiation strategy`,
            sources: ["rfq_quotes", "historical_orders", "supplier_performance", "market_data"]
        };

    } catch (error) {
        console.error("Negotiations Autopilot Error:", error);
        await TelemetryService.trackError(
            "NegotiationsAutopilot",
            "strategy_failed",
            error instanceof Error ? error : new Error(String(error))
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Strategy generation failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "negotiations-autopilot",
            timestamp: new Date()
        };
    }
}

/**
 * Generate negotiation strategy using AI
 */
async function generateStrategyWithAI(data: {
    rfq: { title: string; description: string | null };
    targetSupplier: {
        supplierId: string;
        supplierName: string;
        quoteAmount: string | null;
        performanceScore: number | null;
        riskScore: number | null;
        onTimeDeliveryRate: string | null;
    };
    competitiveQuotes: { id: string; name: string; estimatedPrice: number }[];
    rfqItems: { partName: string; partSku: string; quantity: number; historicalPrice: string | null }[];
    historicalOrders: { totalAmount: string | null; savingsAmount: string | null }[];
    allQuotes: { supplierName: string; quoteAmount: string | null }[];
}): Promise<NegotiationStrategy> {
    const currentOffer = Number(data.targetSupplier.quoteAmount || 0);

    // Calculate baseline metrics
    const lowestCompetitorQuote = data.competitiveQuotes.length > 0
        ? data.competitiveQuotes[0].estimatedPrice
        : currentOffer;

    const historicalTotalValue = data.historicalOrders.reduce(
        (sum, o) => sum + Number(o.totalAmount || 0), 0
    );

    try {
        const model = await getAiModel("gemini-1.5-flash");

        const prompt = `
            You are a senior procurement negotiation expert. Generate a negotiation strategy for the following scenario.
            
            RFQ: ${data.rfq.title}
            ${data.rfq.description ? `Description: ${data.rfq.description}` : ''}
            
            Target Supplier: ${data.targetSupplier.supplierName}
            - Current Quote: ₹${currentOffer.toLocaleString()}
            - Performance Score: ${data.targetSupplier.performanceScore ?? 'Unknown'}/100
            - Risk Score: ${data.targetSupplier.riskScore ?? 'Unknown'}/100
            - On-Time Delivery: ${data.targetSupplier.onTimeDeliveryRate ?? 'Unknown'}%
            
            Competitive Landscape:
            ${data.allQuotes.filter(q => q.quoteAmount).map(q => `- ${q.supplierName}: ₹${Number(q.quoteAmount).toLocaleString()}`).join('\n')}
            
            Items in RFQ:
            ${data.rfqItems.map(i => `- ${i.partName} (${i.partSku}): Qty ${i.quantity}, Historical Price: ₹${Number(i.historicalPrice || 0).toLocaleString()}`).join('\n')}
            
            Historical Relationship:
            - Total past business: ₹${historicalTotalValue.toLocaleString()}
            - Number of past orders: ${data.historicalOrders.length}
            
            Generate a negotiation strategy in this exact JSON format:
            {
                "targetPrice": <realistic target price number>,
                "walkAwayPrice": <maximum acceptable price number>,
                "suggestedCounterOffer": <initial counter-offer number>,
                "counterOfferJustification": "<1-2 sentence justification>",
                "leverage": ["<leverage point 1>", "<leverage point 2>"],
                "weaknesses": ["<weakness 1>", "<weakness 2>"],
                "negotiationTactics": ["<tactic 1>", "<tactic 2>", "<tactic 3>"]
            }
            
            Consider: Market position, competitive quotes, historical relationship, supplier performance.
            Be realistic - targets should be achievable, typically 5-15% below current offer.
            Return ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            return {
                rfqId: undefined,
                supplierId: data.targetSupplier.supplierId,
                supplierName: data.targetSupplier.supplierName,
                currentOffer,
                targetPrice: parsed.targetPrice,
                walkAwayPrice: parsed.walkAwayPrice,
                suggestedCounterOffer: parsed.suggestedCounterOffer,
                counterOfferJustification: parsed.counterOfferJustification,
                leverage: parsed.leverage || [],
                weaknesses: parsed.weaknesses || [],
                negotiationTactics: parsed.negotiationTactics || [],
                alternativeSuppliers: data.competitiveQuotes.slice(0, 3)
            };
        }
    } catch (error) {
        console.warn("AI strategy generation failed, using heuristics:", error);
    }

    // Fallback: Heuristic-based strategy
    const targetPrice = Math.round(Math.min(currentOffer * 0.92, lowestCompetitorQuote * 1.02));
    const walkAwayPrice = Math.round(currentOffer * 0.98);
    const suggestedCounterOffer = Math.round(currentOffer * 0.88);

    const leverage: string[] = [];
    const weaknesses: string[] = [];

    if (data.competitiveQuotes.length > 0 && lowestCompetitorQuote < currentOffer) {
        leverage.push(`Competitive quote from ${data.competitiveQuotes[0].name} at ₹${lowestCompetitorQuote.toLocaleString()}`);
    }
    if (historicalTotalValue > 1000000) {
        leverage.push(`Strong historical relationship with ₹${historicalTotalValue.toLocaleString()} in past business`);
    }
    if ((data.targetSupplier.performanceScore || 0) > 80) {
        weaknesses.push("High-performing supplier - may have less price flexibility");
    }
    if (data.competitiveQuotes.length < 2) {
        weaknesses.push("Limited competitive alternatives");
    }

    return {
        rfqId: undefined,
        supplierId: data.targetSupplier.supplierId,
        supplierName: data.targetSupplier.supplierName,
        currentOffer,
        targetPrice,
        walkAwayPrice,
        suggestedCounterOffer,
        counterOfferJustification: `Based on competitive analysis and historical pricing, a ${((1 - suggestedCounterOffer / currentOffer) * 100).toFixed(1)}% reduction is justified.`,
        leverage: leverage.length > 0 ? leverage : ["Volume commitment potential", "Long-term partnership opportunity"],
        weaknesses: weaknesses.length > 0 ? weaknesses : ["Market timing may be unfavorable"],
        negotiationTactics: [
            "Lead with competitive alternatives",
            "Propose longer contract term for better pricing",
            "Request volume-based tiered pricing"
        ],
        alternativeSuppliers: data.competitiveQuotes.slice(0, 3)
    };
}

/**
 * Generate counter-offer email draft
 */
export async function generateCounterOfferEmail(
    strategy: NegotiationStrategy
): Promise<{ success: boolean; email?: string; error?: string }> {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const model = await getAiModel("gemini-1.5-flash");

        const prompt = `
            Write a professional procurement counter-offer email based on this negotiation strategy:
            
            Supplier: ${strategy.supplierName}
            Current Offer: ₹${strategy.currentOffer.toLocaleString()}
            Counter-Offer: ₹${strategy.suggestedCounterOffer.toLocaleString()}
            Justification: ${strategy.counterOfferJustification}
            
            Key points to include:
            ${strategy.leverage.map(l => `- ${l}`).join('\n')}
            
            Tactics:
            ${strategy.negotiationTactics.map(t => `- ${t}`).join('\n')}
            
            Write in a professional but firm tone. Be respectful but clear about expectations.
            Keep it concise (150-200 words).
            Use Indian Rupee format (₹).
        `;

        const result = await model.generateContent(prompt);
        const email = result.response.text();

        return { success: true, email };
    } catch (error) {
        console.error("Counter-offer email generation failed:", error);
        return { success: false, error: "Failed to generate email" };
    }
}
