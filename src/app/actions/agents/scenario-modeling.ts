/**
 * Scenario Modeling Agent (What-If Analysis)
 * AI-powered scenario analysis for procurement decisions
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    suppliers, parts, procurementOrders, contracts
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getAiModel } from "@/lib/ai-provider";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult } from "@/lib/ai/agent-types";

interface ScenarioInput {
    scenarioType: 'price_change' | 'supplier_switch' | 'volume_change' | 'lead_time' | 'currency_fluctuation';
    description: string;
    parameters: Record<string, number | string>;
}

interface ScenarioOutcome {
    category: string;
    metric: string;
    currentValue: number | string;
    projectedValue: number | string;
    changePercent?: number;
    impact: 'positive' | 'negative' | 'neutral';
}

interface ScenarioResult {
    scenarioId: string;
    title: string;
    description: string;
    outcomes: ScenarioOutcome[];
    overallImpact: 'highly_positive' | 'positive' | 'neutral' | 'negative' | 'highly_negative';
    riskFactors: string[];
    recommendations: string[];
    confidenceScore: number;
}

/**
 * Run what-if scenario analysis
 */
export async function runScenarioAnalysis(
    scenario: ScenarioInput
): Promise<AgentResult<ScenarioResult>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date()
        };
    }

    try {
        // Get relevant baseline data
        const baselineData = await getBaselineData(scenario.scenarioType);

        // Generate scenario analysis
        const result = await generateScenarioWithAI(scenario, baselineData);

        await TelemetryService.trackEvent("ScenarioModeling", "analysis_completed", {
            scenarioType: scenario.scenarioType,
            overallImpact: result.overallImpact
        });

        return {
            success: true,
            data: result,
            confidence: result.confidenceScore,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: `Analyzed ${scenario.scenarioType} scenario with ${result.outcomes.length} projected impacts.`,
            sources: ["historical_orders", "supplier_data", "contracts"]
        };

    } catch (error) {
        console.error("Scenario Modeling Error:", error);

        // Return fallback analysis
        return {
            success: true,
            data: generateFallbackScenario(scenario),
            confidence: 60,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: "Used rule-based analysis due to AI unavailability."
        };
    }
}

async function getBaselineData(scenarioType: string): Promise<Record<string, unknown>> {
    const baseline: Record<string, unknown> = {};

    // Get supplier stats
    const supplierStats = await db
        .select({
            totalSuppliers: sql<number>`COUNT(*)::int`,
            avgRiskScore: sql<number>`AVG(${suppliers.riskScore})`,
            avgLeadTime: sql<number>`AVG(${suppliers.deliveryReliability})`
        })
        .from(suppliers)
        .limit(1);

    baseline.suppliers = supplierStats[0];

    // Get order volume stats
    const orderStats = await db
        .select({
            totalOrders: sql<number>`COUNT(*)::int`,
            totalValue: sql<number>`SUM(${procurementOrders.totalAmount}::numeric)`,
            avgOrderValue: sql<number>`AVG(${procurementOrders.totalAmount}::numeric)`
        })
        .from(procurementOrders)
        .limit(1);

    baseline.orders = orderStats[0];

    // Get part count
    const partStats = await db
        .select({
            totalParts: sql<number>`COUNT(*)::int`,
            avgUnitCost: sql<number>`AVG(${parts.unitCost})`
        })
        .from(parts)
        .limit(1);

    baseline.parts = partStats[0];

    return baseline;
}

async function generateScenarioWithAI(
    scenario: ScenarioInput,
    baselineData: Record<string, unknown>
): Promise<ScenarioResult> {
    const model = await getAiModel();

    const prompt = `You are a procurement analytics expert. Analyze this what-if scenario and provide projections.

SCENARIO:
Type: ${scenario.scenarioType}
Description: ${scenario.description}
Parameters: ${JSON.stringify(scenario.parameters)}

CURRENT BASELINE DATA:
${JSON.stringify(baselineData, null, 2)}

Provide a detailed analysis in JSON format:
{
    "title": "Brief scenario title",
    "description": "One sentence summary of the scenario",
    "outcomes": [
        {
            "category": "Cost/Delivery/Risk/Quality",
            "metric": "Specific metric name",
            "currentValue": "current value or number",
            "projectedValue": "projected value or number",
            "changePercent": number or null,
            "impact": "positive/negative/neutral"
        }
    ],
    "overallImpact": "highly_positive/positive/neutral/negative/highly_negative",
    "riskFactors": ["List of 2-4 risks to consider"],
    "recommendations": ["List of 2-4 actionable recommendations"],
    "confidenceScore": number between 60-95
}

Respond ONLY with valid JSON.`;

    const response = await model.generateContent(prompt);
    const text = response.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
        scenarioId: `scenario-${Date.now()}`,
        ...parsed
    };
}

function generateFallbackScenario(scenario: ScenarioInput): ScenarioResult {
    const outcomes: ScenarioOutcome[] = [];
    let overallImpact: ScenarioResult['overallImpact'] = 'neutral';
    const recommendations: string[] = [];
    const riskFactors: string[] = [];

    switch (scenario.scenarioType) {
        case 'price_change':
            const priceChange = Number(scenario.parameters.percentChange || 10);
            outcomes.push({
                category: 'Cost',
                metric: 'Total Procurement Spend',
                currentValue: '₹10,00,000',
                projectedValue: `₹${(1000000 * (1 + priceChange / 100)).toLocaleString()}`,
                changePercent: priceChange,
                impact: priceChange > 0 ? 'negative' : 'positive'
            });
            overallImpact = priceChange > 15 ? 'negative' : priceChange > 5 ? 'neutral' : 'positive';
            recommendations.push('Consider alternate suppliers for price-sensitive items');
            recommendations.push('Negotiate long-term contracts to lock in current pricing');
            riskFactors.push('Market volatility may affect projections');
            break;

        case 'supplier_switch':
            outcomes.push({
                category: 'Risk',
                metric: 'Supply Chain Reliability',
                currentValue: '92%',
                projectedValue: '85%',
                changePercent: -7,
                impact: 'negative'
            });
            outcomes.push({
                category: 'Cost',
                metric: 'Unit Cost Savings',
                currentValue: '0%',
                projectedValue: '8%',
                changePercent: 8,
                impact: 'positive'
            });
            overallImpact = 'neutral';
            recommendations.push('Conduct pilot run before full switch');
            recommendations.push('Maintain backup supplier relationship');
            riskFactors.push('New supplier learning curve');
            riskFactors.push('Quality control during transition');
            break;

        case 'volume_change':
            const volumeChange = Number(scenario.parameters.percentChange || 20);
            outcomes.push({
                category: 'Cost',
                metric: 'Per-Unit Cost',
                currentValue: '₹100',
                projectedValue: volumeChange > 0 ? '₹92' : '₹108',
                changePercent: volumeChange > 0 ? -8 : 8,
                impact: volumeChange > 0 ? 'positive' : 'negative'
            });
            outcomes.push({
                category: 'Inventory',
                metric: 'Carrying Cost',
                currentValue: '₹50,000',
                projectedValue: volumeChange > 0 ? '₹70,000' : '₹35,000',
                changePercent: volumeChange > 0 ? 40 : -30,
                impact: volumeChange > 0 ? 'negative' : 'positive'
            });
            overallImpact = volumeChange > 30 ? 'positive' : 'neutral';
            recommendations.push('Negotiate volume discounts with suppliers');
            riskFactors.push('Storage capacity constraints');
            break;

        default:
            outcomes.push({
                category: 'General',
                metric: 'Overall Impact',
                currentValue: 'Baseline',
                projectedValue: 'Uncertain',
                impact: 'neutral'
            });
            recommendations.push('Gather more data for accurate projections');
    }

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: `${scenario.scenarioType.replace(/_/g, ' ')} Analysis`,
        description: scenario.description || `Impact analysis for ${scenario.scenarioType} scenario`,
        outcomes,
        overallImpact,
        riskFactors: riskFactors.length ? riskFactors : ['Limited historical data for comparison'],
        recommendations: recommendations.length ? recommendations : ['Monitor outcomes and adjust strategy'],
        confidenceScore: 65
    };
}

/**
 * Compare multiple scenarios
 */
export async function compareScenarios(
    scenarios: ScenarioInput[]
): Promise<AgentResult<{
    comparisons: ScenarioResult[];
    recommendation: string;
    bestScenario: number;
}>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date()
        };
    }

    try {
        const comparisons: ScenarioResult[] = [];

        for (const scenario of scenarios.slice(0, 5)) { // Max 5 scenarios
            const result = await runScenarioAnalysis(scenario);
            if (result.success && result.data) {
                comparisons.push(result.data);
            }
        }

        // Score scenarios
        const impactScores = {
            highly_positive: 5,
            positive: 4,
            neutral: 3,
            negative: 2,
            highly_negative: 1
        };

        let bestScore = 0;
        let bestScenario = 0;

        comparisons.forEach((comp, idx) => {
            const score = impactScores[comp.overallImpact] * (comp.confidenceScore / 100);
            if (score > bestScore) {
                bestScore = score;
                bestScenario = idx;
            }
        });

        return {
            success: true,
            data: {
                comparisons,
                recommendation: `Scenario ${bestScenario + 1} (${comparisons[bestScenario]?.title}) offers the best risk-adjusted outcome.`,
                bestScenario
            },
            confidence: 75,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: `Compared ${comparisons.length} scenarios and identified optimal choice.`
        };

    } catch (error) {
        console.error("Scenario Comparison Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Comparison failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date()
        };
    }
}

/**
 * Get pre-built scenario templates
 */
export async function getScenarioTemplates(): Promise<ScenarioInput[]> {
    return [
        {
            scenarioType: 'price_change',
            description: '10% price increase across all suppliers',
            parameters: { percentChange: 10 }
        },
        {
            scenarioType: 'supplier_switch',
            description: 'Switch primary supplier for Category A parts',
            parameters: { category: 'A', newSupplierId: '' }
        },
        {
            scenarioType: 'volume_change',
            description: '25% increase in order volumes',
            parameters: { percentChange: 25 }
        },
        {
            scenarioType: 'lead_time',
            description: 'Lead time reduction through express shipping',
            parameters: { reductionDays: 5, additionalCost: 8 }
        },
        {
            scenarioType: 'currency_fluctuation',
            description: 'USD/INR rate change to 85',
            parameters: { currentRate: 83, projectedRate: 85 }
        }
    ];
}
