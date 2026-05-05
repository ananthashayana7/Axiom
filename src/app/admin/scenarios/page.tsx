'use client'

import { useMemo, useState, type ReactNode } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    CheckCircle2,
    Clock3,
    Database,
    Globe2,
    Landmark,
    Loader2,
    RefreshCcw,
    ShieldAlert,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { runScenarioAnalysis } from "@/app/actions/agents/scenario-modeling";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScenarioType = 'price_change' | 'supplier_switch' | 'volume_change' | 'lead_time' | 'currency_fluctuation';

type ScenarioOutcome = {
    category: string;
    metric: string;
    currentValue: string | number;
    projectedValue: string | number;
    impact: 'positive' | 'negative' | 'neutral' | string;
    changePercent?: number;
};

type CurrencyExposure = {
    currency: string;
    sourceAmount: number;
    reportingAmount: number;
    sharePercent: number;
    currentBookRate: number | null;
    liveRate: number | null;
};

type ScenarioBasis = {
    generatedAt: string;
    functionalCurrency: string;
    reportingCurrency: string;
    bookRatePeriod: 'monthly' | 'quarterly';
    bookRateEffectiveDate: string;
    fxFreshness: 'fresh' | 'stale' | 'missing';
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
};

type ScenarioResult = {
    scenarioId: string;
    title: string;
    description: string;
    confidenceScore: number;
    overallImpact: string;
    outcomes: ScenarioOutcome[];
    recommendations: string[];
    riskFactors: string[];
    analysisMode: 'deterministic' | 'hybrid';
    basis: ScenarioBasis;
    assumptions: string[];
    marketSignals: string[];
    parameterEcho: Record<string, number | string>;
    generatedAt: string;
};

type ScenarioInput = {
    scenarioType: ScenarioType;
    title?: string;
    description: string;
    parameters: Record<string, number | string>;
};

type ScenarioFormState = {
    scenarioType: ScenarioType;
    description: string;
    affectedShare: number;
    priceChange: number;
    volumeChange: number;
    currencyCode: string;
    rateChangePercent: number;
    daysChange: number;
    currentRiskScore: number;
    alternateRiskScore: number;
    costDeltaPercent: number;
};

const DEFAULT_FORM: ScenarioFormState = {
    scenarioType: 'price_change',
    description: 'Test a price movement against the current open order book.',
    affectedShare: 35,
    priceChange: 10,
    volumeChange: 20,
    currencyCode: 'USD',
    rateChangePercent: 5,
    daysChange: 7,
    currentRiskScore: 78,
    alternateRiskScore: 46,
    costDeltaPercent: 3,
};

const SCENARIO_META: Record<ScenarioType, { title: string; description: string; }> = {
    price_change: {
        title: 'Price Shock',
        description: 'Stress the live open-order book with a category or market price movement.',
    },
    volume_change: {
        title: 'Volume Shift',
        description: 'Push a demand increase or decrease through procurement flow and watch spend / load.',
    },
    lead_time: {
        title: 'Lead-Time Drift',
        description: 'Model how delivery delays or improvements change operational and cost pressure.',
    },
    supplier_switch: {
        title: 'Supplier Switch',
        description: 'Compare risk, release-blocking posture, and spend on a shifted supplier lane.',
    },
    currency_fluctuation: {
        title: 'Currency Fluctuation',
        description: 'Measure how FX movement changes reporting-book exposure without touching source invoices.',
    },
};

const PLAYBOOKS: Array<{
    id: string;
    label: string;
    summary: string;
    state: Partial<ScenarioFormState>;
}> = [
    {
        id: 'commodity-spike',
        label: 'Commodity spike',
        summary: '14% price increase across 45% of the current open-order lane.',
        state: {
            scenarioType: 'price_change',
            description: 'Commodity spike on critical lanes.',
            priceChange: 14,
            affectedShare: 45,
        },
    },
    {
        id: 'eur-fx-shock',
        label: 'EUR FX shock',
        summary: '6% adverse move on EUR invoice exposure in the reporting book.',
        state: {
            scenarioType: 'currency_fluctuation',
            description: 'EUR strengthens against the reporting currency on exposed invoices.',
            currencyCode: 'EUR',
            rateChangePercent: 6,
        },
    },
    {
        id: 'delay-wave',
        label: 'Port delay wave',
        summary: '9-day slip across 30% of active lanes.',
        state: {
            scenarioType: 'lead_time',
            description: 'Port and carrier delay across current inbound orders.',
            daysChange: 9,
            affectedShare: 30,
        },
    },
    {
        id: 'alternate-source',
        label: 'Alternate source',
        summary: 'Move 25% of spend from risk 78 to risk 46 at a 3% cost premium.',
        state: {
            scenarioType: 'supplier_switch',
            description: 'Forced alternate source away from a high-risk supplier.',
            affectedShare: 25,
            currentRiskScore: 78,
            alternateRiskScore: 46,
            costDeltaPercent: 3,
        },
    },
    {
        id: 'demand-surge',
        label: 'Demand surge',
        summary: '22% demand increase through 40% of the current open order lane.',
        state: {
            scenarioType: 'volume_change',
            description: 'Demand surge across the current release pipeline.',
            volumeChange: 22,
            affectedShare: 40,
        },
    },
];

function formatDate(value: string) {
    return new Date(value).toLocaleString();
}

function formatImpactBadge(impact: string) {
    if (impact.includes('positive')) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (impact.includes('negative')) {
        return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatFxFreshnessBadge(freshness: ScenarioBasis['fxFreshness']) {
    if (freshness === 'fresh') {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (freshness === 'stale') {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-red-200 bg-red-50 text-red-700";
}

function normalizeDisplayValue(value: string | number) {
    if (typeof value === 'number') {
        return value.toLocaleString('en-US');
    }
    return value;
}

function buildScenarioInput(form: ScenarioFormState): ScenarioInput {
    switch (form.scenarioType) {
        case 'price_change':
            return {
                scenarioType: form.scenarioType,
                title: SCENARIO_META[form.scenarioType].title,
                description: form.description,
                parameters: {
                    percentChange: form.priceChange,
                    affectedShare: form.affectedShare,
                },
            };
        case 'volume_change':
            return {
                scenarioType: form.scenarioType,
                title: SCENARIO_META[form.scenarioType].title,
                description: form.description,
                parameters: {
                    percentChange: form.volumeChange,
                    affectedShare: form.affectedShare,
                },
            };
        case 'lead_time':
            return {
                scenarioType: form.scenarioType,
                title: SCENARIO_META[form.scenarioType].title,
                description: form.description,
                parameters: {
                    daysChange: form.daysChange,
                    affectedShare: form.affectedShare,
                },
            };
        case 'supplier_switch':
            return {
                scenarioType: form.scenarioType,
                title: SCENARIO_META[form.scenarioType].title,
                description: form.description,
                parameters: {
                    affectedShare: form.affectedShare,
                    currentRiskScore: form.currentRiskScore,
                    alternateRiskScore: form.alternateRiskScore,
                    costDeltaPercent: form.costDeltaPercent,
                },
            };
        case 'currency_fluctuation':
            return {
                scenarioType: form.scenarioType,
                title: SCENARIO_META[form.scenarioType].title,
                description: form.description,
                parameters: {
                    currencyCode: form.currencyCode,
                    rateChangePercent: form.rateChangePercent,
                },
            };
        default:
            return {
                scenarioType: 'price_change',
                title: SCENARIO_META.price_change.title,
                description: form.description,
                parameters: {
                    percentChange: form.priceChange,
                    affectedShare: form.affectedShare,
                },
            };
    }
}

export default function ScenarioModelingPage() {
    const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [form, setForm] = useState<ScenarioFormState>(DEFAULT_FORM);

    const activeMeta = useMemo(() => SCENARIO_META[form.scenarioType], [form.scenarioType]);
    const latestScenario = scenarios[0] || null;

    const runScenario = async () => {
        setIsRunning(true);
        try {
            const input = buildScenarioInput(form);
            const result = await runScenarioAnalysis(input);

            if (!result.success || !result.data) {
                toast.error("Scenario run failed", {
                    description: result.error || "The engine could not complete the analysis.",
                });
                return;
            }

            setScenarios((previous) => [result.data as ScenarioResult, ...previous].slice(0, 4));
            toast.success("Scenario modeled", {
                description: `${result.data.title} was rebuilt from live workspace baselines.`,
            });
        } catch {
            toast.error("Scenario run failed", {
                description: "The analysis engine hit an unexpected error.",
            });
        } finally {
            setIsRunning(false);
        }
    };

    const loadPlaybook = (playbook: typeof PLAYBOOKS[number]) => {
        setForm((current) => ({
            ...current,
            ...playbook.state,
        }));
    };

    const resetForm = () => {
        setForm(DEFAULT_FORM);
    };

    return (
        <div className="min-h-full bg-muted/40 p-4 lg:p-8 space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-foreground">
                        <BarChart3 className="h-8 w-8 text-primary" />
                        Scenario Modeling
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        Deterministic scenario analysis over live order, supplier, invoice, and FX baselines. Axiom does not pretend to know the market by magic here: you define the shock, the engine shows the exposure, assumptions, and operational consequences.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        Deterministic engine
                    </Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Live workspace baselines
                    </Badge>
                    <Badge variant="outline" className="border-stone-200 bg-white text-stone-700">
                        Market shock is operator-defined
                    </Badge>
                </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Scenario Controls</CardTitle>
                            <CardDescription>
                                Choose the operating stress you want to test, then run it against the current procurement baseline.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="scenarioType">Scenario type</Label>
                                <select
                                    id="scenarioType"
                                    value={form.scenarioType}
                                    onChange={(event) => {
                                        const nextType = event.target.value as ScenarioType;
                                        setForm((current) => ({
                                            ...current,
                                            scenarioType: nextType,
                                            description: SCENARIO_META[nextType].description,
                                        }));
                                    }}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    {Object.entries(SCENARIO_META).map(([value, meta]) => (
                                        <option key={value} value={value}>
                                            {meta.title}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-muted-foreground">{activeMeta.description}</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Business framing</Label>
                                <Textarea
                                    id="description"
                                    value={form.description}
                                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    className="min-h-[96px]"
                                    placeholder="Describe the operational event you are testing."
                                />
                            </div>

                            {(form.scenarioType === 'price_change' || form.scenarioType === 'volume_change') ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="percentChange">
                                            {form.scenarioType === 'price_change' ? 'Price movement (%)' : 'Volume movement (%)'}
                                        </Label>
                                        <Input
                                            id="percentChange"
                                            type="number"
                                            value={form.scenarioType === 'price_change' ? form.priceChange : form.volumeChange}
                                            onChange={(event) => {
                                                const value = Number(event.target.value);
                                                setForm((current) => ({
                                                    ...current,
                                                    [form.scenarioType === 'price_change' ? 'priceChange' : 'volumeChange']: Number.isFinite(value) ? value : 0,
                                                }));
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="affectedShare">Impacted spend share (%)</Label>
                                        <Input
                                            id="affectedShare"
                                            type="number"
                                            value={form.affectedShare}
                                            onChange={(event) => setForm((current) => ({ ...current, affectedShare: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {form.scenarioType === 'lead_time' ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="daysChange">Lead-time movement (days)</Label>
                                        <Input
                                            id="daysChange"
                                            type="number"
                                            value={form.daysChange}
                                            onChange={(event) => setForm((current) => ({ ...current, daysChange: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="affectedShareLead">Impacted order share (%)</Label>
                                        <Input
                                            id="affectedShareLead"
                                            type="number"
                                            value={form.affectedShare}
                                            onChange={(event) => setForm((current) => ({ ...current, affectedShare: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {form.scenarioType === 'currency_fluctuation' ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="currencyCode">Exposed currency</Label>
                                        <select
                                            id="currencyCode"
                                            value={form.currencyCode}
                                            onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            {['USD', 'EUR', 'GBP', 'SGD', 'INR', 'JPY', 'CNY', 'HUF', 'MXN'].map((currency) => (
                                                <option key={currency} value={currency}>{currency}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="rateChangePercent">FX move (%)</Label>
                                        <Input
                                            id="rateChangePercent"
                                            type="number"
                                            value={form.rateChangePercent}
                                            onChange={(event) => setForm((current) => ({ ...current, rateChangePercent: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {form.scenarioType === 'supplier_switch' ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="switchShare">Shifted spend share (%)</Label>
                                        <Input
                                            id="switchShare"
                                            type="number"
                                            value={form.affectedShare}
                                            onChange={(event) => setForm((current) => ({ ...current, affectedShare: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="costDeltaPercent">Cost delta (%)</Label>
                                        <Input
                                            id="costDeltaPercent"
                                            type="number"
                                            value={form.costDeltaPercent}
                                            onChange={(event) => setForm((current) => ({ ...current, costDeltaPercent: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="currentRiskScore">Current supplier risk</Label>
                                        <Input
                                            id="currentRiskScore"
                                            type="number"
                                            value={form.currentRiskScore}
                                            onChange={(event) => setForm((current) => ({ ...current, currentRiskScore: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="alternateRiskScore">Alternate supplier risk</Label>
                                        <Input
                                            id="alternateRiskScore"
                                            type="number"
                                            value={form.alternateRiskScore}
                                            onChange={(event) => setForm((current) => ({ ...current, alternateRiskScore: Number(event.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            ) : null}

                            <div className="rounded-xl border bg-muted/30 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Model discipline</p>
                                <ul className="mt-3 space-y-2 text-sm text-foreground">
                                    <li>Uses live open orders, supplier-risk posture, invoice currency exposure, and finance settings.</li>
                                    <li>Does not rewrite invoices, orders, or book rates. This is a simulation layer only.</li>
                                    <li>Does not pretend to ingest live commodity or market feeds unless that data is explicitly connected.</li>
                                </ul>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button onClick={runScenario} disabled={isRunning} className="min-w-[160px]">
                                    {isRunning ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Running...
                                        </>
                                    ) : (
                                        <>
                                            <BarChart3 className="mr-2 h-4 w-4" />
                                            Run Analysis
                                        </>
                                    )}
                                </Button>
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Reset
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Scenario Playbooks</CardTitle>
                            <CardDescription>
                                Load a serious starting point, then tune the stress inputs before running it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {PLAYBOOKS.map((playbook) => (
                                <button
                                    key={playbook.id}
                                    type="button"
                                    onClick={() => loadPlaybook(playbook)}
                                    className="w-full rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{playbook.label}</p>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{playbook.summary}</p>
                                        </div>
                                        <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
                                    </div>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {!latestScenario ? (
                        <Card className="border-dashed">
                            <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
                                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <BarChart3 className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground">No scenario has been run yet</h2>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                    This page now treats scenarios as operating decisions, not decorative templates. Run one and Axiom will show the live order-book basis, invoice currency exposure, FX freshness, explicit assumptions, and control impacts behind the projection.
                                </p>
                                <div className="mt-6 grid gap-3 text-left md:grid-cols-3">
                                    <MethodCard icon={<Database className="h-4 w-4 text-blue-600" />} title="What it uses" body="Open orders, supplier risk posture, invoice exposure by currency, and configured finance settings." />
                                    <MethodCard icon={<Landmark className="h-4 w-4 text-amber-600" />} title="What stays fixed" body="Source invoices and posted records stay untouched. Only the reporting view and projection change." />
                                    <MethodCard icon={<ShieldAlert className="h-4 w-4 text-red-600" />} title="What it will not fake" body="No live external price or market feed is implied unless that data is actually connected." />
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    {scenarios.map((scenario, index) => (
                        <Card key={scenario.scenarioId} className={index === 0 ? "border-primary/40 shadow-sm" : "opacity-90"}>
                            <CardHeader>
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className={formatImpactBadge(scenario.overallImpact)}>
                                                {scenario.overallImpact.replace(/_/g, ' ')}
                                            </Badge>
                                            <Badge variant="outline" className="border-stone-200 bg-white text-stone-700">
                                                {scenario.analysisMode}
                                            </Badge>
                                            <Badge variant="outline" className="border-stone-200 bg-white text-stone-700">
                                                {formatDate(scenario.generatedAt)}
                                            </Badge>
                                        </div>
                                        <CardTitle className="mt-3 text-2xl">{scenario.title}</CardTitle>
                                        <CardDescription className="mt-2 text-sm leading-6">
                                            {scenario.description}
                                        </CardDescription>
                                    </div>
                                    <div className="rounded-2xl border bg-background px-4 py-3 text-right">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Confidence</p>
                                        <p className="mt-1 text-3xl font-black text-foreground">{scenario.confidenceScore}%</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <BasisCard
                                        icon={<Clock3 className="h-4 w-4 text-blue-600" />}
                                        label="Open Order Basis"
                                        value={`${scenario.basis.openOrders} orders`}
                                        helper={`${scenario.basis.reportingCurrency} ${scenario.basis.openOrderSpend.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                                    />
                                    <BasisCard
                                        icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
                                        label="Supplier Risk"
                                        value={`${scenario.basis.highRiskSuppliers} high-risk suppliers`}
                                        helper={`avg ${scenario.basis.averageSupplierRisk.toFixed(1)}`}
                                    />
                                    <BasisCard
                                        icon={<Globe2 className="h-4 w-4 text-emerald-600" />}
                                        label="Invoice Exposure"
                                        value={`${scenario.basis.totalInvoices} invoices`}
                                        helper={scenario.basis.exposureByCurrency.slice(0, 3).map((entry) => entry.currency).join(', ') || 'No invoice currencies'}
                                    />
                                    <BasisCard
                                        icon={<Landmark className="h-4 w-4 text-amber-600" />}
                                        label="FX Posture"
                                        value={`${scenario.basis.reportingCurrency} book view`}
                                        helper={`${scenario.basis.bookRatePeriod} / ${scenario.basis.bookRateEffectiveDate}`}
                                        badge={
                                            <Badge variant="outline" className={formatFxFreshnessBadge(scenario.basis.fxFreshness)}>
                                                {scenario.basis.fxFreshness}
                                            </Badge>
                                        }
                                    />
                                </div>

                                <div className="grid gap-4 lg:grid-cols-3">
                                    <SectionCard title="Scenario Inputs">
                                        <div className="space-y-2">
                                            {Object.entries(scenario.parameterEcho).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                                                    <span className="font-medium text-muted-foreground">{key}</span>
                                                    <span className="font-semibold text-foreground">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                    <SectionCard title="Market Signals">
                                        <ul className="space-y-2 text-sm text-foreground">
                                            {scenario.marketSignals.map((signal, index2) => (
                                                <li key={index2} className="flex gap-2">
                                                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                                    <span>{signal}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                    <SectionCard title="Assumptions">
                                        <ul className="space-y-2 text-sm text-foreground">
                                            {scenario.assumptions.map((assumption, index2) => (
                                                <li key={index2} className="flex gap-2">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                    <span>{assumption}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Projected outcomes</h3>
                                        <span className="text-xs text-muted-foreground">Current vs projected</span>
                                    </div>
                                    <div className="grid gap-4 xl:grid-cols-3">
                                        {scenario.outcomes.map((outcome, outcomeIndex) => (
                                            <div key={outcomeIndex} className="rounded-2xl border bg-background p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{outcome.category}</p>
                                                        <p className="mt-2 text-sm font-semibold text-foreground">{outcome.metric}</p>
                                                    </div>
                                                    <Badge variant="outline" className={formatImpactBadge(outcome.impact)}>
                                                        {outcome.impact}
                                                    </Badge>
                                                </div>
                                                <div className="mt-4 flex items-center gap-3">
                                                    <span className="text-sm font-medium text-muted-foreground">{normalizeDisplayValue(outcome.currentValue)}</span>
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-base font-black text-foreground">{normalizeDisplayValue(outcome.projectedValue)}</span>
                                                </div>
                                                <div className="mt-3 text-sm font-semibold">
                                                    {typeof outcome.changePercent === 'number' ? (
                                                        <span className={outcome.changePercent > 0 ? "text-red-600" : outcome.changePercent < 0 ? "text-emerald-600" : "text-amber-600"}>
                                                            {outcome.changePercent > 0 ? <TrendingUp className="mr-1 inline h-4 w-4" /> : outcome.changePercent < 0 ? <TrendingDown className="mr-1 inline h-4 w-4" /> : null}
                                                            {outcome.changePercent > 0 ? '+' : ''}{outcome.changePercent}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">No delta calculated</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-3">
                                    <SectionCard title="Recommendations">
                                        <ul className="space-y-2 text-sm text-foreground">
                                            {scenario.recommendations.map((recommendation, index2) => (
                                                <li key={index2} className="flex gap-2">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                    <span>{recommendation}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                    <SectionCard title="Risk Factors">
                                        <ul className="space-y-2 text-sm text-foreground">
                                            {scenario.riskFactors.map((risk, index2) => (
                                                <li key={index2} className="flex gap-2">
                                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                    <span>{risk}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                    <SectionCard title="Currency Exposure Basis">
                                        <div className="space-y-2">
                                            {scenario.basis.exposureByCurrency.slice(0, 4).map((entry) => (
                                                <div key={entry.currency} className="rounded-lg border bg-background px-3 py-2 text-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-semibold text-foreground">{entry.currency}</span>
                                                        <span className="text-muted-foreground">{entry.sharePercent}% share</span>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        Source {entry.sourceAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} | Reporting {entry.reportingAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            ))}
                                            {scenario.basis.exposureByCurrency.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No invoice exposure has been posted yet.</p>
                                            ) : null}
                                        </div>
                                    </SectionCard>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MethodCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
    return (
        <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-center gap-2">
                {icon}
                <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
    );
}

function BasisCard({
    icon,
    label,
    value,
    helper,
    badge,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    helper: string;
    badge?: ReactNode;
}) {
    return (
        <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    {icon}
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                </div>
                {badge}
            </div>
            <p className="mt-3 text-lg font-black text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
    );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border bg-muted/20 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
            <div className="mt-4">{children}</div>
        </div>
    );
}
