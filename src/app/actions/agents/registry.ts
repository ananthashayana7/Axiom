/**
 * Shared agent registry metadata
 * Split from server actions to keep client imports lightweight.
 */
import type { AgentCategory, AgentTrigger } from "@/lib/ai/agent-types";

export type AgentDispatchMode = 'global' | 'workspace';

type AgentDefinition = {
    name: string;
    displayName: string;
    description: string;
    category: AgentCategory;
    triggers: AgentTrigger[];
    isEnabled: boolean;
    requiresApproval: boolean;
    maxRetries: number;
    timeoutMs: number;
    version: string;
    dashboardHref: string;
    dispatchMode: AgentDispatchMode;
    focusLabel: string;
};

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
        version: '1.0.0',
        dashboardHref: '/sourcing/parts',
        dispatchMode: 'global',
        focusLabel: 'Inventory forecast'
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
        version: '1.0.0',
        dashboardHref: '/admin/fraud-alerts',
        dispatchMode: 'global',
        focusLabel: 'Risk investigations'
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
        version: '1.0.0',
        dashboardHref: '/sourcing/invoices?mode=match',
        dispatchMode: 'global',
        focusLabel: 'Working capital'
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
        version: '1.0.0',
        dashboardHref: '/sourcing/rfqs',
        dispatchMode: 'workspace',
        focusLabel: 'RFQ playbooks'
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
        version: '1.0.0',
        dashboardHref: '/sourcing/contracts',
        dispatchMode: 'workspace',
        focusLabel: 'Contract review'
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
        version: '1.0.0',
        dashboardHref: '/sourcing/requisitions',
        dispatchMode: 'global',
        focusLabel: 'Approval routing'
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
        version: '1.0.0',
        dashboardHref: '/admin/tasks',
        dispatchMode: 'global',
        focusLabel: 'Workflow recovery'
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
        version: '1.0.0',
        dashboardHref: '/admin/tasks',
        dispatchMode: 'global',
        focusLabel: 'System healing'
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
        version: '1.0.0',
        dashboardHref: '/admin/scenarios',
        dispatchMode: 'global',
        focusLabel: 'Scenario simulations'
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
        version: '1.0.0',
        dashboardHref: '/admin/ecosystem',
        dispatchMode: 'global',
        focusLabel: 'Dependency graph'
    }
] as const satisfies readonly AgentDefinition[];

export type AgentName = typeof AGENT_REGISTRY[number]['name'];

export type AgentBundleName = 'post-import' | 'compliance-sweep' | 'workflow-recovery';

export const AGENT_BUNDLES: Record<AgentBundleName, AgentName[]> = {
    'post-import': ['demand-forecasting', 'fraud-detection', 'payment-optimizer'],
    'compliance-sweep': ['fraud-detection', 'payment-optimizer', 'smart-approval-routing'],
    'workflow-recovery': ['predictive-bottleneck', 'smart-approval-routing', 'auto-remediation'],
};

export const AGENT_BUNDLE_META: Record<AgentBundleName, {
    displayName: string;
    description: string;
    dashboardHref: string;
    accentClass: string;
}> = {
    'post-import': {
        displayName: 'Post-Import Stabilizer',
        description: 'Refresh demand, scan incoming spend, and surface payment opportunities after new data lands.',
        dashboardHref: '/admin/import',
        accentClass: 'from-emerald-500/20 via-cyan-500/10 to-transparent',
    },
    'compliance-sweep': {
        displayName: 'Compliance Sweep',
        description: 'Run a controlled pass across risk, contracts, and invoice controls before approving the next move.',
        dashboardHref: '/admin/compliance',
        accentClass: 'from-amber-500/20 via-rose-500/10 to-transparent',
    },
    'workflow-recovery': {
        displayName: 'Workflow Recovery',
        description: 'Detect blockers, reroute approvals, and apply automated healing before queues start to slip.',
        dashboardHref: '/admin/tasks',
        accentClass: 'from-sky-500/20 via-indigo-500/10 to-transparent',
    },
};

export const QUICK_ACTION_AGENTS: AgentName[] = [
    'fraud-detection',
    'payment-optimizer',
    'demand-forecasting',
    'auto-remediation',
];
