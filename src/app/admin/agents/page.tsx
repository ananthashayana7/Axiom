/**
 * Admin AI Agents Page
 * Full dashboard for managing and monitoring all AI agents
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Activity, Shield, ShieldCheck, CreditCard, FileText,
    TrendingUp, Zap, BarChart3,
    ArrowUpRight, Sparkles, Clock3, Lock
} from "lucide-react";
import Link from "next/link";
import { CommandCenter } from "@/components/dashboard/command-center";
import { AGENT_REGISTRY } from "@/app/actions/agents/registry";
import { AutonomousTrace } from "@/components/admin/autonomous-trace";
import { RunAgentButton } from "@/components/admin/run-agent-button";

export const dynamic = 'force-dynamic';

const categoryIcons: Record<string, React.ReactNode> = {
    procurement: <TrendingUp className="h-4 w-4" />,
    risk: <Shield className="h-4 w-4" />,
    financial: <CreditCard className="h-4 w-4" />,
    compliance: <FileText className="h-4 w-4" />,
    workflow: <Zap className="h-4 w-4" />,
    analytics: <BarChart3 className="h-4 w-4" />
};

const categoryColors: Record<string, string> = {
    procurement: 'bg-blue-500/10 text-blue-600 border-blue-200',
    risk: 'bg-red-500/10 text-red-600 border-red-200',
    financial: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    compliance: 'bg-amber-500/10 text-amber-600 border-amber-200',
    workflow: 'bg-violet-500/10 text-violet-600 border-violet-200',
    analytics: 'bg-cyan-500/10 text-cyan-600 border-cyan-200'
};

interface AdminAgentsPageProps {
    searchParams?: Promise<{ demo?: string }>;
}

export default async function AdminAgentsPage({ searchParams }: AdminAgentsPageProps) {
    const resolvedSearchParams = await searchParams;
    const allowDemo = process.env.NODE_ENV !== 'production' && resolvedSearchParams?.demo === 'true';
    const session = await auth();

    if (!allowDemo && (!session?.user || (session.user as { role: string }).role !== 'admin')) {
        redirect('/');
    }

    const visibleAgents = allowDemo ? AGENT_REGISTRY : AGENT_REGISTRY.filter(agent => agent.isEnabled);

    // Group agents by category
    const agentsByCategory = new Map<string, typeof AGENT_REGISTRY[number][]>();
    for (const agent of visibleAgents) {
        const category = agent.category;
        if (!agentsByCategory.has(category)) {
            agentsByCategory.set(category, []);
        }
        agentsByCategory.get(category)!.push(agent);
    }

    return (
        <div className="p-4 lg:p-10 space-y-8 bg-background min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                        AI Agent Fleet
                    </h1>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">
                        Autonomous Procurement Intelligence
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-8 px-3 bg-violet-50 text-violet-600 border-violet-200">
                        <Activity className="h-3 w-3 mr-1 animate-pulse" />
                        {visibleAgents.filter(a => a.isEnabled).length} Active Agents
                    </Badge>
                </div>
            </div>

            {/* Guardrail summary */}
            <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <ShieldCheck className="h-4 w-4" />
                            <CardTitle className="text-base">Validation Shield</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Inputs are schema-validated and rejected safely before agents run.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card className="border-indigo-200 bg-indigo-50/50">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-indigo-700">
                            <Lock className="h-4 w-4" />
                            <CardTitle className="text-base">Approval Gate</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Sensitive agents enforce admin-only execution with telemetry-backed blocks.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-amber-700">
                            <Clock3 className="h-4 w-4" />
                            <CardTitle className="text-base">Resilience Controls</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Retries, timeouts, and guarded chaining keep executions stable under stress.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {/* Command Center */}
            {allowDemo ? (
                <Card className="border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-indigo-500" />
                            Demo Mode Preview
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Live telemetry is disabled in demo mode. Sign in as an admin to stream execution traces.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <CommandCenter />
            )}

            {/* Live Trace */}
            {!allowDemo && <AutonomousTrace />}

            {/* Agent Catalog */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold">Agent Catalog</h2>
                {Array.from(agentsByCategory.entries()).map(([category, agents]) => (
                    <div key={category}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${categoryColors[category] || 'bg-stone-100'}`}>
                                {categoryIcons[category] || <Sparkles className="h-4 w-4" />}
                            </div>
                            <h3 className="text-lg font-semibold capitalize">{category}</h3>
                            <Badge variant="secondary" className="text-xs">
                                {agents.length} agents
                            </Badge>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {agents.map((agent) => (
                                <Card key={agent.name} className="hover:shadow-md transition-all">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    {agent.displayName}
                                                </CardTitle>
                                                <CardDescription className="text-xs mt-1">
                                                    {agent.description}
                                                </CardDescription>
                                            </div>
                                            <Badge
                                                variant={agent.isEnabled ? "default" : "secondary"}
                                                className={agent.isEnabled ? "bg-emerald-500" : ""}
                                            >
                                                {agent.isEnabled ? "Active" : "Disabled"}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex flex-wrap gap-1">
                                            {agent.triggers.map((trigger) => (
                                                <Badge key={trigger} variant="outline" className="text-[10px]">
                                                    {trigger}
                                                </Badge>
                                            ))}
                                            {agent.requiresApproval && (
                                                <Badge variant="outline" className="text-[10px] border-rose-200 text-rose-600">
                                                    Approval required
                                                </Badge>
                                            )}
                                            {agent.dispatchMode === 'workspace' && (
                                                <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600">
                                                    Workspace guided
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t text-xs text-stone-500">
                                            <span>v{agent.version}</span>
                                            <span>Retries: {agent.maxRetries}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <RunAgentButton
                                                agentName={agent.name}
                                                requiresApproval={agent.requiresApproval}
                                                isEnabled={agent.isEnabled}
                                                dispatchMode={agent.dispatchMode}
                                                dashboardHref={agent.dashboardHref}
                                            />
                                            <Link href={agent.dashboardHref} className="flex-1">
                                                <Button size="sm" variant="outline" className="w-full gap-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                                    <ArrowUpRight className="h-3 w-3" />
                                                    {agent.dispatchMode === 'workspace' ? 'Workspace' : 'Dashboard'}
                                                </Button>
                                            </Link>
                                        </div>
                                        <div className="flex flex-wrap gap-1 text-[11px] text-slate-600">
                                            <Badge variant="outline" className="text-[10px]">
                                                Timeout: {Math.floor(agent.timeoutMs / 1000)}s
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px]">
                                                Guarded Input Mapping
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {agent.focusLabel}
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
