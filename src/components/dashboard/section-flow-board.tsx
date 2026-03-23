import Link from "next/link";
import { ArrowRight, CheckCircle2, Cloud, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buildSectionFlowPlan } from "@/lib/section-flow";

const statusStyles = {
    complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
    current: "bg-amber-50 text-amber-700 border-amber-200",
    pending: "bg-muted text-muted-foreground border-border",
} as const;

const statusLabels = {
    complete: "Done",
    current: "Next up",
    pending: "Queued",
} as const;

export function SectionFlowBoard() {
    const plan = buildSectionFlowPlan();

    return (
        <Card className="shadow-lg border-primary/10 overflow-hidden">
            <CardHeader className="border-b bg-muted/20 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Section flow tracker
                        </CardTitle>
                        <CardDescription>
                            Validate one section at a time, mark the working section done, and keep the next area in focus for Microsoft Store and Azure hosting readiness.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1">
                            <Store className="h-3.5 w-3.5" />
                            Microsoft Store target
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1">
                            <Cloud className="h-3.5 w-3.5" />
                            Azure database target
                        </span>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">
                                {plan.completedCount} of {plan.totalCount} sections completed
                            </span>
                            <span className="text-muted-foreground">{plan.percentComplete}%</span>
                        </div>
                        <Progress value={plan.percentComplete} aria-label="Section flow progress" />
                    </div>

                    <div className="rounded-xl border bg-background px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                            Current focus
                        </p>
                        <p className="mt-1 text-base font-bold text-foreground">
                            {plan.currentSection?.label ?? "All sections validated"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {plan.currentSection?.summary ?? "Deployment checklist is ready for final packaging and cloud cutover."}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {plan.sections.map((section, index) => (
                        <Link
                            key={section.key}
                            href={section.href}
                            className="group rounded-xl border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-md"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                        Step {index + 1}
                                    </p>
                                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                                        {section.label}
                                    </h3>
                                </div>
                                <Badge variant="outline" className={statusStyles[section.status]}>
                                    {statusLabels[section.status]}
                                </Badge>
                            </div>

                            <p className="mt-3 text-sm text-muted-foreground leading-6">
                                {section.summary}
                            </p>

                            <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                                Open section
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
