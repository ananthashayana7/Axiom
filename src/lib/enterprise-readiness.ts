type ScoreLabel = 'critical' | 'watch' | 'good' | 'strong';

export type SupplierReadinessInput = {
    contactEmail?: string | null;
    city?: string | null;
    countryCode?: string | null;
    categories?: string[] | null;
    isoCertifications?: string[] | null;
    modernSlaveryStatement?: string | null;
    financialScore?: number | null;
    financialHealthRating?: string | null;
    performanceScore?: number | null;
    responsivenessScore?: number | null;
    collaborationScore?: number | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    lastAuditDate?: Date | null;
    lastRiskAudit?: Date | null;
    documentCount?: number;
    lifecycleStatus?: string | null;
    compliance: {
        total: number;
        withEvidence: number;
        overdue: number;
    };
    requests: {
        total: number;
        open: number;
        overdue: number;
        verified: number;
    };
    tasks: {
        open: number;
        escalated: number;
    };
    actionPlans: {
        active: number;
    };
};

export type SupplierReadinessSummary = {
    score: number;
    label: ScoreLabel;
    blockers: string[];
    strengths: string[];
    coverage: {
        profile: number;
        compliance: number;
        operations: number;
    };
    canApprove: boolean;
    approvalThreshold: number;
};

export type DataConfidenceSummary = {
    score: number;
    label: ScoreLabel;
    gaps: string[];
    highlights: string[];
    coverage: {
        completeness: number;
        evidence: number;
        freshness: number;
    };
};

export type IntegrationHealthInput = {
    totalWebhooks: number;
    activeWebhooks: number;
    staleWebhooks: number;
    deliveries: {
        pending: number;
        success: number;
        failed: number;
        retrying: number;
    };
    activeSourceSystems: number;
    recentImports: number;
    settings: {
        hasPrimaryAiKey: boolean;
        fallbackKeyCount: number;
        hasExchangeRates: boolean;
    };
};

export type IntegrationHealthSummary = {
    score: number;
    label: ScoreLabel;
    gaps: string[];
    strengths: string[];
    metrics: {
        deliverySuccessRate: number;
        backlogHealth: number;
        settingsCoverage: number;
        connectivityCoverage: number;
    };
};

export type GovernanceCoverageInput = {
    activePolicyCount: number;
    coveredEntityTypes: string[];
    activeToleranceCount: number;
    supplierSpecificToleranceCount: number;
    escalatedTasks: number;
    overdueTasks: number;
};

export type GovernanceCoverageSummary = {
    score: number;
    label: ScoreLabel;
    gaps: string[];
    strengths: string[];
    metrics: {
        entityCoverage: number;
        policyDepth: number;
        toleranceCoverage: number;
        controlHealth: number;
    };
};

export type ReliabilitySummaryInput = {
    importSuccessRate: number | null;
    recentImportJobs: number;
    webhookSuccessRate: number | null;
    recentDeliveries: number;
    overdueTasks: number;
    escalatedTasks: number;
};

export type ReliabilitySummary = {
    score: number;
    label: ScoreLabel;
    gaps: string[];
    strengths: string[];
    metrics: {
        importSuccessRate: number;
        webhookSuccessRate: number;
        controlHealth: number;
    };
};

export type SupplierEnterpriseSnapshot = {
    readiness: SupplierReadinessSummary;
    confidence: DataConfidenceSummary;
    metrics: {
        documentCount: number;
        complianceTotal: number;
        complianceWithEvidence: number;
        openRequests: number;
        overdueRequests: number;
        openTasks: number;
        escalatedTasks: number;
        activeActionPlans: number;
    };
};

export type EnterpriseDashboardSnapshot = {
    overallScore: number;
    overallLabel: ScoreLabel;
    supplierNetwork: {
        totalSuppliers: number;
        activeSuppliers: number;
        onboardingSuppliers: number;
        readyForApproval: number;
        averageReadiness: number;
        averageConfidence: number;
        attentionSuppliers: Array<{
            supplierId: string;
            supplierName: string;
            readinessScore: number;
            confidenceScore: number;
            blockers: string[];
        }>;
    };
    compliance: {
        totalObligations: number;
        evidenceCoverage: number;
        expiredOrOverdue: number;
        overdueRequests: number;
    };
    integrations: IntegrationHealthSummary & {
        totalWebhooks: number;
        activeWebhooks: number;
        recentDeliveries: number;
        activeSourceSystems: number;
    };
    governance: GovernanceCoverageSummary & {
        activePolicies: number;
        activeTolerances: number;
    };
    reliability: ReliabilitySummary & {
        recentImportJobs: number;
        recentDeliveries: number;
    };
    priorityActions: string[];
};

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function clampPercentage(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function toPercentage(numerator: number, denominator: number, emptyValue = 0): number {
    if (denominator <= 0) return emptyValue;
    return clampPercentage((numerator / denominator) * 100);
}

function labelForScore(score: number): ScoreLabel {
    if (score >= 85) return 'strong';
    if (score >= 70) return 'good';
    if (score >= 50) return 'watch';
    return 'critical';
}

function isRecent(date: Date | null | undefined, maxAgeDays: number): boolean {
    if (!date) return false;
    const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return false;
    const ageMs = Date.now() - timestamp;
    return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

export function buildSupplierReadiness(input: SupplierReadinessInput): SupplierReadinessSummary {
    const blockers: string[] = [];
    const strengths: string[] = [];

    const hasContact = Boolean(input.contactEmail?.trim());
    const categoryCount = input.categories?.filter(Boolean).length ?? 0;
    const hasLocation = Boolean(input.city?.trim() && input.countryCode?.trim());
    const hasCoordinates = Boolean(
        input.latitude !== null &&
        input.latitude !== undefined &&
        input.longitude !== null &&
        input.longitude !== undefined &&
        Number.isFinite(toNumber(input.latitude)) &&
        Number.isFinite(toNumber(input.longitude))
    );
    const hasComplianceMarkers = (input.isoCertifications?.length ?? 0) > 0 || input.modernSlaveryStatement === 'yes';
    const hasFinancialBaseline = toNumber(input.financialScore) > 0 || Boolean(input.financialHealthRating?.trim());
    const hasPerformanceBaseline = toNumber(input.performanceScore) > 0 || toNumber(input.responsivenessScore) > 0 || toNumber(input.collaborationScore) > 0;
    const documentCount = input.documentCount ?? 0;
    const complianceCoverage = input.compliance.total > 0
        ? toPercentage(input.compliance.withEvidence, input.compliance.total)
        : clampPercentage(documentCount > 0 ? 60 : 0);
    const requestCompletion = input.requests.total > 0
        ? toPercentage(input.requests.verified, input.requests.total)
        : clampPercentage(documentCount > 0 ? 50 : 0);
    const taskHygiene = clampPercentage(100 - (input.tasks.escalated * 25) - (input.requests.overdue * 18) - (input.compliance.overdue * 18));

    let score = 0;
    score += hasContact ? 6 : 0;
    score += categoryCount > 0 ? 8 : 0;
    score += hasLocation ? 10 : 0;
    score += hasCoordinates ? 4 : 0;
    score += hasComplianceMarkers ? 10 : 0;
    score += hasFinancialBaseline ? 8 : 0;
    score += hasPerformanceBaseline ? 8 : 0;
    score += documentCount > 0 ? 8 : 0;
    score += Math.round(complianceCoverage * 0.16);
    score += Math.round(requestCompletion * 0.12);
    score += Math.round(taskHygiene * 0.1);
    score = clampPercentage(score);

    if (!hasContact) blockers.push('Primary supplier contact is missing.');
    if (categoryCount === 0) blockers.push('Supply categories have not been classified.');
    if (!hasLocation) blockers.push('Location coverage is incomplete.');
    if (!hasComplianceMarkers) blockers.push('No certification or human-rights attestation is recorded.');
    if (!hasFinancialBaseline) blockers.push('Financial baseline has not been established.');
    if (!hasPerformanceBaseline) blockers.push('Performance baseline has not been established.');
    if (documentCount === 0) blockers.push('No supplier documents have been uploaded.');
    if (input.compliance.total > 0 && input.compliance.withEvidence === 0) blockers.push('Compliance obligations exist without evidence.');
    if (input.requests.overdue > 0) blockers.push(`${input.requests.overdue} supplier request${input.requests.overdue === 1 ? ' is' : 's are'} overdue.`);
    if (input.compliance.overdue > 0) blockers.push(`${input.compliance.overdue} compliance obligation${input.compliance.overdue === 1 ? ' is' : 's are'} overdue.`);
    if (input.tasks.escalated > 0) blockers.push(`${input.tasks.escalated} workflow task${input.tasks.escalated === 1 ? ' is' : 's are'} escalated.`);

    if (categoryCount >= 3) strengths.push('Category coverage is broad enough for network segmentation.');
    if (hasCoordinates) strengths.push('Geographic coordinates are available for control-tower views.');
    if ((input.isoCertifications?.length ?? 0) > 0) strengths.push('Certification coverage is on file.');
    if (documentCount >= 3) strengths.push('Core onboarding documents are already attached.');
    if (complianceCoverage >= 80) strengths.push('Compliance evidence coverage is healthy.');
    if (requestCompletion >= 75) strengths.push('Supplier request completion is on track.');
    if (taskHygiene >= 80) strengths.push('Workflow hygiene is clean with low escalation pressure.');

    const profileCoverage = toPercentage(
        Number(hasContact) +
        Number(categoryCount > 0) +
        Number(Boolean(input.city?.trim())) +
        Number(Boolean(input.countryCode?.trim())) +
        Number(hasCoordinates) +
        Number(hasComplianceMarkers),
        6,
    );
    const operationsCoverage = toPercentage(
        Number(hasFinancialBaseline) +
        Number(hasPerformanceBaseline) +
        Number(documentCount > 0) +
        Number(input.tasks.escalated === 0) +
        Number(input.actionPlans.active > 0 || input.requests.open === 0),
        5,
    );
    const canApprove = score >= 75 &&
        blockers.length === 0 &&
        input.requests.overdue === 0 &&
        input.compliance.overdue === 0 &&
        input.tasks.escalated === 0;

    return {
        score,
        label: labelForScore(score),
        blockers,
        strengths,
        coverage: {
            profile: profileCoverage,
            compliance: complianceCoverage,
            operations: operationsCoverage,
        },
        canApprove,
        approvalThreshold: 75,
    };
}

export function buildDataConfidence(input: SupplierReadinessInput): DataConfidenceSummary {
    const hasContact = Boolean(input.contactEmail?.trim());
    const hasCategories = (input.categories?.length ?? 0) > 0;
    const hasLocation = Boolean(input.city?.trim() && input.countryCode?.trim());
    const hasPerformanceBaseline = toNumber(input.performanceScore) > 0 || toNumber(input.responsivenessScore) > 0 || toNumber(input.collaborationScore) > 0;
    const hasFinancialBaseline = toNumber(input.financialScore) > 0 || Boolean(input.financialHealthRating?.trim());
    const hasDocuments = (input.documentCount ?? 0) > 0;
    const hasComplianceMarkers = (input.isoCertifications?.length ?? 0) > 0 || input.modernSlaveryStatement === 'yes';
    const completeness = toPercentage(
        Number(hasContact) +
        Number(hasCategories) +
        Number(hasLocation) +
        Number(hasDocuments) +
        Number(hasComplianceMarkers) +
        Number(hasPerformanceBaseline) +
        Number(hasFinancialBaseline),
        7,
    );
    const evidence = input.compliance.total > 0
        ? toPercentage(input.compliance.withEvidence, input.compliance.total)
        : clampPercentage(hasDocuments ? 60 : 0);
    const recentSignals = Number(isRecent(input.lastAuditDate, 180)) + Number(isRecent(input.lastRiskAudit, 180));
    const freshness = recentSignals === 2 ? 100 : recentSignals === 1 ? 70 : hasPerformanceBaseline ? 45 : 20;
    const score = clampPercentage((completeness * 0.45) + (evidence * 0.35) + (freshness * 0.2));

    const gaps: string[] = [];
    const highlights: string[] = [];

    if (!hasLocation) gaps.push('Regional data is incomplete, which weakens geographic reporting.');
    if (!hasDocuments) gaps.push('No supporting documents are attached to validate supplier claims.');
    if (input.compliance.total > 0 && evidence < 60) gaps.push('Compliance evidence coverage is too thin for high-confidence scoring.');
    if (!isRecent(input.lastAuditDate, 180)) gaps.push('Audit records are stale or missing.');
    if (!isRecent(input.lastRiskAudit, 180)) gaps.push('Risk audit data is stale or missing.');

    if (completeness >= 80) highlights.push('Master-data completeness is strong.');
    if (evidence >= 80) highlights.push('Evidence-backed scoring is in place.');
    if (freshness >= 70) highlights.push('Audit and risk signals are current.');

    return {
        score,
        label: labelForScore(score),
        gaps,
        highlights,
        coverage: {
            completeness,
            evidence,
            freshness,
        },
    };
}

export function buildIntegrationHealth(input: IntegrationHealthInput): IntegrationHealthSummary {
    const processedDeliveries = input.deliveries.success + input.deliveries.failed + input.deliveries.retrying;
    const deliverySuccessRate = processedDeliveries > 0
        ? toPercentage(input.deliveries.success, processedDeliveries)
        : clampPercentage(input.activeWebhooks > 0 ? 65 : 0);
    const backlogHealth = clampPercentage(100 - (input.deliveries.pending * 12) - (input.deliveries.retrying * 15));
    const settingsCoverage = toPercentage(
        Number(input.settings.hasPrimaryAiKey) +
        Number(input.settings.fallbackKeyCount > 0) +
        Number(input.settings.hasExchangeRates),
        3,
    );
    const connectivityCoverage = toPercentage(
        Number(input.activeWebhooks > 0) +
        Number(input.recentImports > 0) +
        Number(input.activeSourceSystems > 0),
        3,
    );
    const stalePenalty = input.totalWebhooks > 0
        ? clampPercentage(100 - toPercentage(input.staleWebhooks, input.totalWebhooks))
        : 0;
    const score = clampPercentage(
        (deliverySuccessRate * 0.35) +
        (backlogHealth * 0.15) +
        (settingsCoverage * 0.2) +
        (connectivityCoverage * 0.2) +
        (stalePenalty * 0.1)
    );

    const gaps: string[] = [];
    const strengths: string[] = [];

    if (input.activeWebhooks === 0) gaps.push('No active outbound integration endpoint is configured.');
    if (input.activeSourceSystems === 0) gaps.push('No tracked source system is feeding import history.');
    if (!input.settings.hasExchangeRates) gaps.push('Exchange-rate coverage is missing from platform settings.');
    if (deliverySuccessRate < 80 && processedDeliveries > 0) gaps.push('Webhook delivery success rate is below the enterprise target.');
    if (input.staleWebhooks > 0) gaps.push(`${input.staleWebhooks} webhook endpoint${input.staleWebhooks === 1 ? ' is' : 's are'} stale.`);
    if (input.deliveries.pending + input.deliveries.retrying > 5) gaps.push('Webhook backlog is starting to accumulate.');

    if (deliverySuccessRate >= 90) strengths.push('Integration delivery success rate is healthy.');
    if (settingsCoverage >= 67) strengths.push('Platform settings cover the key integration dependencies.');
    if (connectivityCoverage >= 67) strengths.push('Connectors are active across multiple enterprise paths.');

    return {
        score,
        label: labelForScore(score),
        gaps,
        strengths,
        metrics: {
            deliverySuccessRate,
            backlogHealth,
            settingsCoverage,
            connectivityCoverage,
        },
    };
}

export function buildGovernanceCoverage(input: GovernanceCoverageInput): GovernanceCoverageSummary {
    const coreEntities = ['requisition', 'order', 'invoice', 'contract'];
    const coveredEntityTypes = new Set(input.coveredEntityTypes.filter(Boolean));
    const entityCoverage = toPercentage(
        coreEntities.filter((entity) => coveredEntityTypes.has(entity)).length,
        coreEntities.length,
    );
    const policyDepth = clampPercentage(Math.min(100, input.activePolicyCount * 20));
    const toleranceCoverage = input.activeToleranceCount === 0
        ? 0
        : clampPercentage(Math.min(100, 45 + (input.activeToleranceCount * 10) + (input.supplierSpecificToleranceCount * 5)));
    const controlHealth = clampPercentage(100 - (input.escalatedTasks * 18) - (input.overdueTasks * 8));
    const score = clampPercentage(
        (entityCoverage * 0.45) +
        (policyDepth * 0.2) +
        (toleranceCoverage * 0.2) +
        (controlHealth * 0.15)
    );

    const missingEntities = coreEntities.filter((entity) => !coveredEntityTypes.has(entity));
    const gaps: string[] = [];
    const strengths: string[] = [];

    if (missingEntities.length > 0) gaps.push(`Approval policies are missing for ${missingEntities.join(', ')}.`);
    if (input.activeToleranceCount === 0) gaps.push('Three-way matching tolerances are not configured.');
    if (input.supplierSpecificToleranceCount === 0) gaps.push('No supplier-specific tolerance rules are in place.');
    if (input.escalatedTasks > 0) gaps.push(`${input.escalatedTasks} escalated workflow task${input.escalatedTasks === 1 ? ' remains' : 's remain'} unresolved.`);
    if (input.overdueTasks > 0) gaps.push(`${input.overdueTasks} workflow task${input.overdueTasks === 1 ? ' is' : 's are'} overdue.`);

    if (entityCoverage >= 75) strengths.push('Approval policy coverage spans most core transaction types.');
    if (toleranceCoverage >= 70) strengths.push('Matching tolerances are configured beyond the global baseline.');
    if (controlHealth >= 80) strengths.push('Workflow controls are operating with limited escalation pressure.');

    return {
        score,
        label: labelForScore(score),
        gaps,
        strengths,
        metrics: {
            entityCoverage,
            policyDepth,
            toleranceCoverage,
            controlHealth,
        },
    };
}

export function buildReliabilitySummary(input: ReliabilitySummaryInput): ReliabilitySummary {
    const importSuccessRate = input.importSuccessRate === null ? (input.recentImportJobs > 0 ? 60 : 50) : clampPercentage(input.importSuccessRate);
    const webhookSuccessRate = input.webhookSuccessRate === null ? (input.recentDeliveries > 0 ? 60 : 50) : clampPercentage(input.webhookSuccessRate);
    const controlHealth = clampPercentage(100 - (input.overdueTasks * 8) - (input.escalatedTasks * 18));
    const score = clampPercentage(
        (importSuccessRate * 0.4) +
        (webhookSuccessRate * 0.35) +
        (controlHealth * 0.25)
    );

    const gaps: string[] = [];
    const strengths: string[] = [];

    if (input.recentImportJobs === 0) gaps.push('No recent import jobs are available to prove ingestion reliability.');
    if (importSuccessRate < 90 && input.recentImportJobs > 0) gaps.push('Import success rate is below the enterprise benchmark.');
    if (input.recentDeliveries === 0) gaps.push('No recent webhook deliveries are available to prove integration reliability.');
    if (webhookSuccessRate < 90 && input.recentDeliveries > 0) gaps.push('Webhook success rate is below the enterprise benchmark.');
    if (input.overdueTasks > 0 || input.escalatedTasks > 0) gaps.push('Operational tasks are still aging past their intended service level.');

    if (importSuccessRate >= 95) strengths.push('Import validation is operating at a high success rate.');
    if (webhookSuccessRate >= 95) strengths.push('Integration delivery reliability is strong.');
    if (controlHealth >= 85) strengths.push('Task pressure is under control.');

    return {
        score,
        label: labelForScore(score),
        gaps,
        strengths,
        metrics: {
            importSuccessRate,
            webhookSuccessRate,
            controlHealth,
        },
    };
}

export function averageScore(values: number[]): number {
    if (values.length === 0) return 0;
    const total = values.reduce((sum, value) => sum + value, 0);
    return clampPercentage(total / values.length);
}

export function scoreLabel(score: number): ScoreLabel {
    return labelForScore(score);
}
