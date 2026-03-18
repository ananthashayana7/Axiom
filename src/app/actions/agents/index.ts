'use server'

/**
 * Agent Index - Central export for all AI agents
 */

import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";

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

import { AGENT_REGISTRY, AGENT_BUNDLES, type AgentName, type AgentBundleName } from './registry';

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

export { type AgentName, type AgentBundleName };

/**
 * Centralized dispatcher for running agents from the UI
 */
export async function triggerAgentDispatch(agentName: AgentName) {
    const started = Date.now();
    console.log(`[AgentDispatcher] Triggering ${agentName}...`);

    const agentMeta = AGENT_REGISTRY.find(a => a.name === agentName);
    if (!agentMeta) {
        return {
            success: false,
            error: `Dispatcher not implemented for ${agentName}`,
            agentName: "system",
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0
        };
    }

    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role ?? 'guest';

    if (!session?.user) {
        await TelemetryService.trackEvent('AgentDispatch', 'blocked_unauthenticated', { agentName });
        return {
            success: false,
            error: "You must be signed in to dispatch AI agents.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0
        };
    }

    if (!agentMeta.isEnabled) {
        await TelemetryService.trackEvent('AgentDispatch', 'blocked_disabled', { agentName, role });
        return {
            success: false,
            error: "This agent is currently disabled.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0
        };
    }

    if (agentMeta.requiresApproval && role !== 'admin') {
        await TelemetryService.trackEvent('AgentDispatch', 'blocked_requires_approval', { agentName, role });
        return {
            success: false,
            error: "Admin approval is required before this agent can run. Please request an administrator to dispatch it.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0
        };
    }

    const enforceTimeout = <T>(promise: Promise<T>) =>
        Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Agent ${agentName} timed out after ${agentMeta.timeoutMs}ms`)), agentMeta.timeoutMs)
            )
        ]);

    try {
        let result: {
            success: boolean;
            error?: string;
            agentName?: string;
            timestamp?: Date;
            executionTimeMs?: number;
            confidence?: number;
            reasoning?: string;
        };

        switch (agentName) {
            case 'demand-forecasting':
                result = await enforceTimeout(runDemandForecastingAgent());
                break;
            case 'fraud-detection':
                result = await enforceTimeout(runFraudDetectionAgent());
                break;
            case 'payment-optimizer':
                result = await enforceTimeout(runPaymentOptimizationAgent());
                break;
            case 'negotiations-autopilot':
                // Requires specific context, but we can run a global analysis as a "pilot"
                result = {
                    success: false,
                    error: "Negotiations Autopilot requires a specific RFQ context. Please use the RFQ Detail page.",
                    agentName: "negotiations-autopilot",
                    timestamp: new Date(),
                    executionTimeMs: 0,
                    confidence: 0
                };
                break;
            case 'contract-clause-analyzer':
                result = await enforceTimeout(analyzeContractClauses());
                break;
            case 'smart-approval-routing':
                result = await enforceTimeout(processAutoApprovals());
                break;
            case 'predictive-bottleneck':
                result = await enforceTimeout(detectBottlenecks());
                break;
            case 'auto-remediation':
                result = await enforceTimeout(runAutoRemediation());
                break;
            case 'scenario-modeling':
                result = await enforceTimeout(runScenarioAnalysis({
                    scenarioType: 'price_change',
                    description: 'Global 5% market price volatility analysis',
                    parameters: { percentChange: 5 }
                }));
                break;
            case 'supplier-ecosystem':
                result = await enforceTimeout(buildSupplierEcosystem());
                break;
            default:
                result = {
                    success: false,
                    error: `Dispatcher not implemented for ${agentName}`,
                    agentName: "system",
                    timestamp: new Date(),
                    executionTimeMs: 0,
                    confidence: 0
                };
                break;
        }

        return {
            ...result,
            agentName: result.agentName ?? agentName,
            timestamp: result.timestamp ?? new Date(),
            executionTimeMs: result.executionTimeMs ?? Date.now() - started,
            confidence: result.confidence ?? 0
        };
    } catch (error) {
        console.error(`[AgentDispatcher] Error running ${agentName}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Internal execution error",
            agentName: agentName as string,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
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
