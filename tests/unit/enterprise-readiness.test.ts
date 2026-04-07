import test from 'node:test';
import assert from 'node:assert/strict';

import {
    averageScore,
    buildDataConfidence,
    buildGovernanceCoverage,
    buildIntegrationHealth,
    buildReliabilitySummary,
    buildSupplierReadiness,
} from '../../src/lib/enterprise-readiness';

test('buildSupplierReadiness surfaces blockers for incomplete onboarding records', () => {
    const readiness = buildSupplierReadiness({
        contactEmail: 'buyer@supplier.com',
        city: null,
        countryCode: null,
        categories: [],
        isoCertifications: [],
        modernSlaveryStatement: 'no',
        financialScore: 0,
        financialHealthRating: null,
        performanceScore: 0,
        responsivenessScore: 0,
        collaborationScore: 0,
        latitude: null,
        longitude: null,
        lastAuditDate: null,
        lastRiskAudit: null,
        lifecycleStatus: 'onboarding',
        documentCount: 0,
        compliance: { total: 2, withEvidence: 0, overdue: 1 },
        requests: { total: 2, open: 2, overdue: 1, verified: 0 },
        tasks: { open: 1, escalated: 1 },
        actionPlans: { active: 0 },
    });

    assert.equal(readiness.canApprove, false);
    assert.ok(readiness.score < readiness.approvalThreshold);
    assert.match(readiness.blockers.join(' '), /location coverage is incomplete/i);
    assert.match(readiness.blockers.join(' '), /compliance obligations exist without evidence/i);
});

test('buildDataConfidence rewards complete and current supplier evidence', () => {
    const confidence = buildDataConfidence({
        contactEmail: 'buyer@supplier.com',
        city: 'Munich',
        countryCode: 'DE',
        categories: ['Mechanical', 'Industrial'],
        isoCertifications: ['ISO 9001'],
        modernSlaveryStatement: 'yes',
        financialScore: 84,
        financialHealthRating: 'A',
        performanceScore: 88,
        responsivenessScore: 82,
        collaborationScore: 79,
        latitude: '48.137154',
        longitude: '11.576124',
        lastAuditDate: new Date(),
        lastRiskAudit: new Date(),
        lifecycleStatus: 'active',
        documentCount: 5,
        compliance: { total: 4, withEvidence: 4, overdue: 0 },
        requests: { total: 4, open: 0, overdue: 0, verified: 4 },
        tasks: { open: 0, escalated: 0 },
        actionPlans: { active: 1 },
    });

    assert.ok(confidence.score >= 85);
    assert.equal(confidence.gaps.length, 0);
    assert.match(confidence.highlights.join(' '), /evidence-backed scoring is in place/i);
});

test('buildIntegrationHealth flags missing connectors and backlog pressure', () => {
    const integration = buildIntegrationHealth({
        totalWebhooks: 2,
        activeWebhooks: 1,
        staleWebhooks: 1,
        deliveries: {
            pending: 3,
            success: 7,
            failed: 4,
            retrying: 2,
        },
        activeSourceSystems: 0,
        recentImports: 0,
        settings: {
            hasPrimaryAiKey: true,
            fallbackKeyCount: 0,
            hasExchangeRates: false,
        },
    });

    assert.ok(integration.score < 80);
    assert.match(integration.gaps.join(' '), /no tracked source system/i);
    assert.match(integration.gaps.join(' '), /exchange-rate coverage is missing/i);
});

test('buildGovernanceCoverage recognises entity gaps and escalation pressure', () => {
    const governance = buildGovernanceCoverage({
        activePolicyCount: 2,
        coveredEntityTypes: ['order', 'invoice'],
        activeToleranceCount: 0,
        supplierSpecificToleranceCount: 0,
        escalatedTasks: 2,
        overdueTasks: 3,
    });

    assert.ok(governance.score < 70);
    assert.match(governance.gaps.join(' '), /approval policies are missing for requisition, contract/i);
    assert.match(governance.gaps.join(' '), /three-way matching tolerances are not configured/i);
});

test('buildReliabilitySummary captures import and webhook performance with task pressure', () => {
    const reliability = buildReliabilitySummary({
        importSuccessRate: 92,
        recentImportJobs: 6,
        webhookSuccessRate: 96,
        recentDeliveries: 40,
        overdueTasks: 1,
        escalatedTasks: 0,
    });

    assert.ok(reliability.score >= 85);
    assert.equal(reliability.gaps.length, 1);
    assert.match(reliability.gaps[0], /operational tasks are still aging/i);
});

test('averageScore rounds and clamps aggregates', () => {
    assert.equal(averageScore([80, 85, 90]), 85);
    assert.equal(averageScore([]), 0);
});
