import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    CreditCard,
    ShieldAlert,
    ShieldCheck,
    Truck,
} from "lucide-react";

import { getExceptionQueue, getOperationalSignals, type OperationalExceptionItem } from "@/app/actions/operational-readiness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function severityBadgeClass(severity: OperationalExceptionItem["severity"]) {
    switch (severity) {
        case "critical":
            return "border-red-200 bg-red-50 text-red-700";
        case "high":
            return "border-amber-200 bg-amber-50 text-amber-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
}

function typeLabel(type: OperationalExceptionItem["type"]) {
    switch (type) {
        case "supplier_block":
            return "Release block";
        case "receipt_quarantine":
            return "Receipt quarantine";
        case "invoice_dispute":
            return "Invoice dispute";
        default:
            return "Finance hold";
    }
}

export default async function ExceptionManagementPage() {
    const [queue, signals] = await Promise.all([
        getExceptionQueue(),
        getOperationalSignals(),
    ]);

    return (
        <div className="flex min-h-full flex-col space-y-6 bg-muted/40 p-4 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Exception Management</h1>
                    <p className="mt-1 max-w-3xl text-muted-foreground">
                        Quarantine dirty operational records before they become payment errors, supplier failures, or silent data drift.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/admin/risk">
                        <Button variant="outline" className="gap-2">
                            <ShieldAlert className="h-4 w-4" />
                            Risk intelligence
                        </Button>
                    </Link>
                    <Link href="/sourcing/goods-receipts">
                        <Button variant="outline" className="gap-2">
                            <Truck className="h-4 w-4" />
                            Goods receipts
                        </Button>
                    </Link>
                    <Link href="/sourcing/invoices">
                        <Button className="gap-2">
                            <CreditCard className="h-4 w-4" />
                            Invoice records
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Open Exceptions</p>
                        <p className="text-3xl font-black text-red-600">{queue.total}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Dirty records waiting for human or policy resolution</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Release Blocks</p>
                        <p className="text-3xl font-black text-amber-600">{queue.blockedOrders}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Orders held before approval or dispatch</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Receipt Quarantine</p>
                        <p className="text-3xl font-black text-blue-600">{queue.receiptQuarantine}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Warehouse and QC issues still upstream of finance</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-slate-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Finance Holds</p>
                        <p className="text-3xl font-black text-slate-700">{queue.financeHolds}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Pending or disputed records still blocked from release</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-red-200 bg-[radial-gradient(circle_at_top_left,rgba(248,113,113,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.10),transparent_32%),linear-gradient(135deg,#ffffff_0%,#fff7ed_52%,#fff1f2_100%)] shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                        <ShieldCheck className="h-4 w-4 text-red-600" />
                        Prevention Rules Live
                    </CardTitle>
                    <CardDescription>
                        Orders do not rely on warning-only UI. Release, receiving, and finance now follow blocking rules.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Supplier release</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">Suppliers at risk 70+ stay blocked before approval or dispatch.</p>
                    </div>
                    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Warehouse quarantine</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">Failed or conditional receipts do not flow quietly into finance matching.</p>
                    </div>
                    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Deterministic finance</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">Payment release stays tied to PO, receipt, QC, and invoice math instead of AI-only judgment.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Quarantine Queue
                        </CardTitle>
                        <CardDescription>
                            Every item below explains what broke, why it is blocked, and which route clears it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {queue.items.length > 0 ? queue.items.map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "rounded-2xl border bg-background p-4 shadow-sm",
                                    item.severity === "critical" && "border-red-200 bg-red-50/20",
                                    item.severity === "high" && "border-amber-200 bg-amber-50/20",
                                )}
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className={severityBadgeClass(item.severity)}>
                                                {item.severity}
                                            </Badge>
                                            <Badge variant="outline" className="border-slate-200 bg-white/80 text-slate-600">
                                                {typeLabel(item.type)}
                                            </Badge>
                                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                                {item.ageLabel}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-foreground">{item.title}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                                        </div>
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Why it is blocked</p>
                                            <p className="mt-2 text-sm text-foreground">{item.reason}</p>
                                        </div>
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Next action</p>
                                            <p className="mt-2 text-sm text-foreground">{item.nextAction}</p>
                                        </div>
                                    </div>

                                    <div className="flex min-w-[180px] flex-col gap-2">
                                        <Link href={item.primaryHref}>
                                            <Button className="w-full justify-between">
                                                {item.primaryLabel}
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        {item.secondaryHref && item.secondaryLabel ? (
                                            <Link href={item.secondaryHref}>
                                                <Button variant="outline" className="w-full justify-between">
                                                    {item.secondaryLabel}
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed bg-background px-6 py-12 text-center">
                                <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500/40" />
                                <p className="mt-4 text-sm font-semibold text-foreground">No live exceptions right now.</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Release blocks, receipt quarantine, and finance holds are currently clear.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-black uppercase tracking-wide">Operational Truth</CardTitle>
                            <CardDescription>
                                Coverage claims stay tied to live evidence instead of blanket percentages.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Telemetry</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{signals?.telemetry.title || "Telemetry unavailable"}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{signals?.telemetry.detail || "No telemetry heartbeat is visible yet."}</p>
                            </div>
                            <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">FX book rates</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{signals?.fxRates.title || "FX status unavailable"}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{signals?.fxRates.detail || "Reporting-book refresh status is not available."}</p>
                            </div>
                            <div className="rounded-2xl border bg-muted/20 p-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Queue pressure</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{signals?.exceptions.title || "Queue unavailable"}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{signals?.exceptions.detail || "Exception pressure is not available."}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-black uppercase tracking-wide">Escalation Path</CardTitle>
                            <CardDescription>
                                Department escalations stay attached to live lead mappings from the workspace directory.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>Use the dashboard escalation panel when a blocked supplier, disputed invoice, or warehouse quarantine needs finance, procurement, or ops ownership fast.</p>
                            <Link href="/">
                                <Button variant="outline" className="w-full justify-between">
                                    Open dashboard channels
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
