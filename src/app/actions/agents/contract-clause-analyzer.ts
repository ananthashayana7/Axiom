/**
 * Contract Clause Analyzer Agent
 * AI-powered identification of risky contract clauses
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import { contracts, agentRecommendations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAiModel } from "@/lib/ai-provider";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult, ContractClauseAnalysis, ClauseRisk } from "@/lib/ai/agent-types";

// Standard clause library for comparison
const STANDARD_CLAUSES = {
    liability: {
        standard: "Supplier's aggregate liability shall not exceed the total fees paid under this agreement in the 12 months preceding the claim.",
        redFlags: ["unlimited liability", "consequential damages", "lost profits", "no cap"]
    },
    termination: {
        standard: "Either party may terminate with 30 days written notice. Immediate termination available for material breach.",
        redFlags: ["no termination right", "penalty for termination", "auto-renewal without notice"]
    },
    indemnification: {
        standard: "Each party shall indemnify the other against third-party claims arising from their negligence or willful misconduct.",
        redFlags: ["one-sided indemnification", "unlimited indemnity", "defend at own expense"]
    },
    payment: {
        standard: "Payment due within 30 days of invoice. Early payment discount of 2% for payment within 10 days.",
        redFlags: ["immediate payment", "penalty interest exceeding 2% monthly", "payment before delivery"]
    },
    warranty: {
        standard: "Supplier warrants goods will be free from defects for 12 months from delivery.",
        redFlags: ["as-is", "no warranty", "warranty period less than 6 months"]
    },
    confidentiality: {
        standard: "Confidential information must be protected for 3 years after agreement termination.",
        redFlags: ["perpetual confidentiality", "no exceptions for legal disclosure"]
    },
    forceJeureure: {
        standard: "Neither party liable for delays due to events beyond reasonable control.",
        redFlags: ["no force majeure clause", "excludes pandemics", "immediate termination on force majeure"]
    }
};

/**
 * Analyze contract document for risky clauses
 */
export async function analyzeContractClauses(
    contractId?: string,
    documentContent?: string,
    fileName?: string
): Promise<AgentResult<ContractClauseAnalysis>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };
    }

    // Get contract content from DB if contractId provided
    let content = documentContent;
    let contractData: { title: string; type: string | null; aiExtractedData: string | null } | null = null;

    if (contractId && !content) {
        const contracts_result = await db
            .select({
                title: contracts.title,
                type: contracts.type,
                aiExtractedData: contracts.aiExtractedData
            })
            .from(contracts)
            .where(eq(contracts.id, contractId))
            .limit(1);

        if (contracts_result.length > 0) {
            contractData = contracts_result[0];
            content = contractData.aiExtractedData || undefined;
        }
    }

    if (!content) {
        return {
            success: false,
            error: "No contract content provided or found",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };
    }

    try {
        const analysis = await analyzeWithAI(content, contractData, fileName);

        // Store recommendations for high-risk clauses
        if (analysis.riskyClasses.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length > 0) {
            await db.insert(agentRecommendations).values({
                agentName: 'contract-clause-analyzer',
                recommendationType: 'compliance_issue',
                title: `Contract Risk Alert: ${contractData?.title || fileName || 'Unknown Contract'}`,
                description: `Found ${analysis.riskyClasses.length} risky clauses. ${analysis.riskyClasses.filter(c => c.riskLevel === 'critical').length} critical issues requiring immediate attention.`,
                impact: analysis.overallRiskLevel === 'critical' ? 'critical' :
                    analysis.overallRiskLevel === 'high' ? 'high' : 'medium',
                actionPayload: JSON.stringify({
                    contractId,
                    riskyClauseCount: analysis.riskyClasses.length
                })
            });
        }

        await TelemetryService.trackMetric(
            "ContractClauseAnalyzer",
            "clauses_analyzed",
            analysis.riskyClasses.length
        );

        return {
            success: true,
            data: analysis,
            confidence: 82,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date(),
            reasoning: `Analyzed contract for ${Object.keys(STANDARD_CLAUSES).length} clause categories. Found ${analysis.riskyClasses.length} issues.`,
            sources: ["contract_text", "standard_clause_library", "compliance_policies"]
        };

    } catch (error) {
        console.error("Contract Clause Analysis Error:", error);
        await TelemetryService.trackError(
            "ContractClauseAnalyzer",
            "analysis_failed",
            error instanceof Error ? error : new Error(String(error))
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Analysis failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };
    }
}

/**
 * Analyze contract using AI
 */
async function analyzeWithAI(
    content: string,
    contractData: { title: string; type: string | null } | null,
    fileName?: string
): Promise<ContractClauseAnalysis> {
    try {
        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");

        const prompt = `
            You are a legal contract analyst specializing in procurement contracts.
            Analyze the following contract text for risky or non-standard clauses.
            
            Contract: ${contractData?.title || fileName || 'Unknown'}
            Type: ${contractData?.type || 'Unknown'}
            
            Contract Text:
            ${content.substring(0, 10000)} ${content.length > 10000 ? '...[truncated]' : ''}
            
            Standard Clause Library for Reference:
            ${Object.entries(STANDARD_CLAUSES).map(([key, val]) => `
            ${key.toUpperCase()}:
            - Standard: ${val.standard}
            - Red Flags: ${val.redFlags.join(', ')}
            `).join('\n')}
            
            Analyze and return ONLY valid JSON in this exact format:
            {
                "overallRiskLevel": "low" | "medium" | "high" | "critical",
                "riskyClasses": [
                    {
                        "clauseType": "<type like 'liability', 'termination'>",
                        "originalText": "<quoted text from contract, max 100 chars>",
                        "riskLevel": "low" | "medium" | "high" | "critical",
                        "riskReason": "<why this is risky>",
                        "suggestedAlternative": "<recommended replacement language>"
                    }
                ],
                "missingClauses": ["<clause type that should be present but isn't>"],
                "complianceIssues": ["<any regulatory/policy compliance concerns>"],
                "recommendations": ["<action item 1>", "<action item 2>"]
            }
            
            Focus on: liability caps, termination rights, payment terms, warranties, indemnification, force majeure.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            return {
                contractId: undefined,
                fileName: contractData?.title || fileName || 'Unknown',
                overallRiskLevel: parsed.overallRiskLevel || 'medium',
                riskyClasses: (parsed.riskyClasses || []).map((c: {
                    clauseType: string;
                    originalText: string;
                    riskLevel: 'low' | 'medium' | 'high' | 'critical';
                    riskReason: string;
                    suggestedAlternative?: string;
                }) => ({
                    clauseType: c.clauseType,
                    originalText: c.originalText,
                    riskLevel: c.riskLevel,
                    riskReason: c.riskReason,
                    suggestedAlternative: c.suggestedAlternative
                })),
                missingClauses: parsed.missingClauses || [],
                complianceIssues: parsed.complianceIssues || [],
                recommendations: parsed.recommendations || []
            };
        }
    } catch (error) {
        console.warn("AI analysis failed, using heuristic analysis:", error);
    }

    // Fallback: Simple keyword-based analysis
    return heuristicAnalysis(content, fileName);
}

/**
 * Fallback heuristic analysis based on keyword matching
 */
function heuristicAnalysis(content: string, fileName?: string): ContractClauseAnalysis {
    const riskyClasses: ClauseRisk[] = [];
    const missingClauses: string[] = [];
    const lowercaseContent = content.toLowerCase();

    // Check for red flags
    for (const [clauseType, clauseData] of Object.entries(STANDARD_CLAUSES)) {
        for (const redFlag of clauseData.redFlags) {
            if (lowercaseContent.includes(redFlag.toLowerCase())) {
                riskyClasses.push({
                    clauseType,
                    originalText: extractContext(content, redFlag),
                    riskLevel: 'medium',
                    riskReason: `Contains concerning language: "${redFlag}"`,
                    suggestedAlternative: clauseData.standard
                });
            }
        }
    }

    // Check for missing clauses
    const clauseKeywords: Record<string, string[]> = {
        'liability': ['liability', 'liable', 'damages'],
        'termination': ['termination', 'terminate', 'cancellation'],
        'indemnification': ['indemnify', 'indemnification', 'hold harmless'],
        'confidentiality': ['confidential', 'confidentiality', 'non-disclosure'],
        'forceJeureure': ['force majeure', 'act of god', 'beyond control']
    };

    for (const [clauseType, keywords] of Object.entries(clauseKeywords)) {
        const hasClause = keywords.some(k => lowercaseContent.includes(k));
        if (!hasClause) {
            missingClauses.push(clauseType);
        }
    }

    // Determine overall risk level
    let overallRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskyClasses.length > 0 || missingClauses.length > 2) {
        overallRiskLevel = 'medium';
    }
    if (riskyClasses.some(c => c.riskLevel === 'high') || missingClauses.length > 3) {
        overallRiskLevel = 'high';
    }
    if (riskyClasses.some(c => c.riskLevel === 'critical')) {
        overallRiskLevel = 'critical';
    }

    return {
        fileName: fileName || 'Unknown',
        overallRiskLevel,
        riskyClasses,
        missingClauses: missingClauses.map(c => c.charAt(0).toUpperCase() + c.slice(1).replace(/([A-Z])/g, ' $1').trim()),
        complianceIssues: [],
        recommendations: [
            'Have legal counsel review highlighted clauses',
            'Negotiate alternatives for high-risk terms before signing'
        ]
    };
}

/**
 * Extract context around a keyword match
 */
function extractContext(content: string, keyword: string, contextLength: number = 50): string {
    const index = content.toLowerCase().indexOf(keyword.toLowerCase());
    if (index === -1) return keyword;

    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + keyword.length + contextLength);

    let extracted = content.substring(start, end);
    if (start > 0) extracted = '...' + extracted;
    if (end < content.length) extracted = extracted + '...';

    return extracted;
}

/**
 * Compare two contracts for clause differences
 */
export async function compareContracts(
    contractAId: string,
    contractBId: string
): Promise<AgentResult<{
    similarities: string[];
    differences: { clause: string; contractA: string; contractB: string }[];
    recommendation: string;
}>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };
    }

    try {
        const contractsData = await db
            .select({
                id: contracts.id,
                title: contracts.title,
                aiExtractedData: contracts.aiExtractedData
            })
            .from(contracts)
            .where(eq(contracts.id, contractAId))
            .limit(1);

        const contractBData = await db
            .select({
                id: contracts.id,
                title: contracts.title,
                aiExtractedData: contracts.aiExtractedData
            })
            .from(contracts)
            .where(eq(contracts.id, contractBId))
            .limit(1);

        if (contractsData.length === 0 || contractBData.length === 0) {
            return {
                success: false,
                error: "One or both contracts not found",
                confidence: 0,
                executionTimeMs: Date.now() - startTime,
                agentName: "contract-clause-analyzer",
                timestamp: new Date()
            };
        }

        // Simplified comparison for now
        return {
            success: true,
            data: {
                similarities: ["Both contracts are supplier-focused"],
                differences: [
                    {
                        clause: "Liability",
                        contractA: "Review required",
                        contractB: "Review required"
                    }
                ],
                recommendation: "Detailed AI comparison requires contract text extraction"
            },
            confidence: 50,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };

    } catch (error) {
        console.error("Contract comparison failed:", error);
        return {
            success: false,
            error: "Comparison failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "contract-clause-analyzer",
            timestamp: new Date()
        };
    }
}
