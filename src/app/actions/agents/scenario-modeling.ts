/**
 * Scenario Modeling Agent
 * Deterministic what-if analysis over live procurement baselines.
 */

'use server'

import { createHash } from "node:crypto";

import { auth } from "@/auth";
import { db } from "@/db";
import { agentRecommendations, auditLogs, invoices, notifications, platformSettings, procurementOrders, suppliers, users, workflowTasks } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { AgentResult } from "@/lib/ai/agent-types";
import { convertCurrencyAmount, parseFinanceSettings, type FinanceSettings } from "@/lib/finance";
import { canAccessScenarioModeling } from "@/lib/rbac";
import { FX_RATE_STALE_HOURS, SUPPLIER_RELEASE_RISK_THRESHOLD } from "@/lib/sourcing-guardrails";
import { TelemetryService } from "@/lib/telemetry";

type ScenarioType = 'price_change' | 'supplier_switch' | 'volume_change' | 'lead_time' | 'currency_fluctuation';
type ScenarioImpact = 'positive' | 'negative' | 'neutral';
type OverallImpact = 'highly_positive' | 'positive' | 'neutral' | 'negative' | 'highly_negative';
type AnalysisMode = 'deterministic' | 'hybrid';
type FxFreshness = 'fresh' | 'stale' | 'missing';

interface ScenarioInput {
    scenarioType: ScenarioType;
    title?: string;
    description: string;
    parameters: Record<string, number | string>;
}

interface ScenarioOutcome {
    category: string;
    metric: string;
    currentValue: number | string;
    projectedValue: number | string;
    changePercent?: number;
    impact: ScenarioImpact;
}

interface CurrencyExposure {
    currency: string;
    sourceAmount: number;
    reportingAmount: number;
    sharePercent: number;
    currentBookRate: number | null;
    liveRate: number | null;
}

interface ScenarioBasis {
    generatedAt: string;
    functionalCurrency: string;
    reportingCurrency: string;
    bookRatePeriod: FinanceSettings['bookRatePeriod'];
    bookRateEffectiveDate: string;
    fxFreshness: FxFreshness;
    fxUpdatedAt: string | null;
    openOrders: number;
    totalOrders: number;
    openOrderSpend: number;
    averageOpenOrderValue: number;
    totalSuppliers: number;
    highRiskSuppliers: number;
    averageSupplierRisk: number;
    averageOnTimeDeliveryRate: number;
    totalInvoices: number;
    exposureByCurrency: CurrencyExposure[];
}

interface ScenarioResult {
    scenarioId: string;
    title: string;
    description: string;
    outcomes: ScenarioOutcome[];
    overallImpact: OverallImpact;
    riskFactors: string[];
    recommendations: string[];
    confidenceScore: number;
    analysisMode: AnalysisMode;
    basis: ScenarioBasis;
    assumptions: string[];
    marketSignals: string[];
    parameterEcho: Record<string, number | string>;
    generatedAt: string;
}

type ScenarioExecutionPacket = {
    recommendationId: string;
    taskId: string;
    ownerId: string;
    ownerName: string;
    dueDate: string;
    reused: boolean;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function toNumber(value: number | string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: number, digits = 1) {
    const rounded = value.toFixed(digits);
    return `${value > 0 ? '+' : ''}${rounded}%`;
}

function formatInteger(value: number) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

function hoursBetween(date: Date | string | null | undefined) {
    if (!date) return Number.POSITIVE_INFINITY;
    const source = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(source.getTime())) return Number.POSITIVE_INFINITY;
    return (Date.now() - source.getTime()) / (1000 * 60 * 60);
}

function getCurrentRateToReporting(currency: string, finance: FinanceSettings) {
    const normalized = currency.toUpperCase();
    if (normalized === finance.reportingCurrency) {
        return { bookRate: 1, liveRate: 1 };
    }

    const bookRate = finance.bookRates[normalized] ?? null;
    const liveRate = finance.liveRates
        ? convertCurrencyAmount(1, normalized, finance.reportingCurrency, finance, { preferBookRates: false })
        : null;

    return {
        bookRate,
        liveRate: liveRate !== null && Number.isFinite(liveRate) ? Number(liveRate.toFixed(6)) : null,
    };
}

function calculateConfidence(
    scenarioType: ScenarioType,
    basis: ScenarioBasis,
    parameters: Record<string, number | string>,
) {
    let confidence = 84;

    if (basis.openOrderSpend <= 0 && scenarioType !== 'currency_fluctuation') {
        confidence -= 18;
    }

    if (basis.totalSuppliers < 3) {
        confidence -= 6;
    }

    if (basis.fxFreshness === 'stale') {
        confidence -= scenarioType === 'currency_fluctuation' ? 12 : 5;
    }

    if (basis.fxFreshness === 'missing') {
        confidence -= scenarioType === 'currency_fluctuation' ? 20 : 8;
    }

    if (scenarioType === 'currency_fluctuation') {
        const selectedCurrency = String(parameters.currencyCode || '').toUpperCase();
        const exposure = basis.exposureByCurrency.find((entry) => entry.currency === selectedCurrency);
        if (!exposure || exposure.sourceAmount <= 0) {
            confidence -= 18;
        }
    }

    return clamp(Math.round(confidence), 45, 92);
}

function buildScenarioFingerprint(scenario: ScenarioInput) {
    return createHash('sha1')
        .update(JSON.stringify({
            scenarioType: scenario.scenarioType,
            title: scenario.title || '',
            description: scenario.description || '',
            parameters: scenario.parameters,
        }))
        .digest('hex')
        .slice(0, 12);
}

function mapOverallImpactToRecommendationImpact(overallImpact: OverallImpact): 'low' | 'medium' | 'high' | 'critical' {
    switch (overallImpact) {
        case 'highly_negative':
            return 'critical';
        case 'negative':
        case 'highly_positive':
            return 'high';
        case 'positive':
            return 'medium';
        default:
            return 'low';
    }
}

function buildScenarioExecutionSummary(result: ScenarioResult) {
    const topOutcomes = result.outcomes
        .slice(0, 3)
        .map((outcome) => `${outcome.metric}: ${outcome.projectedValue}`)
        .join(' | ');

    return `${result.description} Projected focus: ${topOutcomes}.`;
}

function buildScenarioExecutionExplanation(result: ScenarioResult) {
    return [
        `Overall impact: ${result.overallImpact.replace(/_/g, ' ')} at ${result.confidenceScore}% confidence.`,
        `FX posture: ${result.basis.fxFreshness} ${result.basis.bookRatePeriod} book rates for ${result.basis.reportingCurrency}.`,
        ...result.assumptions.slice(0, 2),
        ...result.riskFactors.slice(0, 2),
    ].join(' ');
}

async function resolveScenarioExecutionOwner(
    scenarioType: ScenarioType,
    requesterId: string,
) {
    const preferredProfiles = scenarioType === 'currency_fluctuation'
        ? ['finance_auditor', 'super_admin']
        : ['sourcing_manager', 'super_admin'];

    for (const profile of preferredProfiles) {
        const [owner] = await db.select({
            id: users.id,
            name: users.name,
            accessProfile: users.accessProfile,
        }).from(users)
            .where(and(
                eq(users.role, 'admin'),
                eq(users.accessProfile, profile),
            ))
            .limit(1);

        if (owner) {
            return owner;
        }
    }

    const [requester] = await db.select({
        id: users.id,
        name: users.name,
        accessProfile: users.accessProfile,
    }).from(users)
        .where(eq(users.id, requesterId))
        .limit(1);

    if (requester) {
        return requester;
    }

    const [fallbackAdmin] = await db.select({
        id: users.id,
        name: users.name,
        accessProfile: users.accessProfile,
    }).from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);

    return fallbackAdmin ?? null;
}

async function getBaselineData(): Promise<ScenarioBasis> {
    const [[supplierSummary], [orderSummary], [settings], invoiceRows] = await Promise.all([
        db.select({
            totalSuppliers: sql<number>`count(*)::int`,
            highRiskSuppliers: sql<number>`count(*) filter (where ${suppliers.riskScore} >= ${SUPPLIER_RELEASE_RISK_THRESHOLD})::int`,
            averageSupplierRisk: sql<number>`coalesce(avg(${suppliers.riskScore}), 0)::float`,
            averageOnTimeDeliveryRate: sql<number>`coalesce(avg(${suppliers.onTimeDeliveryRate}::numeric), 0)::float`,
        }).from(suppliers),
        db.select({
            totalOrders: sql<number>`count(*)::int`,
            openOrders: sql<number>`count(*) filter (where ${procurementOrders.status} not in ('fulfilled', 'cancelled'))::int`,
            openOrderSpend: sql<number>`coalesce(sum(case when ${procurementOrders.status} not in ('fulfilled', 'cancelled') then ${procurementOrders.totalAmount}::numeric else 0 end), 0)::float`,
            averageOpenOrderValue: sql<number>`coalesce(avg(case when ${procurementOrders.status} not in ('fulfilled', 'cancelled') then ${procurementOrders.totalAmount}::numeric end), 0)::float`,
        }).from(procurementOrders),
        db.select().from(platformSettings).limit(1),
        db.select({
            amount: invoices.amount,
            currency: invoices.currency,
        }).from(invoices),
    ]);

    const finance = parseFinanceSettings(settings?.exchangeRates, settings?.defaultCurrency || 'INR');
    const exposureMap = new Map<string, { sourceAmount: number; reportingAmount: number }>();

    for (const row of invoiceRows) {
        const currency = (row.currency || finance.defaultCurrency).toUpperCase();
        const amount = Number(row.amount || 0);
        const reportingAmount = convertCurrencyAmount(
            amount,
            currency,
            finance.reportingCurrency,
            finance,
            { preferBookRates: true },
        );

        const existing = exposureMap.get(currency) ?? { sourceAmount: 0, reportingAmount: 0 };
        existing.sourceAmount += amount;
        existing.reportingAmount += reportingAmount;
        exposureMap.set(currency, existing);
    }

    const totalExposure = Array.from(exposureMap.values()).reduce((sum, entry) => sum + entry.reportingAmount, 0);
    const exposureByCurrency: CurrencyExposure[] = Array.from(exposureMap.entries())
        .map(([currency, entry]) => {
            const rates = getCurrentRateToReporting(currency, finance);
            return {
                currency,
                sourceAmount: Number(entry.sourceAmount.toFixed(2)),
                reportingAmount: Number(entry.reportingAmount.toFixed(2)),
                sharePercent: totalExposure > 0 ? Number(((entry.reportingAmount / totalExposure) * 100).toFixed(1)) : 0,
                currentBookRate: rates.bookRate,
                liveRate: rates.liveRate,
            };
        })
        .sort((left, right) => right.reportingAmount - left.reportingAmount);

    const fxFreshness: FxFreshness = !settings?.exchangeRates
        ? 'missing'
        : hoursBetween(settings.updatedAt) > FX_RATE_STALE_HOURS
            ? 'stale'
            : 'fresh';

    return {
        generatedAt: new Date().toISOString(),
        functionalCurrency: finance.defaultCurrency,
        reportingCurrency: finance.reportingCurrency,
        bookRatePeriod: finance.bookRatePeriod,
        bookRateEffectiveDate: finance.bookRateEffectiveDate,
        fxFreshness,
        fxUpdatedAt: settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
        openOrders: orderSummary?.openOrders || 0,
        totalOrders: orderSummary?.totalOrders || 0,
        openOrderSpend: Number(orderSummary?.openOrderSpend || 0),
        averageOpenOrderValue: Number(orderSummary?.averageOpenOrderValue || 0),
        totalSuppliers: supplierSummary?.totalSuppliers || 0,
        highRiskSuppliers: supplierSummary?.highRiskSuppliers || 0,
        averageSupplierRisk: Number(supplierSummary?.averageSupplierRisk || 0),
        averageOnTimeDeliveryRate: Number(supplierSummary?.averageOnTimeDeliveryRate || 0),
        totalInvoices: invoiceRows.length,
        exposureByCurrency,
    };
}

function buildPriceScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    const percentChange = clamp(toNumber(scenario.parameters.percentChange, 10), -50, 150);
    const affectedShare = clamp(toNumber(scenario.parameters.affectedShare, 35), 1, 100);
    const impactedSpend = basis.openOrderSpend * (affectedShare / 100);
    const projectedSpend = impactedSpend * (1 + percentChange / 100);
    const delta = projectedSpend - impactedSpend;
    const impactedOrders = Math.max(1, Math.round(basis.openOrders * (affectedShare / 100)));
    const currentAverageOrder = impactedOrders > 0 ? impactedSpend / impactedOrders : 0;
    const projectedAverageOrder = impactedOrders > 0 ? projectedSpend / impactedOrders : 0;

    const overallImpact: OverallImpact =
        percentChange <= -12 ? 'highly_positive'
            : percentChange <= -3 ? 'positive'
                : percentChange < 5 ? 'neutral'
                    : percentChange < 12 ? 'negative'
                        : 'highly_negative';

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: scenario.title || "Price Shock Analysis",
        description: scenario.description || "Impact of a market-driven price movement on the current order book.",
        outcomes: [
            {
                category: 'Cost',
                metric: 'Impacted open-order spend',
                currentValue: formatMoney(impactedSpend, basis.reportingCurrency),
                projectedValue: formatMoney(projectedSpend, basis.reportingCurrency),
                changePercent: percentChange,
                impact: percentChange > 0 ? 'negative' : percentChange < 0 ? 'positive' : 'neutral',
            },
            {
                category: 'Cost',
                metric: 'Average impacted PO value',
                currentValue: formatMoney(currentAverageOrder, basis.reportingCurrency),
                projectedValue: formatMoney(projectedAverageOrder, basis.reportingCurrency),
                changePercent: percentChange,
                impact: percentChange > 0 ? 'negative' : percentChange < 0 ? 'positive' : 'neutral',
            },
            {
                category: 'Budget',
                metric: 'Reporting-book delta',
                currentValue: formatMoney(0, basis.reportingCurrency),
                projectedValue: formatMoney(delta, basis.reportingCurrency),
                changePercent: percentChange,
                impact: delta > 0 ? 'negative' : delta < 0 ? 'positive' : 'neutral',
            },
        ],
        overallImpact,
        riskFactors: [
            basis.fxFreshness !== 'fresh'
                ? "FX basis is not fresh, so cross-border reporting pressure may drift from operational reality."
                : "Currency conversion basis is aligned for reporting, but the price shock itself is operator-defined.",
            basis.highRiskSuppliers > 0
                ? `${basis.highRiskSuppliers} suppliers are already above the release-risk threshold, which amplifies cost pressure.`
                : "Supplier risk posture is not the primary limiter in this run.",
            "No external commodity feed is attached here, so the shock value must reflect your market judgment.",
        ],
        recommendations: [
            delta > 0
                ? "Freeze discretionary releases on the impacted lane and renegotiate before the next approval batch."
                : "Use the favorable movement to lock pricing into fixed-book contracts before the market normalizes.",
            "Review the highest-value open orders first; those drive the biggest budget variance.",
            "Pair this run with supplier risk and compliance checks before converting requisitions into POs.",
        ],
        confidenceScore: calculateConfidence(scenario.scenarioType, basis, scenario.parameters),
        analysisMode: 'deterministic',
        basis,
        assumptions: [
            `The shock applies to ${affectedShare}% of the current open-order spend only.`,
            "Volumes, payment terms, and supplier mix stay unchanged in this run.",
            `Results are expressed in ${basis.reportingCurrency} using the configured reporting-book lens.`,
        ],
        marketSignals: [
            `Order-book basis: ${formatInteger(basis.openOrders)} open orders worth ${formatMoney(basis.openOrderSpend, basis.reportingCurrency)}.`,
            `FX posture: ${basis.fxFreshness} ${basis.bookRatePeriod} book rates effective ${basis.bookRateEffectiveDate}.`,
            "Market shock input is manual; the engine does not scrape commodity prices in real time yet.",
        ],
        parameterEcho: {
            percentChange,
            affectedShare,
        },
        generatedAt: new Date().toISOString(),
    };
}

function buildVolumeScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    const percentChange = clamp(toNumber(scenario.parameters.percentChange, 20), -60, 100);
    const affectedShare = clamp(toNumber(scenario.parameters.affectedShare, 40), 1, 100);
    const impactedSpend = basis.openOrderSpend * (affectedShare / 100);
    const impactedOrders = Math.max(1, Math.round(basis.openOrders * (affectedShare / 100)));
    const projectedOrderCount = Math.max(0, Math.round(impactedOrders * (1 + percentChange / 100)));
    const unitCostShift = percentChange >= 0
        ? -Math.min(percentChange * 0.18, 7)
        : Math.min(Math.abs(percentChange) * 0.12, 6);
    const projectedSpend = impactedSpend * (1 + percentChange / 100) * (1 + unitCostShift / 100);
    const inventoryPressure = percentChange >= 0
        ? Math.min(percentChange * 0.7, 60)
        : -Math.min(Math.abs(percentChange) * 0.5, 40);

    const overallImpact: OverallImpact =
        percentChange >= 30 && unitCostShift <= -3 ? 'positive'
            : percentChange >= 10 ? 'neutral'
                : percentChange <= -25 ? 'negative'
                    : 'neutral';

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: scenario.title || "Volume Shift Analysis",
        description: scenario.description || "Impact of a procurement-volume change on order spend and load.",
        outcomes: [
            {
                category: 'Demand',
                metric: 'Impacted order count',
                currentValue: formatInteger(impactedOrders),
                projectedValue: formatInteger(projectedOrderCount),
                changePercent: percentChange,
                impact: percentChange >= 0 ? 'neutral' : 'negative',
            },
            {
                category: 'Cost',
                metric: 'Projected released spend',
                currentValue: formatMoney(impactedSpend, basis.reportingCurrency),
                projectedValue: formatMoney(projectedSpend, basis.reportingCurrency),
                changePercent: Number((((projectedSpend - impactedSpend) / Math.max(impactedSpend, 1)) * 100).toFixed(1)),
                impact: projectedSpend <= impactedSpend ? 'positive' : 'negative',
            },
            {
                category: 'Capacity',
                metric: 'Inventory / handling pressure index',
                currentValue: '0%',
                projectedValue: formatPercent(inventoryPressure),
                changePercent: inventoryPressure,
                impact: inventoryPressure > 0 ? 'negative' : inventoryPressure < 0 ? 'positive' : 'neutral',
            },
        ],
        overallImpact,
        riskFactors: [
            percentChange > 0
                ? "Upward volume pressure can create warehouse, receiving, and approval bottlenecks even when unit prices improve."
                : "Lower committed volume can weaken negotiated price breaks and supplier priority.",
            basis.highRiskSuppliers > 0
                ? "Any demand surge routed through high-risk suppliers increases the chance of blocked releases."
                : "Supplier-risk posture is currently manageable for this load scenario.",
            "This run uses current order-book exposure and a deterministic unit-cost heuristic, not a supplier-specific contract curve.",
        ],
        recommendations: [
            percentChange > 0
                ? "Validate storage, receiving, and approval capacity before taking the volume upside."
                : "Re-check supplier minimum-order commitments before pulling demand down.",
            "Run this scenario together with financial matching and exception queues to estimate operational fallout.",
            "Use category-specific pricing curves next if you want contract-grade precision instead of portfolio-level direction.",
        ],
        confidenceScore: calculateConfidence(scenario.scenarioType, basis, scenario.parameters),
        analysisMode: 'deterministic',
        basis,
        assumptions: [
            `The volume move applies to ${affectedShare}% of the open-order lane.`,
            `A deterministic unit-cost response of ${formatPercent(unitCostShift)} is applied to reflect scale gain or loss.`,
            "Supplier mix remains unchanged; this run tests demand movement, not supplier reallocation.",
        ],
        marketSignals: [
            `Current average open-order value: ${formatMoney(basis.averageOpenOrderValue, basis.reportingCurrency)}.`,
            `Supplier pool: ${formatInteger(basis.totalSuppliers)} suppliers with average risk ${basis.averageSupplierRisk.toFixed(1)}.`,
            "No live demand forecast feed is attached here; the demand shock is a deliberate planning input.",
        ],
        parameterEcho: {
            percentChange,
            affectedShare,
            unitCostShift,
        },
        generatedAt: new Date().toISOString(),
    };
}

function buildLeadTimeScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    const daysChange = clamp(toNumber(scenario.parameters.daysChange, 7), -14, 60);
    const affectedShare = clamp(toNumber(scenario.parameters.affectedShare, 30), 1, 100);
    const impactedOrders = Math.max(1, Math.round(basis.openOrders * (affectedShare / 100)));
    const currentOnTime = clamp(basis.averageOnTimeDeliveryRate, 0, 100);
    const projectedOnTime = clamp(currentOnTime - (daysChange * 1.1), 35, 99);
    const currentLateOrders = impactedOrders * ((100 - currentOnTime) / 100);
    const projectedLateOrders = impactedOrders * ((100 - projectedOnTime) / 100);
    const expeditePremiumPct = daysChange > 0 ? Math.min(daysChange * 0.4, 10) : 0;
    const expeditePremium = basis.openOrderSpend * (affectedShare / 100) * (expeditePremiumPct / 100);

    const overallImpact: OverallImpact =
        daysChange <= -5 ? 'positive'
            : daysChange <= 2 ? 'neutral'
                : daysChange <= 8 ? 'negative'
                    : 'highly_negative';

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: scenario.title || "Lead-Time Drift Analysis",
        description: scenario.description || "Impact of transit or supplier lead-time movement on current releases.",
        outcomes: [
            {
                category: 'Delivery',
                metric: 'On-time delivery rate',
                currentValue: formatPercent(currentOnTime),
                projectedValue: formatPercent(projectedOnTime),
                changePercent: Number((projectedOnTime - currentOnTime).toFixed(1)),
                impact: projectedOnTime >= currentOnTime ? 'positive' : 'negative',
            },
            {
                category: 'Operations',
                metric: 'Orders likely to slip',
                currentValue: formatInteger(Math.round(currentLateOrders)),
                projectedValue: formatInteger(Math.round(projectedLateOrders)),
                changePercent: impactedOrders > 0 ? Number((((projectedLateOrders - currentLateOrders) / impactedOrders) * 100).toFixed(1)) : 0,
                impact: projectedLateOrders <= currentLateOrders ? 'positive' : 'negative',
            },
            {
                category: 'Cost',
                metric: 'Estimated expedite premium',
                currentValue: formatMoney(0, basis.reportingCurrency),
                projectedValue: formatMoney(expeditePremium, basis.reportingCurrency),
                changePercent: expeditePremiumPct,
                impact: expeditePremium > 0 ? 'negative' : 'neutral',
            },
        ],
        overallImpact,
        riskFactors: [
            daysChange > 0
                ? "Lead-time deterioration will hit receiving, invoice timing, and downstream fulfillment before the spend ledger shows it."
                : "Shorter lead times help flow, but can still create dock and QC compression if operations are not ready.",
            basis.highRiskSuppliers > 0
                ? "Existing supplier-risk exposure increases the chance that delays turn into hard release blocks."
                : "Supplier-risk posture is not the main stressor in this delay scenario.",
            "The delay model uses the current supplier on-time baseline, not carrier-specific telemetry.",
        ],
        recommendations: [
            daysChange > 0
                ? "Buffer inventory for critical lines and decide in advance which orders justify expedite spend."
                : "If lead times improve, re-plan receipts and approvals so you actually capture the throughput gain.",
            "Review exception management and goods-receipt capacity before assuming the network can absorb the change.",
            "Escalate only the suppliers tied to the highest-value open orders; they dominate the impact curve.",
        ],
        confidenceScore: calculateConfidence(scenario.scenarioType, basis, scenario.parameters),
        analysisMode: 'deterministic',
        basis,
        assumptions: [
            `The lead-time shift applies to ${affectedShare}% of the current open-order book.`,
            "Supplier mix and order value stay constant; only time performance is stressed.",
            "Expedite premium is a deterministic proxy to quantify recovery pressure, not a carrier quote.",
        ],
        marketSignals: [
            `Current supplier on-time baseline: ${formatPercent(currentOnTime)}.`,
            `Impacted operational lane: ${formatInteger(impactedOrders)} open orders.`,
            "No live freight index is attached here; delay days are an explicit operator input.",
        ],
        parameterEcho: {
            daysChange,
            affectedShare,
            expeditePremiumPct,
        },
        generatedAt: new Date().toISOString(),
    };
}

function buildSupplierSwitchScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    const affectedShare = clamp(toNumber(scenario.parameters.affectedShare, 25), 1, 100);
    const currentRiskScore = clamp(toNumber(scenario.parameters.currentRiskScore, Math.max(basis.averageSupplierRisk, 75)), 0, 100);
    const alternateRiskScore = clamp(toNumber(scenario.parameters.alternateRiskScore, Math.max(basis.averageSupplierRisk - 15, 40)), 0, 100);
    const costDeltaPercent = clamp(toNumber(scenario.parameters.costDeltaPercent, 3), -20, 40);
    const impactedSpend = basis.openOrderSpend * (affectedShare / 100);
    const projectedSpend = impactedSpend * (1 + costDeltaPercent / 100);
    const currentBlockedSpend = currentRiskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD ? impactedSpend : 0;
    const projectedBlockedSpend = alternateRiskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD ? projectedSpend : 0;

    const overallImpact: OverallImpact =
        alternateRiskScore < SUPPLIER_RELEASE_RISK_THRESHOLD && currentRiskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD && costDeltaPercent <= 5
            ? 'positive'
            : alternateRiskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD
                ? 'highly_negative'
                : costDeltaPercent > 10
                    ? 'negative'
                    : 'neutral';

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: scenario.title || "Supplier Switch Analysis",
        description: scenario.description || "Impact of moving an order lane from one supplier-risk profile to another.",
        outcomes: [
            {
                category: 'Risk',
                metric: 'Supplier risk score',
                currentValue: currentRiskScore,
                projectedValue: alternateRiskScore,
                changePercent: Number((alternateRiskScore - currentRiskScore).toFixed(1)),
                impact: alternateRiskScore < currentRiskScore ? 'positive' : alternateRiskScore > currentRiskScore ? 'negative' : 'neutral',
            },
            {
                category: 'Controls',
                metric: 'Release-blocked spend',
                currentValue: formatMoney(currentBlockedSpend, basis.reportingCurrency),
                projectedValue: formatMoney(projectedBlockedSpend, basis.reportingCurrency),
                changePercent: impactedSpend > 0 ? Number((((projectedBlockedSpend - currentBlockedSpend) / impactedSpend) * 100).toFixed(1)) : 0,
                impact: projectedBlockedSpend < currentBlockedSpend ? 'positive' : projectedBlockedSpend > currentBlockedSpend ? 'negative' : 'neutral',
            },
            {
                category: 'Cost',
                metric: 'Spend on switched lane',
                currentValue: formatMoney(impactedSpend, basis.reportingCurrency),
                projectedValue: formatMoney(projectedSpend, basis.reportingCurrency),
                changePercent: costDeltaPercent,
                impact: costDeltaPercent <= 0 ? 'positive' : 'negative',
            },
        ],
        overallImpact,
        riskFactors: [
            alternateRiskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD
                ? "The alternate supplier still breaches the release threshold, so the switch does not restore flow."
                : "The alternate profile improves release posture, but QA and onboarding friction can still slow adoption.",
            costDeltaPercent > 0
                ? "The lane becomes more expensive, so the risk improvement must be worth the premium."
                : "Cost relief is possible, but only if the alternate supplier can actually absorb the lane.",
            "This run compares risk posture and spend on the lane; it does not model supplier-specific quality history yet.",
        ],
        recommendations: [
            alternateRiskScore < SUPPLIER_RELEASE_RISK_THRESHOLD
                ? "Route only the highest-risk blocked lane first and prove alternate supplier stability before scaling."
                : "Do not switch blindly; the alternate profile still triggers control friction.",
            "Pair the switch with compliance evidence and first-article quality checks before releasing high-value orders.",
            "Use Exception Management as the landing zone for any receipts or invoices that arrive during the transition.",
        ],
        confidenceScore: calculateConfidence(scenario.scenarioType, basis, scenario.parameters),
        analysisMode: 'deterministic',
        basis,
        assumptions: [
            `The switched lane represents ${affectedShare}% of the current open-order spend.`,
            `Current and alternate risk scores are operator-specified: ${currentRiskScore} -> ${alternateRiskScore}.`,
            "The model evaluates release posture and spend impact, not supplier-specific tooling or quality ramp-up time.",
        ],
        marketSignals: [
            `${formatInteger(basis.highRiskSuppliers)} suppliers already sit at or above the release threshold of ${SUPPLIER_RELEASE_RISK_THRESHOLD}.`,
            `Average supplier risk across the workspace is ${basis.averageSupplierRisk.toFixed(1)}.`,
            "No external supplier watch feed is attached here; the risk scores come from the in-app supplier model.",
        ],
        parameterEcho: {
            affectedShare,
            currentRiskScore,
            alternateRiskScore,
            costDeltaPercent,
        },
        generatedAt: new Date().toISOString(),
    };
}

function buildCurrencyScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    const currencyCode = String(scenario.parameters.currencyCode || basis.exposureByCurrency[0]?.currency || 'USD').toUpperCase();
    const rateChangePercent = clamp(toNumber(scenario.parameters.rateChangePercent, 5), -50, 50);
    const exposure = basis.exposureByCurrency.find((entry) => entry.currency === currencyCode);
    const currentRate = exposure?.currentBookRate ?? exposure?.liveRate ?? (currencyCode === basis.reportingCurrency ? 1 : null);
    const sourceExposure = exposure?.sourceAmount ?? 0;
    const currentReportingExposure = currentRate ? sourceExposure * currentRate : 0;
    const projectedRate = currentRate ? currentRate * (1 + rateChangePercent / 100) : 0;
    const projectedReportingExposure = sourceExposure * projectedRate;
    const delta = projectedReportingExposure - currentReportingExposure;

    const overallImpact: OverallImpact =
        rateChangePercent <= -8 ? 'positive'
            : rateChangePercent <= -2 ? 'neutral'
                : rateChangePercent < 4 ? 'neutral'
                    : rateChangePercent < 10 ? 'negative'
                        : 'highly_negative';

    return {
        scenarioId: `scenario-${Date.now()}`,
        title: scenario.title || `${currencyCode} FX Exposure Analysis`,
        description: scenario.description || `Impact of a ${formatPercent(rateChangePercent)} move on ${currencyCode} exposure.`,
        outcomes: [
            {
                category: 'Exposure',
                metric: `${currencyCode} source exposure`,
                currentValue: formatMoney(sourceExposure, currencyCode),
                projectedValue: formatMoney(sourceExposure, currencyCode),
                changePercent: 0,
                impact: 'neutral',
            },
            {
                category: 'FX',
                metric: `Rate to ${basis.reportingCurrency}`,
                currentValue: currentRate ? currentRate.toFixed(6) : 'Unavailable',
                projectedValue: currentRate ? projectedRate.toFixed(6) : 'Unavailable',
                changePercent: rateChangePercent,
                impact: rateChangePercent > 0 ? 'negative' : rateChangePercent < 0 ? 'positive' : 'neutral',
            },
            {
                category: 'Reporting',
                metric: 'Reporting-book exposure value',
                currentValue: formatMoney(currentReportingExposure, basis.reportingCurrency),
                projectedValue: formatMoney(projectedReportingExposure, basis.reportingCurrency),
                changePercent: currentReportingExposure > 0 ? Number((((projectedReportingExposure - currentReportingExposure) / currentReportingExposure) * 100).toFixed(1)) : 0,
                impact: delta > 0 ? 'negative' : delta < 0 ? 'positive' : 'neutral',
            },
        ],
        overallImpact,
        riskFactors: [
            !currentRate
                ? `No current rate is configured for ${currencyCode}, so the result is directionally weak until finance loads that pair.`
                : `${currencyCode} exposure is translated through the configured reporting-book lens, so stale rates will misstate global rollups.`,
            basis.fxFreshness !== 'fresh'
                ? "FX posture is not fresh; rely on source-currency ledgers for final accounting until finance refreshes the basis."
                : "Book and live rate layers are available for this run.",
            sourceExposure <= 0
                ? `No posted invoice exposure exists in ${currencyCode}, so this run is testing a hypothetical lane rather than live exposure.`
                : `Posted invoice exposure in ${currencyCode} is already material enough to move reporting totals.`,
        ],
        recommendations: [
            "Refresh reporting-book rates before using this scenario for executive reporting or savings claims.",
            "If the move is adverse, isolate the affected currency lane and review payment timing, hedging, or supplier terms.",
            "Keep the source invoice currency untouched; only the view layer and reporting conversion should move here.",
        ],
        confidenceScore: calculateConfidence(scenario.scenarioType, basis, scenario.parameters),
        analysisMode: 'deterministic',
        basis,
        assumptions: [
            `Exposure is measured from posted invoices already recorded in ${currencyCode}.`,
            `Projected rate move is operator-defined at ${formatPercent(rateChangePercent)} from the current configured basis.`,
            `The reporting currency remains fixed at ${basis.reportingCurrency}; source invoices are never rewritten.`,
        ],
        marketSignals: [
            `FX posture: ${basis.fxFreshness} ${basis.bookRatePeriod} book rates effective ${basis.bookRateEffectiveDate}.`,
            basis.fxUpdatedAt
                ? `Finance settings were last updated at ${new Date(basis.fxUpdatedAt).toLocaleString()}.`
                : "Finance settings do not yet carry an FX refresh timestamp.",
            `Top invoice currencies in the workspace: ${basis.exposureByCurrency.slice(0, 3).map((entry) => entry.currency).join(', ') || 'none yet'}.`,
        ],
        parameterEcho: {
            currencyCode,
            rateChangePercent,
            currentRate: currentRate ?? 'Unavailable',
            projectedRate: currentRate ? Number(projectedRate.toFixed(6)) : 'Unavailable',
        },
        generatedAt: new Date().toISOString(),
    };
}

function buildDeterministicScenario(scenario: ScenarioInput, basis: ScenarioBasis): ScenarioResult {
    switch (scenario.scenarioType) {
        case 'price_change':
            return buildPriceScenario(scenario, basis);
        case 'volume_change':
            return buildVolumeScenario(scenario, basis);
        case 'lead_time':
            return buildLeadTimeScenario(scenario, basis);
        case 'supplier_switch':
            return buildSupplierSwitchScenario(scenario, basis);
        case 'currency_fluctuation':
            return buildCurrencyScenario(scenario, basis);
        default:
            return buildPriceScenario({ ...scenario, scenarioType: 'price_change' }, basis);
    }
}

export async function runScenarioAnalysis(
    scenario: ScenarioInput,
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
            timestamp: new Date(),
        };
    }

    try {
        const basis = await getBaselineData();
        const result = buildDeterministicScenario(scenario, basis);

        await TelemetryService.trackEvent("ScenarioModeling", "analysis_completed", {
            scenarioType: scenario.scenarioType,
            overallImpact: result.overallImpact,
            analysisMode: result.analysisMode,
        });

        return {
            success: true,
            data: result,
            confidence: result.confidenceScore,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: `Modeled ${scenario.scenarioType} using live supplier, order, invoice, and finance baselines.`,
            sources: ["suppliers", "procurement_orders", "invoices", "platform_settings"],
        };
    } catch (error) {
        console.error("Scenario Modeling Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Scenario modeling failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
        };
    }
}

export async function stageScenarioExecutionPlan(
    scenario: ScenarioInput,
): Promise<AgentResult<ScenarioExecutionPacket>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user || session.user.role !== 'admin' || !canAccessScenarioModeling(session.user)) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
        };
    }

    try {
        const basis = await getBaselineData();
        const result = buildDeterministicScenario(scenario, basis);
        const fingerprint = buildScenarioFingerprint(scenario);
        const recommendationType = `scenario_apply:${scenario.scenarioType}:${fingerprint}`;

        const [existingRecommendation] = await db.select({
            id: agentRecommendations.id,
            ownerId: agentRecommendations.ownerId,
            dueDate: agentRecommendations.dueDate,
        }).from(agentRecommendations)
            .where(and(
                eq(agentRecommendations.agentName, 'scenario-modeling'),
                eq(agentRecommendations.recommendationType, recommendationType),
                inArray(agentRecommendations.status, ['pending', 'approved']),
            ))
            .orderBy(desc(agentRecommendations.createdAt))
            .limit(1);

        if (existingRecommendation) {
            const [existingTask] = await db.select({
                id: workflowTasks.id,
            }).from(workflowTasks)
                .where(and(
                    eq(workflowTasks.entityType, 'agent_recommendation'),
                    eq(workflowTasks.entityId, existingRecommendation.id),
                    inArray(workflowTasks.status, ['open', 'in_progress', 'blocked', 'escalated']),
                ))
                .orderBy(desc(workflowTasks.createdAt))
                .limit(1);

            const [owner] = await db.select({
                id: users.id,
                name: users.name,
            }).from(users)
                .where(eq(users.id, existingRecommendation.ownerId || session.user.id))
                .limit(1);

            return {
                success: true,
                data: {
                    recommendationId: existingRecommendation.id,
                    taskId: existingTask?.id || existingRecommendation.id,
                    ownerId: owner?.id || (session.user.id as string),
                    ownerName: owner?.name || session.user.name || 'Assigned owner',
                    dueDate: (existingRecommendation.dueDate || new Date()).toISOString(),
                    reused: true,
                },
                confidence: result.confidenceScore,
                executionTimeMs: Date.now() - startTime,
                agentName: "scenario-modeling",
                timestamp: new Date(),
                reasoning: `Reused the existing governed apply packet for ${scenario.scenarioType}.`,
            };
        }

        const owner = await resolveScenarioExecutionOwner(scenario.scenarioType, session.user.id as string);
        if (!owner) {
            throw new Error("No admin owner is available to receive the scenario execution plan.");
        }

        const impact = mapOverallImpactToRecommendationImpact(result.overallImpact);
        const dueDate = new Date(Date.now() + (scenario.scenarioType === 'currency_fluctuation' ? 2 : 3) * 24 * 60 * 60 * 1000);
        const executionPayload = JSON.stringify({
            scenario,
            result,
            stagedFrom: 'scenario_modeling',
            createdBy: session.user.id,
        });

        const [recommendation] = await db.insert(agentRecommendations).values({
            agentName: 'scenario-modeling',
            recommendationType,
            title: `Apply plan: ${result.title}`,
            description: buildScenarioExecutionSummary(result),
            impact,
            confidence: result.confidenceScore,
            businessImpact: result.recommendations.slice(0, 2).join(' '),
            explanation: buildScenarioExecutionExplanation(result),
            executionPayload,
            entityType: 'agent_recommendation',
            ownerId: owner.id,
            dueDate,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'pending',
        }).returning({
            id: agentRecommendations.id,
            title: agentRecommendations.title,
        });

        const [task] = await db.insert(workflowTasks).values({
            title: `Review apply plan: ${result.title}`,
            description: `A governed execution packet was created from Scenario Modeling. Review the assumptions, approve only the operationally safe actions, and convert accepted moves into sourcing or finance work.`,
            entityType: 'agent_recommendation',
            entityId: recommendation.id,
            priority: impact === 'critical' ? 'critical' : impact === 'high' ? 'high' : 'medium',
            assigneeId: owner.id,
            createdById: session.user.id as string,
            dueDate,
            nextAction: 'Review the scenario packet, validate the assumptions, and route approved actions into live sourcing or finance execution.',
        }).returning({
            id: workflowTasks.id,
        });

        if (owner.id !== session.user.id) {
            await db.insert(notifications).values({
                userId: owner.id,
                title: 'Scenario apply plan queued',
                message: `${result.title} now needs governed review before any live procurement action is taken.`,
                type: impact === 'critical' ? 'warning' : 'info',
                link: '/admin/tasks',
            });
        }

        await db.insert(auditLogs).values({
            userId: session.user.id as string,
            action: 'QUEUE',
            entityType: 'agent_recommendation',
            entityId: recommendation.id,
            details: `Governed scenario apply plan queued for ${result.title}.`,
        });

        await TelemetryService.trackEvent("ScenarioModeling", "execution_plan_staged", {
            scenarioType: scenario.scenarioType,
            impact,
            ownerId: owner.id,
        });

        return {
            success: true,
            data: {
                recommendationId: recommendation.id,
                taskId: task.id,
                ownerId: owner.id,
                ownerName: owner.name || 'Assigned owner',
                dueDate: dueDate.toISOString(),
                reused: false,
            },
            confidence: result.confidenceScore,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: `Staged a governed apply packet for ${scenario.scenarioType} using the live scenario basis and routed it into Task Inbox.`,
        };
    } catch (error) {
        console.error("Scenario Execution Staging Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Scenario execution plan could not be staged",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
        };
    }
}

export async function compareScenarios(
    scenarios: ScenarioInput[],
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
            timestamp: new Date(),
        };
    }

    try {
        const comparisons: ScenarioResult[] = [];

        for (const scenario of scenarios.slice(0, 5)) {
            const result = await runScenarioAnalysis(scenario);
            if (result.success && result.data) {
                comparisons.push(result.data);
            }
        }

        const impactScores: Record<OverallImpact, number> = {
            highly_positive: 5,
            positive: 4,
            neutral: 3,
            negative: 2,
            highly_negative: 1,
        };

        let bestScenario = 0;
        let bestScore = 0;

        comparisons.forEach((comparison, index) => {
            const score = impactScores[comparison.overallImpact] * (comparison.confidenceScore / 100);
            if (score > bestScore) {
                bestScore = score;
                bestScenario = index;
            }
        });

        return {
            success: true,
            data: {
                comparisons,
                recommendation: `Scenario ${bestScenario + 1} (${comparisons[bestScenario]?.title}) offers the strongest risk-adjusted posture.`,
                bestScenario,
            },
            confidence: 78,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
            reasoning: `Compared ${comparisons.length} deterministic scenarios against live workspace baselines.`,
        };
    } catch (error) {
        console.error("Scenario Comparison Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Comparison failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "scenario-modeling",
            timestamp: new Date(),
        };
    }
}

export async function getScenarioTemplates(): Promise<ScenarioInput[]> {
    return [
        {
            scenarioType: 'price_change',
            title: 'Commodity spike on critical lanes',
            description: 'Test a rapid price increase against the currently open order book.',
            parameters: { percentChange: 14, affectedShare: 45 },
        },
        {
            scenarioType: 'currency_fluctuation',
            title: 'EUR reporting shock',
            description: 'Test how an adverse FX move changes reporting-book exposure on posted invoices.',
            parameters: { currencyCode: 'EUR', rateChangePercent: 6 },
        },
        {
            scenarioType: 'supplier_switch',
            title: 'Forced alternate source',
            description: 'Model a lane move away from a high-risk supplier into an alternate source.',
            parameters: { affectedShare: 25, currentRiskScore: 78, alternateRiskScore: 46, costDeltaPercent: 3 },
        },
        {
            scenarioType: 'lead_time',
            title: 'Port and carrier delay',
            description: 'Stress the open order book with transit-time deterioration.',
            parameters: { daysChange: 9, affectedShare: 30 },
        },
        {
            scenarioType: 'volume_change',
            title: 'Demand surge',
            description: 'Push a growth shock through the current order lane and observe spend / load effects.',
            parameters: { percentChange: 22, affectedShare: 40 },
        },
    ];
}
