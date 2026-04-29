'use client';

import { type ReactNode, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, Factory, Leaf, Loader2, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";

import { getPartQuickView } from "@/app/actions/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils/currency";

type PartQuickViewData = Awaited<ReturnType<typeof getPartQuickView>>;

const RISK_BADGE_STYLES: Record<string, string> = {
    watch: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
    elevated: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    high: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export function PartQuickViewDrawer({
    partId,
    open,
    onOpenChange,
    onOpenSupplier,
}: {
    partId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenSupplier?: (supplierId: string) => void;
}) {
    const [data, setData] = useState<PartQuickViewData>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !partId) {
            return;
        }

        let cancelled = false;
        setData(null);
        setLoading(true);

        void (async () => {
            const result = await getPartQuickView(partId);
            if (!cancelled) {
                setData(result);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, partId]);

    const part = data?.part;
    const quickView = data;
    const shouldCost = data?.shouldCost;
    const savingsGap = shouldCost?.savingsOpportunity || 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-hidden">
                <SheetHeader>
                    <div className="space-y-2 pr-8">
                        <SheetTitle>{part?.name || "Part quick view"}</SheetTitle>
                        <SheetDescription>
                            Live stock health, related supplier exposure, should-cost opportunity, and carbon estimate without breaking your inventory flow.
                        </SheetDescription>
                    </div>
                </SheetHeader>

                <div className="show-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-6">
                    {loading && (
                        <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading part intelligence...
                        </div>
                    )}

                    {!loading && !part && (
                        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                            Part intelligence could not be loaded for this item.
                        </div>
                    )}

                    {!loading && part && quickView && (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="font-mono">{part.sku}</Badge>
                                <Badge variant="secondary">{part.category}</Badge>
                                <Badge className={RISK_BADGE_STYLES[quickView.adaptiveReorder.riskLevel]}>
                                    {quickView.adaptiveReorder.riskLevel} supply pressure
                                </Badge>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <MetricCard
                                    label="Stock on Hand"
                                    value={`${part.stockLevel}`}
                                    hint={`Min ${part.minStockLevel || 20}`}
                                    icon={<Boxes className="h-4 w-4 text-primary" />}
                                />
                                <MetricCard
                                    label="Adaptive ROP"
                                    value={`${quickView.adaptiveReorder.adjustedReorderPoint}`}
                                    hint={`Base ${quickView.adaptiveReorder.baseReorderPoint}`}
                                    icon={<ShieldAlert className="h-4 w-4 text-amber-600" />}
                                />
                                <MetricCard
                                    label="Current Price"
                                    value={formatCurrency(part.price)}
                                    hint={shouldCost ? `Should-cost ${formatCurrency(shouldCost.shouldCost)}` : "No should-cost baseline yet"}
                                    icon={<Factory className="h-4 w-4 text-primary" />}
                                />
                                <MetricCard
                                    label="Carbon-Adjusted"
                                    value={formatCurrency(quickView.carbonEstimate.carbonAdjustedPrice)}
                                    hint={`${quickView.carbonEstimate.totalKgCo2e.toFixed(1)} kgCO2e per SKU`}
                                    icon={<Leaf className="h-4 w-4 text-emerald-600" />}
                                />
                            </div>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <AlertTriangle className="h-4 w-4 text-primary" />
                                    Predictive reorder logic
                                </div>
                                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                                    <div className="space-y-3">
                                        {quickView.adaptiveReorder.reasons.map((reason) => (
                                            <div key={reason} className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                                                {reason}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-2xl border bg-background p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Planner view</p>
                                        <div className="mt-4 space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span>Open orders</span>
                                                <span className="font-semibold">{quickView.linkedCounts.openOrderCount || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Delayed shipments</span>
                                                <span className="font-semibold">{quickView.linkedCounts.delayedOrderCount || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>30-day forecast</span>
                                                <span className="font-semibold">{quickView.forecastDemand || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Recommended qty</span>
                                                <span className="font-semibold">{quickView.adaptiveReorder.recommendedQty}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    {savingsGap >= 0 ? (
                                        <TrendingDown className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <TrendingUp className="h-4 w-4 text-red-600" />
                                    )}
                                    Cost and carbon view
                                </div>
                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-2xl border bg-background p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Should-cost snapshot</p>
                                        {shouldCost ? (
                                            <div className="mt-3 space-y-3 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span>Benchmark source</span>
                                                    <span className="max-w-[55%] text-right text-muted-foreground">{shouldCost.benchmarkSource || "Historical intelligence"}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Savings opportunity</span>
                                                    <span className={savingsGap > 0 ? 'font-semibold text-emerald-600' : 'font-semibold'}>
                                                        {formatCurrency(Math.abs(savingsGap))}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Quote coverage</span>
                                                    <span className="font-semibold">{shouldCost.quoteCount} quote signal{shouldCost.quoteCount === 1 ? '' : 's'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                No benchmark coverage is available yet for this part.
                                            </p>
                                        )}
                                    </div>
                                    <div className="rounded-2xl border bg-background p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Product carbon footprint</p>
                                        <div className="mt-3 space-y-3 text-sm">
                                            <BreakdownRow label={quickView.carbonEstimate.materialFamily} value={`${quickView.carbonEstimate.materialKgCo2e.toFixed(1)} kgCO2e`} />
                                            <BreakdownRow label="Manufacturing" value={`${quickView.carbonEstimate.manufacturingKgCo2e.toFixed(1)} kgCO2e`} />
                                            <BreakdownRow label="Supplier overhead" value={`${quickView.carbonEstimate.supplierOverheadKgCo2e.toFixed(1)} kgCO2e`} />
                                            <BreakdownRow label="Logistics factor" value={`${quickView.carbonEstimate.logisticsKgCo2e.toFixed(1)} kgCO2e`} />
                                        </div>
                                        <p className="mt-4 text-xs text-muted-foreground">
                                            {quickView.carbonEstimate.sourceLabel}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Factory className="h-4 w-4 text-primary" />
                                    Related suppliers
                                </div>
                                {quickView.supplierCoverage.length === 0 ? (
                                    <div className="mt-4 rounded-2xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                                        No related supplier history exists yet for this part.
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-3">
                                        {quickView.supplierCoverage.map((supplier) => (
                                            <div key={supplier.supplierId} className="rounded-2xl border bg-background p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p className="font-semibold text-foreground">{supplier.supplierName}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Financial {supplier.financialScore || 0} / Risk {supplier.riskScore || 0} / ESG {supplier.esgScore || 0}
                                                        </p>
                                                    </div>
                                                    {onOpenSupplier && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => onOpenSupplier(supplier.supplierId)}
                                                        >
                                                            Open supplier drawer
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                                                    <span>Open orders: {supplier.openOrderCount}</span>
                                                    <span>Delayed: {supplier.delayedOrderCount}</span>
                                                    <span>Renewables: {supplier.renewableEnergyShare || 0}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function MetricCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-2xl border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                {icon}
            </div>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span>{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}
