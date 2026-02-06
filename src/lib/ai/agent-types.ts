/**
 * AI Agent Type Definitions
 * Core type system for the Axiom AI Agent infrastructure
 */

// Agent execution result with full provenance
export interface AgentResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    confidence: number;  // 0-100
    reasoning?: string;  // Chain-of-thought explanation
    sources?: string[];  // Data provenance
    executionTimeMs: number;
    tokenUsage?: number;
    agentName: string;
    timestamp: Date;
}

// Agent metadata for registry
export interface AgentMetadata {
    name: string;
    displayName: string;
    description: string;
    category: AgentCategory;
    triggers: AgentTrigger[];
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    version: string;
    isEnabled: boolean;
    requiresApproval: boolean;  // For actions that modify data
    maxRetries: number;
    timeoutMs: number;
}

export type AgentCategory =
    | 'procurement'
    | 'analytics'
    | 'risk'
    | 'compliance'
    | 'supplier'
    | 'financial'
    | 'workflow';

export type AgentTrigger =
    | 'manual'           // User-initiated
    | 'scheduled'        // Cron-based
    | 'event'            // Database event
    | 'copilot'          // Natural language
    | 'threshold';       // Metric threshold

// Agent execution context
export interface AgentContext {
    userId?: string;
    sessionId?: string;
    triggeredBy: AgentTrigger;
    parentExecutionId?: string;  // For chained agents
    metadata?: Record<string, unknown>;
}

// Agent execution log entry
export interface AgentExecutionLog {
    id: string;
    agentName: string;
    status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
    inputContext: string;  // JSON
    outputData?: string;   // JSON
    confidenceScore?: number;
    tokenUsage?: number;
    executionTimeMs?: number;
    errorMessage?: string;
    triggeredBy: string;
    userId?: string;
    createdAt: Date;
    completedAt?: Date;
}

// Agent recommendation for user review
export interface AgentRecommendation {
    id: string;
    agentName: string;
    recommendationType: RecommendationType;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    estimatedSavings?: number;
    actionPayload?: string;  // JSON for one-click actions
    status: 'pending' | 'approved' | 'dismissed' | 'expired';
    reviewedBy?: string;
    reviewedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
}

export type RecommendationType =
    | 'cost_savings'
    | 'risk_alert'
    | 'process_improvement'
    | 'compliance_issue'
    | 'supplier_action'
    | 'replenishment'
    | 'negotiation'
    | 'fraud_alert';

// Demand forecast output
export interface DemandForecast {
    partId: string;
    partName: string;
    sku: string;
    forecastDate: Date;
    predictedQuantity: number;
    confidenceLower: number;
    confidenceUpper: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    seasonalityFactor?: number;
    factors: string[];
}

// Fraud detection output
export interface FraudAlert {
    entityType: 'invoice' | 'order' | 'supplier' | 'user';
    entityId: string;
    alertType: FraudAlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    indicators: string[];
    suggestedAction: string;
    falsePositiveProbability: number;
}

export type FraudAlertType =
    | 'duplicate_invoice'
    | 'unusual_amount'
    | 'new_vendor_high_value'
    | 'unusual_timing'
    | 'segregation_violation'
    | 'round_number_pattern'
    | 'suspicious_vendor_change';

// Payment optimization output
export interface PaymentOptimization {
    orderId: string;
    invoiceId?: string;
    supplierName: string;
    invoiceAmount: number;
    discountTerms?: string;
    currentDueDate: Date;
    suggestedPaymentDate: Date;
    potentialSavings: number;
    savingsType: 'early_payment_discount' | 'cash_flow_optimization' | 'penalty_avoidance';
    reason: string;
    annualizedReturn?: number;
}

// Negotiation strategy output
export interface NegotiationStrategy {
    rfqId?: string;
    supplierId: string;
    supplierName: string;
    currentOffer: number;
    targetPrice: number;
    walkAwayPrice: number;
    leverage: string[];
    weaknesses: string[];
    suggestedCounterOffer: number;
    counterOfferJustification: string;
    negotiationTactics: string[];
    alternativeSuppliers: { id: string; name: string; estimatedPrice: number }[];
}

// Contract clause analysis output
export interface ContractClauseAnalysis {
    contractId?: string;
    fileName: string;
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskyClasses: ClauseRisk[];
    missingClauses: string[];
    complianceIssues: string[];
    recommendations: string[];
}

export interface ClauseRisk {
    clauseType: string;
    originalText: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskReason: string;
    suggestedAlternative?: string;
    standardClause?: string;
}

// Price intelligence output
export interface PriceIntelligence {
    partId?: string;
    partCategory: string;
    commodity?: string;
    currentQuotePrice: number;
    marketBenchmarkLow: number;
    marketBenchmarkHigh: number;
    fairPriceEstimate: number;
    pricePosition: 'below_market' | 'at_market' | 'above_market' | 'significantly_above';
    priceTrend: 'rising' | 'stable' | 'falling';
    confidence: number;
    dataSources: string[];
    recommendation: string;
}

// Supplier discovery output
export interface SupplierProspect {
    name: string;
    website?: string;
    location?: string;
    categories: string[];
    estimatedCapability: 'high' | 'medium' | 'low';
    esgPreScore?: number;
    certifications?: string[];
    qualificationNotes: string;
    contactInfo?: {
        email?: string;
        phone?: string;
    };
    source: string;
}

// Workflow bottleneck output
export interface WorkflowBottleneck {
    entityType: 'requisition' | 'rfq' | 'order' | 'invoice' | 'contract';
    entityId: string;
    entityTitle: string;
    currentStatus: string;
    stuckSinceDays: number;
    bottleneckType: 'approval_pending' | 'missing_info' | 'external_dependency' | 'system_issue';
    assignedTo?: string;
    suggestedAction: string;
    escalationRequired: boolean;
    estimatedResolutionDays: number;
}

// Scenario modeling output
export interface ScenarioResult {
    scenarioName: string;
    description: string;
    baselineMetrics: Record<string, number>;
    projectedMetrics: Record<string, number>;
    impact: {
        costImpact: number;
        riskImpact: 'decreased' | 'unchanged' | 'increased';
        operationalImpact: string;
    };
    assumptions: string[];
    recommendations: string[];
    confidence: number;
}

// Carbon footprint output
export interface CarbonFootprint {
    entityType: 'order' | 'supplier' | 'part';
    entityId: string;
    totalEmissionsKg: number;
    breakdown: {
        manufacturing: number;
        transportation: number;
        packaging: number;
        other: number;
    };
    scope: 'scope_1' | 'scope_2' | 'scope_3';
    methodology: string;
    offsetSuggestions?: string[];
    confidence: number;
}

// Agent execution options
export interface AgentExecutionOptions {
    skipCache?: boolean;
    forceRefresh?: boolean;
    maxRetries?: number;
    timeoutMs?: number;
    priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Agent chain definition
export interface AgentChain {
    name: string;
    description: string;
    steps: AgentChainStep[];
}

export interface AgentChainStep {
    agentName: string;
    inputMapping?: Record<string, string>;  // Map output from previous step
    condition?: string;  // JS expression to evaluate
    onSuccess?: string;  // Next agent name
    onFailure?: 'abort' | 'continue' | string;  // Agent name or action
}
