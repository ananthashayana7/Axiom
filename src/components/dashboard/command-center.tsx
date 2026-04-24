'use client'

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from "sonner";
import {
    Activity,
    ArrowUpRight,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Clock3,
    CreditCard,
    Database,
    FileText,
    Handshake,
    Loader2,
    RefreshCcw,
    Search,
    Shield,
    Sparkles,
    TrendingUp,
    TriangleAlert,
    Zap,
} from "lucide-react";

import { AGENT_BUNDLE_META, AGENT_BUNDLES, AGENT_REGISTRY, QUICK_ACTION_AGENTS, type AgentBundleName, type AgentName } from "@/app/actions/agents/registry";
import {
    getAgentDashboardSnapshot,
    triggerAgentBundle,
    triggerAgentDispatch,
    type AgentDashboardSnapshot,
    type AgentDispatchSummary,
} from "@/app/actions/agents";
import { AxiomLogo } from "@/components/shared/axiom-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AgentRuntimeStatus = 'idle' | 'running' | 'success' | 'failed' | 'workspace';

interface AgentRuntimeState {
    status: AgentRuntimeStatus;
    lastRunAt?: string;
    message?: string;
    attempts?: number;
    summary?: AgentDispatchSummary;
}

interface MissionReport {
    title: string;
    summary: AgentDispatchSummary;
    timestamp: string;
    success: boolean;
}

const EMPTY_SNAPSHOT: AgentDashboardSnapshot = {
    generatedAt: '',
    fraudAlerts: 0,
    criticalFraudAlerts: 0,
    paymentSavings: 0,
    pendingPaymentOpportunities: 0,
    replenishmentAlerts: 0,
    degradedPanels: [],
    systemWarnings: [],
};

const BUNDLE_ORDER: AgentBundleName[] = ['post-import', 'compliance-sweep', 'workflow-recovery'];

const RUN_STAGES: Partial<Record<AgentName, string[]>> = {
    'fraud-detection': [
        'Replaying recent transaction patterns.',
        'Comparing vendor and invoice fingerprints.',
        'Staging priority alerts for analyst review.',
    ],
    'payment-optimizer': [
        'Refreshing pending invoice windows.',
        'Repricing discount and float opportunities.',
        'Preparing payment timing recommendations.',
    ],
    'demand-forecasting': [
        'Rebuilding recent consumption curves.',
        'Checking volatility against safety stock.',
        'Publishing forecast confidence bands.',
    ],
    'auto-remediation': [
        'Scanning workflow state drift.',
        'Checking stale approvals and orphaned tasks.',
        'Applying guarded recovery actions.',
    ],
    'predictive-bottleneck': [
        'Tracing queue throughput.',
        'Projecting SLA pressure across lanes.',
        'Ranking the next bottlenecks to clear.',
    ],
    'smart-approval-routing': [
        'Recomputing trusted approval paths.',
        'Validating low-risk auto-approval rules.',
        'Publishing safe reroute recommendations.',
    ],
    'scenario-modeling': [
        'Loading the baseline operating model.',
        'Projecting market movement scenarios.',
        'Comparing downstream cost impact.',
    ],
    'supplier-ecosystem': [
        'Mapping supplier nodes and shared dependencies.',
        'Scoring exposure across clusters.',
        'Publishing ecosystem health signals.',
    ],
};

const agentIcons: Record<AgentName, React.ReactNode> = {
    'demand-forecasting': <TrendingUp className="h-4 w-4" />,
    'fraud-detection': <Shield className="h-4 w-4" />,
    'payment-optimizer': <CreditCard className="h-4 w-4" />,
    'negotiations-autopilot': <Handshake className="h-4 w-4" />,
    'contract-clause-analyzer': <FileText className="h-4 w-4" />,
    'smart-approval-routing': <Database className="h-4 w-4" />,
    'predictive-bottleneck': <Clock3 className="h-4 w-4" />,
    'auto-remediation': <Activity className="h-4 w-4" />,
    'scenario-modeling': <BarChart3 className="h-4 w-4" />,
    'supplier-ecosystem': <Database className="h-4 w-4" />,
};

const categoryTone: Record<typeof AGENT_REGISTRY[number]['category'], string> = {
    procurement: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/70',
    risk: 'bg-rose-500/10 text-rose-700 border-rose-200/70',
    financial: 'bg-sky-500/10 text-sky-700 border-sky-200/70',
    compliance: 'bg-amber-500/10 text-amber-700 border-amber-200/70',
    workflow: 'bg-indigo-500/10 text-indigo-700 border-indigo-200/70',
    analytics: 'bg-violet-500/10 text-violet-700 border-violet-200/70',
};

function createInitialRuntimeState(): Record<AgentName, AgentRuntimeState> {
    return Object.fromEntries(
        AGENT_REGISTRY.map((agent) => [
            agent.name,
            { status: agent.dispatchMode === 'workspace' ? 'workspace' : 'idle' },
        ]),
    ) as Record<AgentName, AgentRuntimeState>;
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMoney(amount: number) {
    return `Rs ${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatClock(timestamp?: string) {
    if (!timestamp) return 'Ready';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(timestamp?: string) {
    if (!timestamp) return 'No recent run';
    const delta = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'moments ago';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function CommandCenter() {
    const [runtime, setRuntime] = useState<Record<AgentName, AgentRuntimeState>>(() => createInitialRuntimeState());
    const [snapshot, setSnapshot] = useState<AgentDashboardSnapshot>(EMPTY_SNAPSHOT);
    const [searchValue, setSearchValue] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'attention' | typeof AGENT_REGISTRY[number]['category']>('all');
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [runningAgent, setRunningAgent] = useState<AgentName | null>(null);
    const [runningBundle, setRunningBundle] = useState<AgentBundleName | null>(null);
    const [progressLogs, setProgressLogs] = useState<string[]>([]);
    const [missionReport, setMissionReport] = useState<MissionReport | null>(null);

    const refreshRequestRef = useRef(0);
    const runRequestRef = useRef(0);

    const appendLog = (message: string) => {
        setProgressLogs((previous) => [...previous.slice(-4), message]);
    };

    const refreshSnapshot = async (silent = false) => {
        const requestId = ++refreshRequestRef.current;
        if (!silent) {
            setIsRefreshing(true);
        }

        try {
            const nextSnapshot = await getAgentDashboardSnapshot();
            if (requestId !== refreshRequestRef.current) {
                return;
            }

            setSnapshot(nextSnapshot);
        } catch (error) {
            if (requestId !== refreshRequestRef.current) {
                return;
            }

            toast.error('Dashboard sync failed', {
                description: error instanceof Error ? error.message : 'Snapshot refresh failed.',
            });
        } finally {
            if (requestId === refreshRequestRef.current) {
                setIsBootstrapping(false);
                setIsRefreshing(false);
            }
        }
    };

    useEffect(() => {
        void refreshSnapshot();

        return () => {
            refreshRequestRef.current += 1;
            runRequestRef.current += 1;
        };
    }, []);

    const backlogAttentionCount =
        snapshot.criticalFraudAlerts +
        snapshot.replenishmentAlerts +
        (snapshot.pendingPaymentOpportunities > 0 ? 1 : 0);
    const failedAgents = AGENT_REGISTRY.filter((agent) => runtime[agent.name]?.status === 'failed');
    const stableAgents = AGENT_REGISTRY.filter((agent) => runtime[agent.name]?.status === 'success');
    const attentionCount = failedAgents.length + snapshot.degradedPanels.length + backlogAttentionCount;
    const categoryFilters = ['all', 'attention', ...Array.from(new Set(AGENT_REGISTRY.map((agent) => agent.category)))] as Array<'all' | 'attention' | typeof AGENT_REGISTRY[number]['category']>;

    const filteredAgents = AGENT_REGISTRY.filter((agent) => {
        const matchesSearch = [agent.displayName, agent.description, agent.focusLabel, agent.category]
            .join(' ')
            .toLowerCase()
            .includes(searchValue.trim().toLowerCase());

        if (!matchesSearch) {
            return false;
        }

        if (activeFilter === 'all') {
            return true;
        }

        if (activeFilter === 'attention') {
            return runtime[agent.name]?.status === 'failed'
                || (agent.name === 'fraud-detection' && snapshot.criticalFraudAlerts > 0)
                || (agent.name === 'payment-optimizer' && snapshot.pendingPaymentOpportunities > 0)
                || (agent.name === 'demand-forecasting' && snapshot.replenishmentAlerts > 0);
        }

        return agent.category === activeFilter;
    });

    const runAgent = async (agentName: AgentName) => {
        const agent = AGENT_REGISTRY.find((entry) => entry.name === agentName);
        if (!agent || agent.dispatchMode === 'workspace' || runningAgent || runningBundle) {
            return;
        }

        const requestId = ++runRequestRef.current;
        const stages = RUN_STAGES[agentName] ?? [
            `Preparing ${agent.displayName}.`,
            `Running guarded ${agent.focusLabel.toLowerCase()} checks.`,
            `Finalizing the response package.`,
        ];

        setRunningAgent(agentName);
        setMissionReport(null);
        setProgressLogs([]);
        setRuntime((previous) => ({
            ...previous,
            [agentName]: {
                ...previous[agentName],
                status: 'running',
                message: 'Execution in progress.',
            },
        }));

        appendLog(`${agent.displayName} accepted by the dispatcher.`);
        for (const stage of stages) {
            if (requestId !== runRequestRef.current) {
                return;
            }
            await delay(180);
            appendLog(stage);
        }

        try {
            const result = await triggerAgentDispatch(agentName);
            if (requestId !== runRequestRef.current) {
                return;
            }

            const finishedAt = new Date().toISOString();
            setRuntime((previous) => ({
                ...previous,
                [agentName]: {
                    status: result.success ? 'success' : 'failed',
                    lastRunAt: finishedAt,
                    message: result.success ? result.summary.headline : result.error ?? result.summary.details,
                    attempts: result.attempts,
                    summary: result.summary,
                },
            }));

            setMissionReport({
                title: agent.displayName,
                summary: result.summary,
                timestamp: finishedAt,
                success: result.success,
            });

            if (result.success) {
                toast.success(`${agent.displayName} completed`, {
                    description: result.summary.details,
                });
            } else {
                toast.error(`${agent.displayName} needs attention`, {
                    description: result.summary.details,
                });
            }

            await refreshSnapshot(true);
        } catch (error) {
            if (requestId !== runRequestRef.current) {
                return;
            }

            const finishedAt = new Date().toISOString();
            setRuntime((previous) => ({
                ...previous,
                [agentName]: {
                    ...previous[agentName],
                    status: 'failed',
                    lastRunAt: finishedAt,
                    message: error instanceof Error ? error.message : 'Unexpected execution failure.',
                },
            }));

            toast.error(`${agent.displayName} failed`, {
                description: error instanceof Error ? error.message : 'Unexpected execution failure.',
            });
        } finally {
            if (requestId === runRequestRef.current) {
                setRunningAgent(null);
            }
        }
    };

    const runBundle = async (bundleName: AgentBundleName) => {
        if (runningAgent || runningBundle) {
            return;
        }

        const requestId = ++runRequestRef.current;
        const bundleMeta = AGENT_BUNDLE_META[bundleName];
        const bundleAgents = AGENT_BUNDLES[bundleName];

        setRunningBundle(bundleName);
        setMissionReport(null);
        setProgressLogs([
            `${bundleMeta.displayName} initialized.`,
            `${bundleAgents.length} coordinated agents are being staged.`,
        ]);

        setRuntime((previous) => {
            const nextState = { ...previous };
            for (const agent of bundleAgents) {
                nextState[agent] = {
                    ...nextState[agent],
                    status: 'running',
                    message: `Included in ${bundleMeta.displayName}.`,
                };
            }
            return nextState;
        });

        try {
            const result = await triggerAgentBundle(bundleName);
            if (requestId !== runRequestRef.current) {
                return;
            }

            const finishedAt = new Date().toISOString();
            setRuntime((previous) => {
                const nextState = { ...previous };
                for (const entry of result.results) {
                    nextState[entry.agent] = {
                        status: entry.success ? 'success' : 'failed',
                        lastRunAt: finishedAt,
                        attempts: entry.attempts,
                        message: entry.success ? entry.summary.headline : entry.error ?? entry.summary.details,
                        summary: entry.summary,
                    };
                }
                return nextState;
            });

            const summary: AgentDispatchSummary = {
                headline: `${result.succeeded}/${result.total} agents completed`,
                details: result.failed === 0
                    ? (() => {
                        const carriedAlerts = result.results.reduce((sum, entry) => sum + (entry.summary.alertsFound ?? 0), 0);
                        return carriedAlerts > 0
                            ? `${result.displayName} completed, but ${carriedAlerts} active risk or backlog signals still need review in the linked routes.`
                            : `${result.displayName} finished cleanly and the fleet is in a stronger operating state.`;
                    })()
                    : `${result.failed} agents still need manual attention after ${result.displayName}. Review the linked route to continue safely.`,
                actionsCount: result.succeeded,
                alertsFound: result.failed || undefined,
                link: result.dashboardHref,
            };

            setMissionReport({
                title: result.displayName,
                summary,
                timestamp: finishedAt,
                success: result.success,
            });

            if (result.success) {
                toast.success(`${result.displayName} finished`, {
                    description: summary.details,
                });
            } else {
                toast.error(`${result.displayName} completed with gaps`, {
                    description: summary.details,
                });
            }

            appendLog(`${result.displayName} processed ${result.total} coordinated agents.`);
            await refreshSnapshot(true);
        } catch (error) {
            if (requestId !== runRequestRef.current) {
                return;
            }

            toast.error('Bundle execution failed', {
                description: error instanceof Error ? error.message : 'Unexpected bundle execution failure.',
            });
        } finally {
            if (requestId === runRequestRef.current) {
                setRunningBundle(null);
            }
        }
    };

    if (isBootstrapping) {
        return (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-48 animate-pulse rounded-3xl bg-slate-100" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_36%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#ecfeff_100%)] shadow-xl">
                <CardContent className="p-6 lg:p-8">
                    <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                                    Resilient AI Mission Control
                                </Badge>
                                <Badge variant="outline" className="border-slate-200 bg-white/80 text-slate-600">
                                    {AGENT_REGISTRY.filter((agent) => agent.dispatchMode === 'global').length} direct-launch agents
                                </Badge>
                                <Badge variant="outline" className={cn(
                                    attentionCount === 0
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-amber-200 bg-amber-50 text-amber-700',
                                )}>
                                    {attentionCount === 0
                                        ? 'All routes stable'
                                        : snapshot.criticalFraudAlerts > 0
                                            ? `${snapshot.criticalFraudAlerts} critical fraud alerts open`
                                            : `${attentionCount} items need attention`}
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <AxiomLogo className="h-8 w-8 text-emerald-600" />
                                    <div>
                                        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                            Stronger agents, cleaner routes, better recovery.
                                        </h2>
                                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                            Every launch now flows through the same guarded dispatcher with retries, timeout fencing, workspace handoffs, and drill-down routes that stay coherent under stress.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Stable Agents</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{stableAgents.length}</p>
                                    <p className="mt-1 text-xs text-slate-500">Recovered and ready for another run.</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Risk Backlog</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{backlogAttentionCount}</p>
                                    <p className="mt-1 text-xs text-slate-500">Open critical risk, inventory, and payment follow-up signals.</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Last Snapshot</p>
                                    <p className="mt-2 text-2xl font-black text-slate-950">
                                        {snapshot.generatedAt ? formatClock(snapshot.generatedAt) : 'Waiting'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">Live operational status captured from guarded server actions.</p>
                                </div>
                            </div>

                            {(runningAgent || runningBundle) && (
                                <div className="rounded-3xl border border-slate-900 bg-slate-950 p-5 text-white shadow-2xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <AxiomLogo className="h-4 w-4 text-emerald-400" />
                                                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                                                    {runningAgent ? 'Single agent execution' : 'Coordinated bundle execution'}
                                                </p>
                                            </div>
                                            <h3 className="text-lg font-bold text-white">
                                                {runningAgent
                                                    ? AGENT_REGISTRY.find((agent) => agent.name === runningAgent)?.displayName
                                                    : AGENT_BUNDLE_META[runningBundle!].displayName}
                                            </h3>
                                            <div className="space-y-1 font-mono text-[11px] text-slate-300">
                                                {progressLogs.map((log, index) => (
                                                    <p key={index} className={index === progressLogs.length - 1 ? 'text-emerald-300' : ''}>
                                                        {log}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3">
                            {BUNDLE_ORDER.map((bundleName) => {
                                const bundleMeta = AGENT_BUNDLE_META[bundleName];
                                const isBundleRunning = runningBundle === bundleName;
                                return (
                                    <Card
                                        key={bundleName}
                                        className={cn(
                                            "overflow-hidden border-slate-200/70 bg-white/80 shadow-sm transition-all",
                                            isBundleRunning && "border-emerald-300 shadow-lg ring-2 ring-emerald-200",
                                        )}
                                    >
                                        <CardContent className="p-5">
                                            <div className={cn("mb-4 rounded-2xl bg-gradient-to-r p-3", bundleMeta.accentClass)}>
                                                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-700">
                                                    {bundleMeta.displayName}
                                                </p>
                                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                                    {bundleMeta.description}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>{AGENT_BUNDLES[bundleName].length} linked agents</span>
                                                <span>{bundleMeta.dashboardHref}</span>
                                            </div>
                                            <div className="mt-4 flex gap-2">
                                                <Button
                                                    className="flex-1 gap-2"
                                                    onClick={() => runBundle(bundleName)}
                                                    disabled={Boolean(runningAgent || runningBundle)}
                                                >
                                                    {isBundleRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                                    {isBundleRunning ? 'Running' : 'Run Bundle'}
                                                </Button>
                                                <Link href={bundleMeta.dashboardHref} className="flex-1">
                                                    <Button variant="outline" className="w-full gap-2">
                                                        <ArrowUpRight className="h-4 w-4" />
                                                        Open Route
                                                    </Button>
                                                </Link>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {snapshot.systemWarnings.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                            <TriangleAlert className="h-4 w-4" />
                            Recovery Watch
                        </CardTitle>
                        <CardDescription className="text-amber-800/80">
                            The dashboard stayed live, but one or more data surfaces fell back to a degraded snapshot instead of breaking the route.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-amber-900">
                        {snapshot.systemWarnings.map((warning) => (
                            <div key={warning} className="rounded-xl border border-amber-200/70 bg-white/70 p-3">
                                {warning}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Fraud Alerts</p>
                                <p className="mt-2 text-3xl font-black text-slate-950">{snapshot.fraudAlerts}</p>
                                <p className="mt-1 text-xs text-slate-500">{snapshot.criticalFraudAlerts} critical still open</p>
                            </div>
                            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-rose-600">
                                <Shield className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Payment Savings</p>
                                <p className="mt-2 text-3xl font-black text-emerald-600">{formatMoney(snapshot.paymentSavings)}</p>
                                <p className="mt-1 text-xs text-slate-500">{snapshot.pendingPaymentOpportunities} pending opportunities</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600">
                                <CreditCard className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Inventory Alerts</p>
                                <p className="mt-2 text-3xl font-black text-slate-950">{snapshot.replenishmentAlerts}</p>
                            </div>
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-600">
                                <Activity className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Route Shield</p>
                                <p className="mt-2 text-3xl font-black text-slate-950">
                                    {snapshot.degradedPanels.length === 0 ? 'Stable' : snapshot.degradedPanels.length}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {snapshot.degradedPanels.length === 0 ? 'No degraded panels in the current snapshot.' : 'Panels held in a degraded-safe mode instead of hard failing.'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-600">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <CardTitle className="text-lg">Interactive Fleet Controls</CardTitle>
                        <CardDescription>
                            Search the fleet, focus on a category, or launch the highest-value quick actions without leaving the command surface.
                        </CardDescription>
                    </div>
                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
                        <div className="relative min-w-[240px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Search agents, routes, and focus areas"
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => refreshSnapshot()}
                            disabled={isRefreshing}
                        >
                            <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                            Sync Snapshot
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                        {categoryFilters.map((filter) => (
                            <Button
                                key={filter}
                                size="sm"
                                variant={activeFilter === filter ? 'default' : 'outline'}
                                className="capitalize"
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter === 'attention' ? 'Needs attention' : filter}
                            </Button>
                        ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {QUICK_ACTION_AGENTS.map((agentName) => {
                            const agent = AGENT_REGISTRY.find((entry) => entry.name === agentName);
                            if (!agent) {
                                return null;
                            }

                            const isRunning = runningAgent === agent.name;

                            return (
                                <Button
                                    key={agent.name}
                                    variant="outline"
                                    className={cn(
                                        "h-auto items-start justify-between rounded-2xl border-slate-200 p-4 text-left",
                                        isRunning && "border-emerald-300 ring-2 ring-emerald-200",
                                    )}
                                    onClick={() => runAgent(agent.name)}
                                    disabled={Boolean(runningAgent || runningBundle)}
                                >
                                    <div className="space-y-1">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{agent.focusLabel}</p>
                                        <p className="text-sm font-bold text-slate-950">{agent.displayName}</p>
                                    </div>
                                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                </Button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {missionReport && (
                <Card className={cn(
                    "overflow-hidden border shadow-sm",
                    missionReport.success ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40",
                )}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg">{missionReport.title}</CardTitle>
                                <CardDescription>
                                    Finalized {formatRelative(missionReport.timestamp)} at {formatClock(missionReport.timestamp)}.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className={cn(
                                missionReport.success
                                    ? "border-emerald-200 bg-white text-emerald-700"
                                    : "border-amber-200 bg-white text-amber-700",
                            )}>
                                {missionReport.success ? 'Recovered cleanly' : 'Needs follow-up'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-4">
                            {missionReport.summary.alertsFound !== undefined && (
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Alerts</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{missionReport.summary.alertsFound}</p>
                                </div>
                            )}
                            {missionReport.summary.savingsAmount !== undefined && (
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Savings</p>
                                    <p className="mt-2 text-3xl font-black text-emerald-600">{formatMoney(missionReport.summary.savingsAmount)}</p>
                                </div>
                            )}
                            {missionReport.summary.actionsCount !== undefined && (
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Actions</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{missionReport.summary.actionsCount}</p>
                                </div>
                            )}
                            {missionReport.summary.itemsScanned !== undefined && (
                                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Audited</p>
                                    <p className="mt-2 text-3xl font-black text-slate-950">{missionReport.summary.itemsScanned}</p>
                                </div>
                            )}
                        </div>

                        <div className="rounded-3xl border border-white/70 bg-white/80 p-5">
                            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Mission Summary</p>
                            <p className="mt-3 text-lg font-semibold leading-8 text-slate-900">
                                {missionReport.summary.details}
                            </p>
                        </div>

                        {missionReport.summary.link && (
                            <div className="flex justify-end">
                                <Link href={missionReport.summary.link}>
                                    <Button className="gap-2">
                                        Open Drill-Down Route
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-900">Axiom Intelligent Fleet</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {filteredAgents.length} visible agents, {failedAgents.length} currently marked for follow-up.
                        </p>
                    </div>
                    <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-600">
                        Dispatcher-protected runs only
                    </Badge>
                </div>

                {filteredAgents.length === 0 ? (
                    <Card className="border-dashed border-slate-300 bg-slate-50/60">
                        <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
                            <Search className="h-8 w-8 text-slate-400" />
                            <div>
                                <p className="text-base font-semibold text-slate-900">No agents match this filter.</p>
                                <p className="text-sm text-slate-500">Try a broader search or switch back to all categories.</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredAgents.map((agent) => {
                            const bundleActive = runningBundle ? AGENT_BUNDLES[runningBundle].includes(agent.name) : false;
                            const isRunning = runningAgent === agent.name || bundleActive;
                            const status = runtime[agent.name];
                            const statusLabel =
                                status.status === 'workspace' ? 'Workspace' :
                                    status.status === 'failed' ? 'Needs attention' :
                                        status.status === 'success' ? 'Recovered' :
                                            status.status === 'running' ? 'Running' :
                                                'Ready';

                            return (
                                <Card
                                    key={agent.name}
                                    className={cn(
                                        "border-slate-200 bg-white shadow-sm transition-all",
                                        isRunning && "border-emerald-300 shadow-lg ring-2 ring-emerald-200",
                                        status.status === 'failed' && "border-amber-200 bg-amber-50/30",
                                    )}
                                >
                                    <CardHeader className="space-y-4 pb-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700",
                                                    isRunning && "border-emerald-200 bg-emerald-50 text-emerald-700",
                                                )}>
                                                    {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : agentIcons[agent.name]}
                                                </div>
                                            <div className="space-y-2">
                                                <CardTitle className="text-base">{agent.displayName}</CardTitle>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline" className={categoryTone[agent.category]}>
                                                        {agent.category}
                                                        </Badge>
                                                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                                                            {statusLabel}
                                                        </Badge>
                                                        {agent.dispatchMode === 'workspace' && (
                                                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                                                            Context route
                                                        </Badge>
                                                    )}
                                                    {agent.name === 'fraud-detection' && snapshot.criticalFraudAlerts > 0 && (
                                                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                                            {snapshot.criticalFraudAlerts} critical open
                                                        </Badge>
                                                    )}
                                                    {agent.name === 'payment-optimizer' && snapshot.pendingPaymentOpportunities > 0 && (
                                                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                                            {snapshot.pendingPaymentOpportunities} pending
                                                        </Badge>
                                                    )}
                                                    {agent.name === 'demand-forecasting' && snapshot.replenishmentAlerts > 0 && (
                                                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                                            {snapshot.replenishmentAlerts} inventory alerts
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            </div>
                                            <div className="text-right text-xs text-slate-500">
                                                <p>{formatClock(status.lastRunAt)}</p>
                                                <p>{formatRelative(status.lastRunAt)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{agent.focusLabel}</p>
                                            <p className="text-sm leading-6 text-slate-600">{agent.description}</p>
                                        </div>

                                        {status.summary && (
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">Latest signal</p>
                                                <p className="mt-2 text-sm font-semibold text-slate-900">{status.summary.headline}</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-600">{status.summary.details}</p>
                                            </div>
                                        )}
                                    </CardHeader>

                                    <CardContent className="space-y-4 pt-0">
                                        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
                                            <span>Retries configured: {agent.maxRetries}</span>
                                            <span>Attempts used: {status.attempts ?? 0}</span>
                                        </div>

                                        {status.message && (
                                            <div className={cn(
                                                "rounded-2xl border px-4 py-3 text-sm",
                                                status.status === 'failed'
                                                    ? "border-amber-200 bg-amber-50 text-amber-900"
                                                    : "border-slate-100 bg-slate-50/80 text-slate-600",
                                            )}>
                                                {status.message}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {agent.dispatchMode === 'workspace' ? (
                                                <Link href={agent.dashboardHref} className="flex-1">
                                                    <Button className="w-full gap-2">
                                                        Open Workspace
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            ) : (
                                                <Button
                                                    className="flex-1 gap-2"
                                                    onClick={() => runAgent(agent.name)}
                                                    disabled={Boolean(runningAgent || runningBundle)}
                                                >
                                                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <AxiomLogo className="h-4 w-4" />}
                                                    {isRunning ? 'Running' : 'Launch'}
                                                </Button>
                                            )}

                                            <Link href={agent.dashboardHref} className="flex-1">
                                                <Button variant="outline" className="w-full gap-2">
                                                    Route
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
