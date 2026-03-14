/**
 * Agent Index - Central export for all AI agents
 */

// P0 Agents
import {
    runDemandForecastingAgent,
    getReplenishmentAlerts
} from './demand-forecasting';

import {
    runFraudDetectionAgent,
    getOpenFraudAlerts,
    resolveFraudAlert
} from './fraud-detection';

import {
    runPaymentOptimizationAgent,
    getPaymentOptimizationSummary,
    executePaymentOptimization,
    dismissPaymentOptimization
} from './payment-optimizer';

// P1 Agents
import {
    generateNegotiationStrategy,
    generateCounterOfferEmail
} from './negotiations-autopilot';

import {
    analyzeContractClauses,
    compareContracts
} from './contract-clause-analyzer';

// Phase 3: Intelligent Workflows
import {
    calculateApprovalRoute,
    processAutoApprovals,
    getApprovalRoutingAnalytics
} from './smart-approval-routing';

import {
    detectBottlenecks,
    getBottleneckAnalytics
} from './predictive-bottleneck';

import {
    runAutoRemediation,
    getRemediationRules,
    getRemediationHistory
} from './auto-remediation';

// Phase 4: Advanced Analytics
import {
    runScenarioAnalysis,
    compareScenarios,
    getScenarioTemplates
} from './scenario-modeling';

import {
    buildSupplierEcosystem,
    analyzeSupplierDependency
} from './supplier-ecosystem';

export {
    runDemandForecastingAgent,
    getReplenishmentAlerts,
    runFraudDetectionAgent,
    getOpenFraudAlerts,
    resolveFraudAlert,
    runPaymentOptimizationAgent,
    getPaymentOptimizationSummary,
    executePaymentOptimization,
    dismissPaymentOptimization,
    generateNegotiationStrategy,
    generateCounterOfferEmail,
    analyzeContractClauses,
    compareContracts,
    calculateApprovalRoute,
    processAutoApprovals,
    getApprovalRoutingAnalytics,
    detectBottlenecks,
    getBottleneckAnalytics,
    runAutoRemediation,
    getRemediationRules,
    getRemediationHistory,
    runScenarioAnalysis,
    compareScenarios,
    getScenarioTemplates,
    buildSupplierEcosystem,
    analyzeSupplierDependency
};

// Agent metadata for registry
export const AGENT_REGISTRY = [
    {
        name: 'demand-forecasting',
        displayName: 'Demand Forecasting',
        description: 'Predicts future part requirements based on historical patterns',
        category: 'procurement',
        triggers: ['scheduled', 'manual', 'copilot'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 60000,
        version: '1.0.0'
    },
    {
        name: 'fraud-detection',
        displayName: 'Fraud Detection',
        description: 'Identifies anomalies and suspicious patterns in transactions',
        category: 'risk',
        triggers: ['scheduled', 'event', 'manual'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 45000,
        version: '1.0.0'
    },
    {
        name: 'payment-optimizer',
        displayName: 'Payment Optimizer',
        description: 'Analyzes payment timing for early discount capture',
        category: 'financial',
        triggers: ['scheduled', 'manual', 'copilot'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 30000,
        version: '1.0.0'
    },
    {
        name: 'negotiations-autopilot',
        displayName: 'Negotiations Autopilot',
        description: 'Generates negotiation strategies and counter-offers',
        category: 'procurement',
        triggers: ['manual', 'copilot'],
        isEnabled: true,
        requiresApproval: true,
        maxRetries: 2,
        timeoutMs: 45000,
        version: '1.0.0'
    },
    {
        name: 'contract-clause-analyzer',
        displayName: 'Contract Clause Analyzer',
        description: 'Identifies risky clauses and compliance issues',
        category: 'compliance',
        triggers: ['manual', 'event', 'copilot'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 60000,
        version: '1.0.0'
    },
    {
        name: 'smart-approval-routing',
        displayName: 'Smart Approval Routing',
        description: 'ML-based approval path optimization with risk assessment',
        category: 'workflow',
        triggers: ['event', 'manual'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 30000,
        version: '1.0.0'
    },
    {
        name: 'predictive-bottleneck',
        displayName: 'Predictive Bottleneck',
        description: 'Identifies workflow delays and predicts bottlenecks',
        category: 'workflow',
        triggers: ['scheduled', 'manual'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 45000,
        version: '1.0.0'
    },
    {
        name: 'auto-remediation',
        displayName: 'Auto-Remediation',
        description: 'Automatically resolves common workflow issues',
        category: 'workflow',
        triggers: ['scheduled', 'manual'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 60000,
        version: '1.0.0'
    },
    {
        name: 'scenario-modeling',
        displayName: 'Scenario Modeling',
        description: 'AI-powered what-if analysis for procurement decisions',
        category: 'analytics',
        triggers: ['manual', 'copilot'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 60000,
        version: '1.0.0'
    },
    {
        name: 'supplier-ecosystem',
        displayName: 'Supplier Ecosystem',
        description: 'Maps supplier relationships and risk propagation',
        category: 'analytics',
        triggers: ['scheduled', 'manual'],
        isEnabled: true,
        requiresApproval: false,
        maxRetries: 2,
        timeoutMs: 90000,
        version: '1.0.0'
    }
] as const;

export type AgentName = typeof AGENT_REGISTRY[number]['name'];

export type AgentBundleName = 'post-import' | 'compliance-sweep' | 'workflow-recovery';

const AGENT_BUNDLES: Record<AgentBundleName, AgentName[]> = {
    'post-import': ['demand-forecasting', 'fraud-detection', 'payment-optimizer'],
    'compliance-sweep': ['fraud-detection', 'contract-clause-analyzer', 'payment-optimizer'],
    'workflow-recovery': ['predictive-bottleneck', 'smart-approval-routing', 'auto-remediation'],
};

/**
 * Centralized dispatcher for running agents from the UI
 */
export async function triggerAgentDispatch(agentName: AgentName) {
    console.log(`[AgentDispatcher] Triggering ${agentName}...`);

    try {
        switch (agentName) {
            case 'demand-forecasting':
                return await runDemandForecastingAgent();
            case 'fraud-detection':
                return await runFraudDetectionAgent();
            case 'payment-optimizer':
                return await runPaymentOptimizationAgent();
            case 'negotiations-autopilot':
                // Requires specific context, but we can run a global analysis as a "pilot"
                return {
                    success: false,
                    error: "Negotiations Autopilot requires a specific RFQ context. Please use the RFQ Detail page.",
                    agentName: "negotiations-autopilot",
                    timestamp: new Date(),
                    executionTimeMs: 0,
                    confidence: 0
                };
            case 'contract-clause-analyzer':
                return await analyzeContractClauses();
            case 'smart-approval-routing':
                return await processAutoApprovals();
            case 'predictive-bottleneck':
                return await detectBottlenecks();
            case 'auto-remediation':
                return await runAutoRemediation();
            case 'scenario-modeling':
                return await runScenarioAnalysis({
                    scenarioType: 'price_change',
                    description: 'Global 5% market price volatility analysis',
                    parameters: { percentChange: 5 }
                });
            case 'supplier-ecosystem':
                return await buildSupplierEcosystem();
            default:
                return {
                    success: false,
                    error: `Dispatcher not implemented for ${agentName}`,
                    agentName: "system",
                    timestamp: new Date(),
                    executionTimeMs: 0,
                    confidence: 0
                };
        }
    } catch (error) {
        console.error(`[AgentDispatcher] Error running ${agentName}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Internal execution error",
            agentName: agentName as string,
            timestamp: new Date(),
            executionTimeMs: 0,
            confidence: 0
        };
    }
}

export async function triggerAgentBundle(bundleName: AgentBundleName) {
    const agents = AGENT_BUNDLES[bundleName];
    const results: Array<{ agent: AgentName; success: boolean; error?: string; executionTimeMs: number }> = [];

    for (const agent of agents) {
        const started = Date.now();
        const result = await triggerAgentDispatch(agent);
        results.push({
            agent,
            success: result.success,
            error: result.success ? undefined : result.error,
            executionTimeMs: result.executionTimeMs || Date.now() - started,
        });
    }

    return {
        success: results.every((r) => r.success),
        bundle: bundleName,
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
    };
}
