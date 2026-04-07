'use client';

import { useEffect, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Waypoints } from 'lucide-react';

import { getEnterpriseReadinessDashboard } from '@/app/actions/enterprise-readiness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { type EnterpriseDashboardSnapshot } from '@/lib/enterprise-readiness';

function panelBadgeVariant(label: EnterpriseDashboardSnapshot['overallLabel']) {
    if (label === 'strong') return 'default';
    if (label === 'good') return 'secondary';
    return 'outline';
}

function MetricCard({
    title,
    value,
    subtitle,
    progress,
}: {
    title: string;
    value: string;
    subtitle: string;
    progress: number;
}) {
    return (
        <div className="rounded-xl border bg-background/70 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
            <Progress value={progress} className="mt-3 h-2" />
            <div className="mt-2 text-xs text-muted-foreground">{subtitle}</div>
        </div>
    );
}

export function EnterpriseReadinessPanel() {
    const [snapshot, setSnapshot] = useState<EnterpriseDashboardSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const loadSnapshot = async () => {
        try {
            const next = await getEnterpriseReadinessDashboard();
            setSnapshot(next);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSnapshot();
    }, []);

    const handleRefresh = () => {
        startTransition(async () => {
            await loadSnapshot();
        });
    };

    if (loading && !snapshot) {
        return (
            <Card>
                <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading enterprise readiness...
                </CardContent>
            </Card>
        );
    }

    if (!snapshot) return null;

    return (
        <Card className="border-primary/20">
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Enterprise Readiness
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Supplier network quality, integration health, governance coverage, and proof of operational reliability.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={panelBadgeVariant(snapshot.overallLabel)} className="uppercase">
                            {snapshot.overallLabel}
                        </Badge>
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh Audit
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-4">
                    <MetricCard
                        title="Overall"
                        value={`${snapshot.overallScore}%`}
                        subtitle={`${snapshot.supplierNetwork.totalSuppliers} suppliers tracked`}
                        progress={snapshot.overallScore}
                    />
                    <MetricCard
                        title="Supplier Network"
                        value={`${snapshot.supplierNetwork.averageReadiness}%`}
                        subtitle={`${snapshot.supplierNetwork.readyForApproval} onboarding suppliers are ready for approval`}
                        progress={snapshot.supplierNetwork.averageReadiness}
                    />
                    <MetricCard
                        title="Integrations"
                        value={`${snapshot.integrations.score}%`}
                        subtitle={`${snapshot.integrations.activeWebhooks} active endpoints | ${snapshot.integrations.activeSourceSystems} source systems`}
                        progress={snapshot.integrations.score}
                    />
                    <MetricCard
                        title="Governance"
                        value={`${snapshot.governance.score}%`}
                        subtitle={`${snapshot.governance.activePolicies} approval policies | ${snapshot.governance.activeTolerances} tolerances`}
                        progress={snapshot.governance.score}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                    <div className="rounded-xl border p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Waypoints className="h-4 w-4 text-primary" />
                            Reliability Proof
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Data Confidence</div>
                                <div className="mt-2 text-2xl font-bold">{snapshot.supplierNetwork.averageConfidence}%</div>
                                <div className="text-xs text-muted-foreground">average supplier intelligence confidence</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Webhook Reliability</div>
                                <div className="mt-2 text-2xl font-bold">{snapshot.reliability.metrics.webhookSuccessRate}%</div>
                                <div className="text-xs text-muted-foreground">{snapshot.reliability.recentDeliveries} recent deliveries observed</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Import Reliability</div>
                                <div className="mt-2 text-2xl font-bold">{snapshot.reliability.metrics.importSuccessRate}%</div>
                                <div className="text-xs text-muted-foreground">{snapshot.reliability.recentImportJobs} recent import job(s)</div>
                            </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                                Compliance evidence coverage: <span className="font-semibold text-foreground">{snapshot.compliance.evidenceCoverage}%</span>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                                Expired or overdue obligations: <span className="font-semibold text-foreground">{snapshot.compliance.expiredOrOverdue}</span>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                                Overdue supplier requests: <span className="font-semibold text-foreground">{snapshot.compliance.overdueRequests}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Priority Actions
                        </div>
                        <div className="mt-4 space-y-3">
                            {snapshot.priorityActions.length > 0 ? snapshot.priorityActions.map((action) => (
                                <div key={action} className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                                    {action}
                                </div>
                            )) : (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                                    <span className="inline-flex items-center gap-2 font-medium">
                                        <CheckCircle2 className="h-4 w-4" />
                                        No priority gaps were detected in the latest audit.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {snapshot.supplierNetwork.attentionSuppliers.length > 0 && (
                    <div className="rounded-xl border p-4">
                        <div className="text-sm font-semibold">Suppliers Needing Attention</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {snapshot.supplierNetwork.attentionSuppliers.map((supplier) => (
                                <div key={supplier.supplierId} className="rounded-lg border bg-muted/20 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold">{supplier.supplierName}</div>
                                        <Badge variant="outline">R {supplier.readinessScore}%</Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">Confidence {supplier.confidenceScore}%</div>
                                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                        {supplier.blockers.map((blocker) => (
                                            <p key={blocker}>{blocker}</p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
