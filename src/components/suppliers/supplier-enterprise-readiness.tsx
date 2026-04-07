import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { type SupplierEnterpriseSnapshot } from "@/lib/enterprise-readiness";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SeedOnboardingPackButton } from "@/components/suppliers/seed-onboarding-pack-button";

function badgeVariant(label: SupplierEnterpriseSnapshot["readiness"]["label"]) {
    if (label === 'strong') return 'default';
    if (label === 'good') return 'secondary';
    return 'outline';
}

export function SupplierEnterpriseReadiness({
    supplierId,
    snapshot,
    isAdmin,
}: {
    supplierId: string;
    snapshot: SupplierEnterpriseSnapshot;
    isAdmin: boolean;
}) {
    const blockerPreview = snapshot.readiness.blockers.slice(0, 3);
    const strengthPreview = snapshot.readiness.strengths.slice(0, 3);

    return (
        <Card className="border-primary/20">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Enterprise Readiness
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                            Approval readiness, data confidence, and onboarding control coverage.
                        </CardDescription>
                    </div>
                    <Badge variant={badgeVariant(snapshot.readiness.label)} className="uppercase">
                        {snapshot.readiness.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Onboarding Readiness</span>
                            <span>{snapshot.readiness.score}%</span>
                        </div>
                        <Progress value={snapshot.readiness.score} className="mt-3 h-2" />
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            Approval threshold: {snapshot.readiness.approvalThreshold}% with no overdue or escalated blockers.
                        </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Data Confidence</span>
                            <span>{snapshot.confidence.score}%</span>
                        </div>
                        <Progress value={snapshot.confidence.score} className="mt-3 h-2" />
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            Completeness {snapshot.confidence.coverage.completeness}% | Evidence {snapshot.confidence.coverage.evidence}% | Freshness {snapshot.confidence.coverage.freshness}%
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Open Requests</div>
                        <div className="mt-2 text-2xl font-bold">{snapshot.metrics.openRequests}</div>
                        <div className="text-[11px] text-muted-foreground">{snapshot.metrics.overdueRequests} overdue</div>
                    </div>
                    <div className="rounded-lg border p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compliance</div>
                        <div className="mt-2 text-2xl font-bold">{snapshot.metrics.complianceWithEvidence}/{snapshot.metrics.complianceTotal}</div>
                        <div className="text-[11px] text-muted-foreground">evidence-backed obligations</div>
                    </div>
                    <div className="rounded-lg border p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workflow Tasks</div>
                        <div className="mt-2 text-2xl font-bold">{snapshot.metrics.openTasks}</div>
                        <div className="text-[11px] text-muted-foreground">{snapshot.metrics.escalatedTasks} escalated</div>
                    </div>
                    <div className="rounded-lg border p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</div>
                        <div className="mt-2 text-2xl font-bold">{snapshot.metrics.documentCount}</div>
                        <div className="text-[11px] text-muted-foreground">{snapshot.metrics.activeActionPlans} active action plan(s)</div>
                    </div>
                </div>

                {blockerPreview.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <AlertTriangle className="h-4 w-4" />
                            Current Blockers
                        </div>
                        <div className="mt-2 space-y-1 text-xs">
                            {blockerPreview.map((blocker) => (
                                <p key={blocker}>{blocker}</p>
                            ))}
                        </div>
                    </div>
                )}

                {strengthPreview.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="h-4 w-4" />
                            Existing Strengths
                        </div>
                        <div className="mt-2 space-y-1 text-xs">
                            {strengthPreview.map((strength) => (
                                <p key={strength}>{strength}</p>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs text-muted-foreground">
                        {snapshot.readiness.canApprove
                            ? (
                                <span className="inline-flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Supplier meets the current onboarding approval threshold.
                                </span>
                            )
                            : 'Resolve the blockers above before moving this supplier to active.'}
                    </div>
                    {isAdmin && <SeedOnboardingPackButton supplierId={supplierId} />}
                </div>
            </CardContent>
        </Card>
    );
}
