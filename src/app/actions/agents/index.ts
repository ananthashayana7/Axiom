/**
 * Agent Index - Central export for all AI agents
 */

// P0 Agents
export {
    runDemandForecastingAgent,
    getReplenishmentAlerts
} from './demand-forecasting';

export {
    runFraudDetectionAgent,
    getOpenFraudAlerts,
    resolveFraudAlert
} from './fraud-detection';

export {
    runPaymentOptimizationAgent,
    getPaymentOptimizationSummary,
    executePaymentOptimization,
    dismissPaymentOptimization
} from './payment-optimizer';

// P1 Agents
export {
    generateNegotiationStrategy,
    generateCounterOfferEmail
} from './negotiations-autopilot';

export {
    analyzeContractClauses,
    compareContracts
} from './contract-clause-analyzer';

// Phase 3: Intelligent Workflows
export {
    calculateApprovalRoute,
    processAutoApprovals,
    getApprovalRoutingAnalytics
} from './smart-approval-routing';

export {
    detectBottlenecks,
    getBottleneckAnalytics
} from './predictive-bottleneck';

export {
    runAutoRemediation,
    getRemediationRules,
    getRemediationHistory
} from './auto-remediation';

// Phase 4: Advanced Analytics
export {
    runScenarioAnalysis,
    compareScenarios,
    getScenarioTemplates
} from './scenario-modeling';

export {
    buildSupplierEcosystem,
    analyzeSupplierDependency
} from './supplier-ecosystem';

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
