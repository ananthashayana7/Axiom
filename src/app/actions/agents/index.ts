'use server'

/**
 * Agent Index - Central export for all AI agents
 */

import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";
import type {
    AgentResult,
    DemandForecast,
    FraudAlert,
    PaymentOptimization,
    WorkflowBottleneck,
} from "@/lib/ai/agent-types";

// P0 Agents
import {
    runDemandForecastingAgent,
    getReplenishmentAlerts,
} from './demand-forecasting';

import {
    runFraudDetectionAgent,
    getOpenFraudAlerts,
    resolveFraudAlert,
} from './fraud-detection';

import {
    runPaymentOptimizationAgent,
    getPaymentOptimizationSummary,
    executePaymentOptimization,
    dismissPaymentOptimization,
} from './payment-optimizer';

// P1 Agents
import {
    generateNegotiationStrategy,
    generateCounterOfferEmail,
} from './negotiations-autopilot';

import {
    analyzeContractClauses,
    compareContracts,
} from './contract-clause-analyzer';

// Phase 3: Intelligent Workflows
import {
    calculateApprovalRoute,
    processAutoApprovals,
    getApprovalRoutingAnalytics,
} from './smart-approval-routing';

import {
    detectBottlenecks,
    getBottleneckAnalytics,
} from './predictive-bottleneck';

import {
    runAutoRemediation,
    getRemediationRules,
    getRemediationHistory,
} from './auto-remediation';

// Phase 4: Advanced Analytics
import {
    runScenarioAnalysis,
    compareScenarios,
    getScenarioTemplates,
} from './scenario-modeling';

import {
    buildSupplierEcosystem,
    analyzeSupplierDependency,
} from './supplier-ecosystem';

import {
    AGENT_REGISTRY,
    AGENT_BUNDLES,
    AGENT_BUNDLE_META,
    type AgentName,
    type AgentBundleName,
} from './registry';

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
    analyzeSupplierDependency,
};

export { type AgentName, type AgentBundleName };

export interface AgentDispatchSummary {
    headline: string;
    details: string;
    alertsFound?: number;
    itemsScanned?: number;
    savingsAmount?: number;
    actionsCount?: number;
    link?: string;
}

export interface AgentDispatchResult<T = unknown> extends AgentResult<T> {
    attempts: number;
    dashboardHref: string;
    summary: AgentDispatchSummary;
}

export interface AgentBundleDispatchResult {
    success: boolean;
    bundle: AgentBundleName;
    displayName: string;
    description: string;
    dashboardHref: string;
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{
        agent: AgentName;
        success: boolean;
        error?: string;
        executionTimeMs: number;
        attempts: number;
        dashboardHref: string;
        summary: AgentDispatchSummary;
    }>;
}

export interface AgentDashboardSnapshot {
    generatedAt: string;
    fraudAlerts: number;
    criticalFraudAlerts: number;
    paymentSavings: number;
    pendingPaymentOpportunities: number;
    replenishmentAlerts: number;
    degradedPanels: string[];
    systemWarnings: string[];
}

type DispatchExecutor = () => Promise<AgentResult<unknown>>;

const AGENT_EXECUTORS: Partial<Record<AgentName, DispatchExecutor>> = {
    'demand-forecasting': () => runDemandForecastingAgent(),
    'fraud-detection': () => runFraudDetectionAgent(),
    'payment-optimizer': () => runPaymentOptimizationAgent(),
    'smart-approval-routing': () => processAutoApprovals(),
    'predictive-bottleneck': () => detectBottlenecks(),
    'auto-remediation': () => runAutoRemediation(),
    'scenario-modeling': () =>
        runScenarioAnalysis({
            scenarioType: 'price_change',
            description: 'Global 5% market price volatility analysis',
            parameters: { percentChange: 5 },
        }),
    'supplier-ecosystem': () => buildSupplierEcosystem(),
};

function getAgentMeta(agentName: AgentName) {
    return AGENT_REGISTRY.find((agent) => agent.name === agentName);
}

function formatMoney(amount: number) {
    return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}

function createFailureSummary(
    headline: string,
    details: string,
    dashboardHref?: string,
): AgentDispatchSummary {
    return {
        headline,
        details,
        link: dashboardHref,
    };
}

async function createSuccessSummary(
    agentName: AgentName,
    result: AgentResult<unknown>,
    dashboardHref: string,
): Promise<AgentDispatchSummary> {
    switch (agentName) {
        case 'fraud-detection': {
            const alerts = (result.data as FraudAlert[] | undefined) ?? [];
            const urgentAlerts = alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length;
            const openAlerts = await getOpenFraudAlerts();
            const openAlertCount = openAlerts.length;
            const criticalAlertCount = openAlerts.filter((alert) => alert.severity === 'critical').length;

            if (alerts.length === 0 && openAlertCount > 0) {
                return {
                    headline: `No new fraud signals, but ${openAlertCount} open alerts remain`,
                    details: criticalAlertCount > 0
                        ? `${criticalAlertCount} critical fraud alerts are still unresolved from earlier runs. The backlog needs review even though this pass did not add new findings.`
                        : `The current pass did not add new findings, but ${openAlertCount} older fraud alerts are still open and need triage.`,
                    alertsFound: openAlertCount,
                    link: dashboardHref,
                };
            }

            return {
                headline: alerts.length > 0 ? `${alerts.length} new fraud signals surfaced` : 'No fraud signals detected',
                details: alerts.length > 0
                    ? `${urgentAlerts} new high-priority alerts require review across the monitored transaction window.${openAlertCount > alerts.length ? ` ${openAlertCount} total open alerts remain in the backlog.` : ''}`
                    : 'The current ledger and vendor activity stayed within expected risk thresholds.',
                alertsFound: openAlertCount > 0 ? openAlertCount : alerts.length,
                link: dashboardHref,
            };
        }
        case 'payment-optimizer': {
            const optimizations = (result.data as PaymentOptimization[] | undefined) ?? [];
            const savingsAmount = optimizations.reduce((sum, optimization) => sum + Number(optimization.potentialSavings || 0), 0);
            const paymentSummary = await getPaymentOptimizationSummary();

            if (optimizations.length === 0 && paymentSummary.opportunityCount > 0) {
                return {
                    headline: `No new payment wins, but ${paymentSummary.opportunityCount} pending opportunities remain`,
                    details: `There are still ${paymentSummary.opportunityCount} saved optimization records worth ${formatMoney(paymentSummary.totalPotentialSavings)} awaiting action.`,
                    savingsAmount: paymentSummary.totalPotentialSavings,
                    itemsScanned: paymentSummary.opportunityCount,
                    link: dashboardHref,
                };
            }

            return {
                headline: savingsAmount > 0
                    ? `${formatMoney(savingsAmount)} available in payment timing`
                    : 'No payment timing gains available right now',
                details: optimizations.length > 0
                    ? `Captured ${optimizations.length} active opportunities across pending invoices and contract terms.${paymentSummary.opportunityCount > optimizations.length ? ` ${paymentSummary.opportunityCount} total pending opportunities are still open.` : ''}`
                    : 'Pending invoices are already aligned with the best current payment windows.',
                savingsAmount: paymentSummary.totalPotentialSavings > 0 ? paymentSummary.totalPotentialSavings : savingsAmount,
                itemsScanned: paymentSummary.opportunityCount > 0 ? paymentSummary.opportunityCount : optimizations.length,
                link: dashboardHref,
            };
        }
        case 'demand-forecasting': {
            const forecasts = (result.data as DemandForecast[] | undefined) ?? [];
            const volatileSkus = forecasts.filter((forecast) => forecast.trend !== 'stable').length;
            return {
                headline: `${forecasts.length} SKUs forecasted`,
                details: forecasts.length > 0
                    ? `${volatileSkus} SKUs need closer attention because trend direction is shifting away from baseline demand.`
                    : 'No historical purchasing signal was strong enough to produce a fresh forecast batch.',
                itemsScanned: forecasts.length,
                link: dashboardHref,
            };
        }
        case 'auto-remediation': {
            const actions = Array.isArray(result.data) ? result.data.length : 0;
            return {
                headline: actions > 0 ? `${actions} workflow issues healed` : 'No remediation actions were needed',
                details: actions > 0
                    ? 'The remediation engine corrected stale states and closed the highest-friction loops automatically.'
                    : 'Open requisitions, approvals, and tasks are already inside healthy operating thresholds.',
                actionsCount: actions,
                link: dashboardHref,
            };
        }
        case 'predictive-bottleneck': {
            const bottlenecks = (result.data as WorkflowBottleneck[] | undefined) ?? [];
            const escalations = bottlenecks.filter((entry) => entry.escalationRequired).length;
            return {
                headline: bottlenecks.length > 0 ? `${bottlenecks.length} bottlenecks predicted` : 'Queue flow is stable',
                details: bottlenecks.length > 0
                    ? `${escalations} predicted queue blockages already meet escalation criteria and should be triaged first.`
                    : 'No approval or fulfillment queues are currently projecting a meaningful slowdown.',
                alertsFound: bottlenecks.length,
                link: dashboardHref,
            };
        }
        case 'smart-approval-routing': {
            const approvalData = (result.data as { processed?: number; approved?: number; skipped?: number } | undefined) ?? {};
            return {
                headline: `${approvalData.approved ?? 0} approvals auto-routed`,
                details: `Processed ${approvalData.processed ?? 0} queued requests and safely skipped ${approvalData.skipped ?? 0} that still need manual review.`,
                actionsCount: approvalData.approved ?? 0,
                itemsScanned: approvalData.processed ?? 0,
                link: dashboardHref,
            };
        }
        case 'scenario-modeling': {
            const scenario = (result.data as { outcomes?: unknown[]; overallImpact?: string } | undefined) ?? {};
            return {
                headline: 'Scenario simulation refreshed',
                details: `${scenario.outcomes?.length ?? 0} projected outcome lines were generated with an overall impact of ${scenario.overallImpact ?? 'neutral'}.`,
                itemsScanned: scenario.outcomes?.length ?? 0,
                link: dashboardHref,
            };
        }
        case 'supplier-ecosystem': {
            const ecosystem = (result.data as {
                nodes?: unknown[];
                riskHotspots?: unknown[];
                overallHealthScore?: number;
            } | undefined) ?? {};
            return {
                headline: `Ecosystem health ${ecosystem.overallHealthScore ?? 0}/100`,
                details: `Mapped ${ecosystem.nodes?.length ?? 0} suppliers and flagged ${ecosystem.riskHotspots?.length ?? 0} dependency hotspots for follow-up.`,
                alertsFound: ecosystem.riskHotspots?.length ?? 0,
                itemsScanned: ecosystem.nodes?.length ?? 0,
                link: dashboardHref,
            };
        }
        default:
            return {
                headline: 'Agent run completed',
                details: result.reasoning ?? 'The agent finished successfully and handed back a stable response.',
                link: dashboardHref,
            };
    }
}

async function safeTrackEvent(event: string, action: string, metadata: Record<string, unknown>) {
    try {
        await TelemetryService.trackEvent(event, action, metadata);
    } catch (error) {
        console.warn(`[AgentDispatcher] Failed to track ${event}:${action}`, error);
    }
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Centralized dispatcher for running agents from the UI
 */
export async function triggerAgentDispatch(agentName: AgentName): Promise<AgentDispatchResult> {
    const started = Date.now();
    const agentMeta = getAgentMeta(agentName);

    if (!agentMeta) {
        return {
            success: false,
            error: `Dispatcher not implemented for ${agentName}`,
            agentName: "system",
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0,
            attempts: 0,
            dashboardHref: '/admin/agents',
            summary: createFailureSummary(
                'Agent route unavailable',
                `The system could not locate a registered execution path for ${agentName}.`,
                '/admin/agents',
            ),
        };
    }

    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role ?? 'guest';

    if (!session?.user) {
        await safeTrackEvent('AgentDispatch', 'blocked_unauthenticated', { agentName });
        return {
            success: false,
            error: "You must be signed in to dispatch AI agents.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0,
            attempts: 0,
            dashboardHref: agentMeta.dashboardHref,
            summary: createFailureSummary(
                'Authentication required',
                'Sign in again before launching this agent.',
                agentMeta.dashboardHref,
            ),
        };
    }

    if (!agentMeta.isEnabled) {
        await safeTrackEvent('AgentDispatch', 'blocked_disabled', { agentName, role });
        return {
            success: false,
            error: "This agent is currently disabled.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0,
            attempts: 0,
            dashboardHref: agentMeta.dashboardHref,
            summary: createFailureSummary(
                'Agent disabled',
                `${agentMeta.displayName} is currently disabled and cannot be dispatched.`,
                agentMeta.dashboardHref,
            ),
        };
    }

    if (agentMeta.requiresApproval && role !== 'admin') {
        await safeTrackEvent('AgentDispatch', 'blocked_requires_approval', { agentName, role });
        return {
            success: false,
            error: "Admin approval is required before this agent can run. Please request an administrator to dispatch it.",
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0,
            attempts: 0,
            dashboardHref: agentMeta.dashboardHref,
            summary: createFailureSummary(
                'Admin approval required',
                `${agentMeta.displayName} is guarded. Open the workspace route if you need to review the target records first.`,
                agentMeta.dashboardHref,
            ),
        };
    }

    const executor = AGENT_EXECUTORS[agentName];

    if (agentMeta.dispatchMode === 'workspace' || !executor) {
        await safeTrackEvent('AgentDispatch', 'workspace_required', { agentName, role });
        return {
            success: false,
            error: `${agentMeta.displayName} requires a record-specific workspace before it can run.`,
            agentName,
            timestamp: new Date(),
            executionTimeMs: Date.now() - started,
            confidence: 0,
            attempts: 0,
            dashboardHref: agentMeta.dashboardHref,
            summary: createFailureSummary(
                'Workspace context required',
                `Open ${agentMeta.focusLabel.toLowerCase()} to launch ${agentMeta.displayName} against a specific record without breaking the route flow.`,
                agentMeta.dashboardHref,
            ),
        };
    }

    const maxAttempts = Math.max(1, (agentMeta.maxRetries ?? 0) + 1);
    let lastError = 'Internal execution error';

    const enforceTimeout = <T,>(promise: Promise<T>) =>
        Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Agent ${agentName} timed out after ${agentMeta.timeoutMs}ms`)), agentMeta.timeoutMs),
            ),
        ]);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await safeTrackEvent('AgentDispatch', 'attempt_started', {
            agentName,
            attempt,
            maxAttempts,
            role,
        });

        try {
            const result = await enforceTimeout(executor());

            if (result.success) {
                const summary = await createSuccessSummary(agentName, result, agentMeta.dashboardHref);
                await safeTrackEvent('AgentDispatch', 'completed', {
                    agentName,
                    attempt,
                    executionTimeMs: result.executionTimeMs,
                    confidence: result.confidence,
                });

                return {
                    ...result,
                    agentName: result.agentName ?? agentName,
                    timestamp: result.timestamp ?? new Date(),
                    executionTimeMs: result.executionTimeMs ?? Date.now() - started,
                    confidence: result.confidence ?? 0,
                    reasoning: result.reasoning ?? summary.details,
                    attempts: attempt,
                    dashboardHref: agentMeta.dashboardHref,
                    summary,
                };
            }

            lastError = result.error ?? 'The agent returned an unsuccessful response.';
        } catch (error) {
            lastError = error instanceof Error ? error.message : 'Internal execution error';
        }

        await safeTrackEvent('AgentDispatch', 'attempt_failed', {
            agentName,
            attempt,
            maxAttempts,
            error: lastError,
        });

        if (attempt < maxAttempts) {
            await delay(Math.min(2400, 250 * (2 ** attempt)));
        }
    }

    return {
        success: false,
        error: lastError,
        agentName,
        timestamp: new Date(),
        executionTimeMs: Date.now() - started,
        confidence: 0,
        attempts: maxAttempts,
        dashboardHref: agentMeta.dashboardHref,
        summary: createFailureSummary(
            'Recovery path prepared',
            `${agentMeta.displayName} exhausted ${maxAttempts} guarded attempts. Review ${agentMeta.focusLabel.toLowerCase()} from the linked workspace and retry from there.`,
            agentMeta.dashboardHref,
        ),
    };
}

export async function triggerAgentBundle(bundleName: AgentBundleName): Promise<AgentBundleDispatchResult> {
    const bundleMeta = AGENT_BUNDLE_META[bundleName];
    const agents = AGENT_BUNDLES[bundleName];
    const results: AgentBundleDispatchResult['results'] = [];

    for (const agent of agents) {
        const started = Date.now();
        const result = await triggerAgentDispatch(agent);
        results.push({
            agent,
            success: result.success,
            error: result.success ? undefined : result.error,
            executionTimeMs: result.executionTimeMs || Date.now() - started,
            attempts: result.attempts,
            dashboardHref: result.dashboardHref,
            summary: result.summary,
        });
    }

    return {
        success: results.every((entry) => entry.success),
        bundle: bundleName,
        displayName: bundleMeta.displayName,
        description: bundleMeta.description,
        dashboardHref: bundleMeta.dashboardHref,
        total: results.length,
        succeeded: results.filter((entry) => entry.success).length,
        failed: results.filter((entry) => !entry.success).length,
        results,
    };
}

export async function getAgentDashboardSnapshot(): Promise<AgentDashboardSnapshot> {
    const panelResults = await Promise.allSettled([
        getOpenFraudAlerts(),
        getPaymentOptimizationSummary(),
        getReplenishmentAlerts(),
    ]);

    const degradedPanels: string[] = [];
    const systemWarnings: string[] = [];

    let fraudAlerts = 0;
    let criticalFraudAlerts = 0;
    let paymentSavings = 0;
    let pendingPaymentOpportunities = 0;
    let replenishmentAlerts = 0;

    const [fraudResult, paymentResult, replenishmentResult] = panelResults;

    if (fraudResult.status === 'fulfilled') {
        fraudAlerts = Array.isArray(fraudResult.value) ? fraudResult.value.length : 0;
        criticalFraudAlerts = Array.isArray(fraudResult.value)
            ? fraudResult.value.filter((alert) => alert.severity === 'critical').length
            : 0;
    } else {
        degradedPanels.push('fraud-alerts');
        systemWarnings.push('Fraud monitoring snapshot could not be refreshed. The route stays available, but data may be stale.');
    }

    if (paymentResult.status === 'fulfilled') {
        paymentSavings = Number(paymentResult.value?.totalPotentialSavings || 0);
        pendingPaymentOpportunities = Number(paymentResult.value?.opportunityCount || 0);
    } else {
        degradedPanels.push('payment-optimizer');
        systemWarnings.push('Payment optimization summary is temporarily degraded. Retry sync before trusting savings totals.');
    }

    if (replenishmentResult.status === 'fulfilled') {
        replenishmentAlerts = Array.isArray(replenishmentResult.value)
            ? replenishmentResult.value.filter((alert) => alert.urgency === 'high' || alert.urgency === 'critical').length
            : 0;
    } else {
        degradedPanels.push('inventory-forecast');
        systemWarnings.push('Inventory forecast alerts did not refresh. Use the parts workspace if you need live stock detail.');
    }

    return {
        generatedAt: new Date().toISOString(),
        fraudAlerts,
        criticalFraudAlerts,
        paymentSavings,
        pendingPaymentOpportunities,
        replenishmentAlerts,
        degradedPanels,
        systemWarnings,
    };
}
