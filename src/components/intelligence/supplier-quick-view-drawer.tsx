'use client';

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, BadgeCheck, Factory, Globe2, Leaf, Loader2, ShieldCheck, Wallet } from "lucide-react";

import { getSupplierQuickView } from "@/app/actions/suppliers";
import { MessageSupplierButton } from "@/components/suppliers/message-supplier-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils/currency";

type SupplierQuickViewData = Awaited<ReturnType<typeof getSupplierQuickView>>;

const DISCLOSURE_BAND_COPY: Record<string, string> = {
    leading: "Primary sustainability disclosure is strong enough to support benchmarking with limited manual follow-up.",
    developing: "Useful baseline disclosure is present, but buyer verification is still recommended before award.",
    verify: "Supplier-provided sustainability inputs remain thin; keep a manual audit in the loop.",
};

export function SupplierQuickViewDrawer({
    supplierId,
    open,
    onOpenChange,
}: {
    supplierId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [data, setData] = useState<SupplierQuickViewData>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !supplierId) {
            return;
        }

        let cancelled = false;
        setData(null);
        setLoading(true);

        void (async () => {
            const result = await getSupplierQuickView(supplierId);
            if (!cancelled) {
                setData(result);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, supplierId]);

    const supplier = data?.supplier;
    const quickView = data;
    const totalCarbon = data?.sustainability.totalCarbon || 0;
    const renewableShare = data?.sustainability.renewableEnergyShare || 0;
    const delayedOrders = data?.orderStats.delayedOrders || 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-hidden">
                <SheetHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                        <div className="space-y-2">
                            <SheetTitle>{supplier?.name || "Supplier quick view"}</SheetTitle>
                            <SheetDescription>
                                Procurement context without leaving the page: financial health, delivery risk, ESG posture, and current collaboration load.
                            </SheetDescription>
                        </div>
                        {supplier && (
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="font-semibold uppercase">
                                    {supplier.tierLevel?.replace('_', ' ') || 'tier 3'}
                                </Badge>
                                <Badge className={supplier.status === 'active' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                                    {supplier.status || 'active'}
                                </Badge>
                            </div>
                        )}
                    </div>
                </SheetHeader>

                <div className="show-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-6">
                    {loading && (
                        <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Building supplier context...
                        </div>
                    )}

                    {!loading && !supplier && (
                        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                            Supplier data could not be loaded for this quick view.
                        </div>
                    )}

                    {!loading && supplier && quickView && (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <MetricCard
                                    label="Financial Health"
                                    value={`${supplier.financialScore || 0}/100`}
                                    hint={supplier.financialHealthRating || "No rating recorded"}
                                    icon={<Wallet className="h-4 w-4 text-emerald-600" />}
                                />
                                <MetricCard
                                    label="Operational Risk"
                                    value={`${supplier.riskScore || 0}/100`}
                                    hint={delayedOrders > 0 ? `${delayedOrders} delayed order${delayedOrders === 1 ? '' : 's'} require review` : "No active shipment delay detected"}
                                    icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                                />
                                <MetricCard
                                    label="ESG Score"
                                    value={`${supplier.esgScore || 0}/100`}
                                    hint={`${renewableShare}% renewable share disclosed`}
                                    icon={<Leaf className="h-4 w-4 text-emerald-600" />}
                                />
                                <MetricCard
                                    label="Spend Exposure"
                                    value={formatCurrency(quickView.orderStats.totalSpend)}
                                    hint={`${quickView.orderStats.activeOrders} active orders`}
                                    icon={<Factory className="h-4 w-4 text-primary" />}
                                />
                            </div>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Risk and performance pulse
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>On-time delivery</span>
                                            <span className="font-semibold">{Math.round(quickView.performance?.onTimeDeliveryRate || 0)}%</span>
                                        </div>
                                        <Progress value={Math.round(quickView.performance?.onTimeDeliveryRate || 0)} className="h-2" />
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Collaboration score</span>
                                            <span className="font-semibold">{quickView.performance?.collaborationScore || 0}/100</span>
                                        </div>
                                        <Progress value={quickView.performance?.collaborationScore || 0} className="h-2" />
                                    </div>
                                    <div className="space-y-3 rounded-2xl border bg-background p-4 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Open RFQ invites</span>
                                            <span className="font-semibold">{quickView.rfqStats.activeInvites}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Quotes submitted</span>
                                            <span className="font-semibold">{quickView.rfqStats.submittedQuotes}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Shared documents</span>
                                            <span className="font-semibold">{quickView.documentCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Globe2 className="h-4 w-4 text-primary" />
                                    Sustainability scorecard
                                </div>
                                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Renewable energy share</span>
                                            <span className="font-semibold">{renewableShare}%</span>
                                        </div>
                                        <Progress value={renewableShare} className="h-2" />
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <CarbonBox label="Scope 1" value={quickView.sustainability.scope1} />
                                            <CarbonBox label="Scope 2" value={quickView.sustainability.scope2} />
                                            <CarbonBox label="Scope 3" value={quickView.sustainability.scope3} />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border bg-background p-4">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                            Disclosure Band
                                        </p>
                                        <p className="mt-2 text-xl font-semibold capitalize">
                                            {quickView.sustainability.supplierDisclosureBand}
                                        </p>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {DISCLOSURE_BAND_COPY[quickView.sustainability.supplierDisclosureBand]}
                                        </p>
                                        <p className="mt-4 text-sm font-semibold text-foreground">
                                            Total footprint: {totalCarbon.toFixed(1)} tCO2e
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border bg-muted/20 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <BadgeCheck className="h-4 w-4 text-primary" />
                                    Compliance and scope
                                </div>
                                <div className="mt-4 space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {(supplier.isoCertifications || []).length > 0 ? (
                                            supplier.isoCertifications?.map((certification: string) => (
                                                <Badge key={certification} variant="outline" className="font-medium">
                                                    {certification}
                                                </Badge>
                                            ))
                                        ) : (
                                            <Badge variant="outline">No certifications recorded</Badge>
                                        )}
                                        {supplier.modernSlaveryStatement === 'yes' && (
                                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                                Modern slavery statement on file
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Primary contact</span>
                                            <span className="font-medium">{supplier.contactEmail}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Location</span>
                                            <span className="font-medium">
                                                {[supplier.city, supplier.countryCode].filter(Boolean).join(', ') || 'Not provided'}
                                            </span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-muted-foreground">Supply categories</span>
                                            <div className="flex max-w-[60%] flex-wrap justify-end gap-2">
                                                {(supplier.categories || []).length > 0 ? (
                                                    supplier.categories?.map((category: string) => (
                                                        <Badge key={category} variant="secondary">{category}</Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-right text-muted-foreground">No categories recorded</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {supplier && (
                    <SheetFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <MessageSupplierButton
                            supplierId={supplier.id}
                            supplierName={supplier.name}
                            supplierEmail={supplier.contactEmail}
                            triggerLabel="Message Supplier"
                            variant="outline"
                            className="w-full sm:w-auto"
                        />
                        <Link href={`/suppliers/${supplier.id}`} className="w-full sm:w-auto">
                            <Button className="w-full gap-2">
                                Open Full Supplier Dossier
                                <ArrowUpRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </SheetFooter>
                )}
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
            <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}

function CarbonBox({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border bg-background p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value.toFixed(1)} tCO2e</p>
        </div>
    );
}
