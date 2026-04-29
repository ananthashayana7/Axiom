'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Filter, Loader2, Minus, Repeat, Search, TrendingDown, TrendingUp, X } from "lucide-react";

import { processLowStockAlerts } from "@/app/actions/parts";
import { PartQuickViewDrawer } from "@/components/intelligence/part-quick-view-drawer";
import { SupplierQuickViewDrawer } from "@/components/intelligence/supplier-quick-view-drawer";
import { PartMenuActions } from "./part-menu-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Part } from "@/db/schema";
import { calculateAdaptiveReorderPlan } from "@/lib/procurement-intelligence";
import { formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";

type InventoryPart = Part & {
    orderCount?: number;
    invoiceCount?: number;
    rfqCount?: number;
    openOrderCount?: number;
    delayedOrderCount?: number;
    forecastDemand?: number;
};

type TrendMeta = {
    label: string;
    badgeClassName: string;
    Icon: typeof TrendingUp;
    narrative: string;
};

function getTrendMeta(part: InventoryPart): TrendMeta {
    const sharedNarrative = "Source: Axiom internal benchmark and recent pricing snapshot.";

    switch (part.marketTrend?.toLowerCase()) {
        case 'up':
            return {
                label: 'Rising',
                badgeClassName: 'text-red-500 border-red-200 bg-red-50',
                Icon: TrendingUp,
                narrative: `This SKU is running above its recent baseline. Review fresh supplier quotes before placing the next order. ${sharedNarrative}`,
            };
        case 'down':
            return {
                label: 'Falling',
                badgeClassName: 'text-green-600 border-green-200 bg-green-50',
                Icon: TrendingDown,
                narrative: `Recent pricing is easing for this SKU. This is a good candidate for re-bid or volume negotiation. ${sharedNarrative}`,
            };
        case 'volatile':
            return {
                label: 'Volatile',
                badgeClassName: 'text-amber-600 border-amber-200 bg-amber-50',
                Icon: AlertTriangle,
                narrative: `Pricing is inconsistent across recent benchmarks. Keep this item in an RFQ-driven workflow instead of auto-awarding it. ${sharedNarrative}`,
            };
        default:
            return {
                label: 'Stable',
                badgeClassName: 'text-blue-600 border-blue-200 bg-blue-50',
                Icon: Minus,
                narrative: `Pricing is tracking close to the current baseline, so standard reorder logic is safe here. ${sharedNarrative}`,
            };
    }
}

function getSuggestedReorders(parts: InventoryPart[]) {
    return parts
        .map((part) => {
            const adaptivePlan = calculateAdaptiveReorderPlan({
                baseReorderPoint: part.reorderPoint,
                minStockLevel: part.minStockLevel,
                stockLevel: part.stockLevel,
                marketTrend: part.marketTrend,
                delayedOpenOrders: part.delayedOrderCount,
                openOrders: part.openOrderCount,
                forecastDemand: part.forecastDemand,
            });

            return {
                ...part,
                adaptivePlan,
            };
        })
        .filter((part) => part.stockLevel <= part.adaptivePlan.adjustedReorderPoint)
        .map((part) => {
            const reorderPoint = part.reorderPoint || 50;
            const minStockLevel = part.minStockLevel || 20;
            const targetStock = part.adaptivePlan.targetStock;
            const recommendedQty = part.adaptivePlan.recommendedQty;
            const severity = part.stockLevel <= minStockLevel ? 'critical' : 'low';

            return {
                ...part,
                reorderPoint,
                minStockLevel,
                targetStock,
                recommendedQty,
                severity,
                adjustedReorderPoint: part.adaptivePlan.adjustedReorderPoint,
                riskLevel: part.adaptivePlan.riskLevel,
                rationale: part.adaptivePlan.reasons,
            };
        })
        .sort((left, right) => {
            if (left.severity !== right.severity) {
                return left.severity === 'critical' ? -1 : 1;
            }
            return left.stockLevel - right.stockLevel;
        });
}

export function PartsClient({ initialParts }: { initialParts: InventoryPart[] }) {
    return (
        <Suspense fallback={<div className="p-20 text-center">Loading inventory...</div>}>
            <PartsTable initialParts={initialParts} />
        </Suspense>
    );
}

function PartsTable({ initialParts }: { initialParts: InventoryPart[] }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const filterParam = searchParams.get('filter');
    const partParam = searchParams.get('part');
    const supplierParam = searchParams.get('supplier');

    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [isProcessingReorders, setIsProcessingReorders] = useState(false);
    const [expandedTrendPartId, setExpandedTrendPartId] = useState<string | null>(null);

    const itemsPerPage = 10;

    const buildRoute = (nextParams: URLSearchParams) => {
        const query = nextParams.toString();
        return query ? `/sourcing/parts?${query}` : '/sourcing/parts';
    };

    const setDrawerParam = (key: 'part' | 'supplier', value: string | null) => {
        const nextParams = new URLSearchParams(searchParams.toString());

        if (value) {
            nextParams.set(key, value);
            if (key === 'part') nextParams.delete('supplier');
            if (key === 'supplier') nextParams.delete('part');
        } else {
            nextParams.delete(key);
        }

        router.replace(buildRoute(nextParams), { scroll: false });
    };

    const categories = useMemo(() => {
        const cats = new Set(initialParts.map((part) => part.category));
        return ["All", ...Array.from(cats)];
    }, [initialParts]);

    const reorderSuggestions = useMemo(() => getSuggestedReorders(initialParts), [initialParts]);

    const filteredParts = useMemo(() => {
        return initialParts.filter((part) => {
            const matchesSearch =
                part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                part.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                part.category.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = categoryFilter === "All" || part.category === categoryFilter;

            let matchesStockStatus = true;
            if (filterParam === 'low') {
                matchesStockStatus = part.stockLevel <= (part.reorderPoint || 50) && part.stockLevel > (part.minStockLevel || 20);
            } else if (filterParam === 'critical') {
                matchesStockStatus = part.stockLevel <= (part.minStockLevel || 20);
            }

            return matchesSearch && matchesCategory && matchesStockStatus;
        });
    }, [categoryFilter, filterParam, initialParts, searchQuery]);

    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
    const paginatedParts = filteredParts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleProcessReorders = async () => {
        setIsProcessingReorders(true);
        try {
            const result = await processLowStockAlerts();
            if (result.success) {
                toast.success(result.message);
                setReviewOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to create reorder drafts");
            }
        } catch (_error) {
            toast.error("An unexpected error occurred while creating draft reorders.");
        } finally {
            setIsProcessingReorders(false);
        }
    };

    return (
        <>
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="border-b bg-muted/20 p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Parts Inventory</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Review stock health, benchmark pricing signals, and linked sourcing activity in one place.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 lg:flex-row xl:w-auto">
                            <div className="relative flex-1 lg:min-w-[240px] xl:w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by part, SKU, or category..."
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    className="bg-background pl-9"
                                />
                            </div>
                            <div className="relative lg:min-w-[160px]">
                                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <select
                                    className="min-w-[160px] appearance-none rounded-md border bg-background py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary"
                                    value={categoryFilter}
                                    onChange={(event) => setCategoryFilter(event.target.value)}
                                >
                                    {categories.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>
                            {filterParam && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push('/sourcing/parts')}
                                    className="h-10 gap-2 px-3 text-xs font-bold"
                                >
                                    <X size={14} /> Clear Status: {filterParam.toUpperCase()}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReviewOpen(true)}
                                className="h-10 gap-2 border-amber-200 bg-amber-50 px-4 font-bold text-amber-700 hover:bg-amber-100"
                            >
                                <Repeat className="h-4 w-4" />
                                Review {reorderSuggestions.length} Suggested Reorders
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="show-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[980px]">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">SKU</th>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Part Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</th>
                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">Stock</th>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Price</th>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Market Trend</th>
                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                                <th className="sticky right-0 z-10 bg-muted px-6 py-4 text-right text-xs font-bold uppercase tracking-widest text-muted-foreground shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedParts.map((part) => {
                                const trendMeta = getTrendMeta(part);
                                const stockIsCritical = part.stockLevel <= (part.minStockLevel || 20);
                                const stockIsLow = !stockIsCritical && part.stockLevel <= (part.reorderPoint || 50);
                                const trendExpanded = expandedTrendPartId === part.id;

                                return (
                                    <tr key={part.id} className="group transition-colors hover:bg-muted/30">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono font-bold text-primary">{part.sku}</td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <button
                                                type="button"
                                                className="whitespace-nowrap text-left font-semibold text-foreground transition-colors hover:text-primary"
                                                onClick={() => setDrawerParam('part', part.id)}
                                            >
                                                {part.name}
                                            </button>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                            <Badge variant="secondary" className="bg-secondary/50 font-semibold">{part.category}</Badge>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                                            <span className={`inline-block rounded-md px-2 py-1 font-bold ${stockIsCritical ? 'bg-red-100 text-red-700' : stockIsLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                {part.stockLevel}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-lg font-black text-foreground">
                                            {formatCurrency(part.price || 0)}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedTrendPartId((current) => current === part.id ? null : part.id)}
                                                aria-expanded={trendExpanded}
                                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:brightness-95 ${trendMeta.badgeClassName}`}
                                            >
                                                <trendMeta.Icon size={12} />
                                                {trendMeta.label}
                                            </button>
                                            {trendExpanded && (
                                                <p className="mt-2 max-w-[240px] text-[11px] leading-4 text-muted-foreground">
                                                    {trendMeta.narrative}
                                                </p>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-xs font-black uppercase">
                                                    <div className={`h-2 w-2 rounded-full ${stockIsCritical ? 'bg-red-500 animate-pulse' : stockIsLow ? 'bg-amber-500' : 'bg-green-500'}`} />
                                                    {stockIsCritical ? 'Critical' : stockIsLow ? 'Low Stock' : 'Available'}
                                                </div>
                                                <div className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                                                    Min: {part.minStockLevel || 20} | Reorder: {part.reorderPoint || 50}
                                                </div>
                                                {(part.delayedOrderCount || part.forecastDemand) ? (
                                                    <div className="text-[10px] font-medium text-muted-foreground">
                                                        {part.delayedOrderCount ? `${part.delayedOrderCount} delayed shipment signal` : null}
                                                        {part.delayedOrderCount && part.forecastDemand ? ' / ' : null}
                                                        {part.forecastDemand ? `${part.forecastDemand} forecasted units` : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </td>
                                        <td className="sticky right-0 z-10 whitespace-nowrap bg-card px-6 py-4 text-right shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] transition-colors group-hover:bg-muted">
                                            <PartMenuActions part={part} />
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredParts.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search size={48} className="opacity-20" />
                                            <p className="text-xl font-bold">No parts found</p>
                                            <p className="text-sm">Try adjusting your search or filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-4 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredParts.length)} of {filteredParts.length} entries
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="h-8 px-3"
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                                    let page = index + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        page = currentPage - 2 + index;
                                        if (page > totalPages) {
                                            page = totalPages - (4 - index);
                                        }
                                    }

                                    return (
                                        <Button
                                            key={page}
                                            variant={currentPage === page ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePageChange(page)}
                                            className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-primary text-primary-foreground' : ''}`}
                                        >
                                            {page}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="h-8 px-3"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Suggested Reorders Review</DialogTitle>
                        <DialogDescription>
                            Axiom reviewed current stock against reorder thresholds. Draft requisitions are only created after you confirm this list.
                        </DialogDescription>
                    </DialogHeader>

                    {reorderSuggestions.length === 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                            Inventory is healthy right now. No reorder drafts are required.
                        </div>
                    ) : (
                        <div className="show-scrollbar max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                            {reorderSuggestions.map((part) => (
                                <div key={part.id} className="rounded-xl border bg-muted/20 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-foreground">{part.name}</p>
                                                <Badge variant="outline" className="font-mono text-[10px]">{part.sku}</Badge>
                                                <Badge className={part.severity === 'critical' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                                                    {part.severity === 'critical' ? 'Critical attention' : 'Low stock'}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Current stock is {part.stockLevel}. Baseline reorder trigger is {part.reorderPoint}, adaptive trigger is {part.adjustedReorderPoint}, and the recommended target stock is {part.targetStock}.
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge className={part.riskLevel === 'high' ? 'bg-red-100 text-red-700 hover:bg-red-100' : part.riskLevel === 'elevated' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>
                                                    {part.riskLevel} signal
                                                </Badge>
                                                {(part.delayedOrderCount || 0) > 0 && (
                                                    <Badge variant="outline">{part.delayedOrderCount} delayed shipment{part.delayedOrderCount === 1 ? '' : 's'}</Badge>
                                                )}
                                                {(part.forecastDemand || 0) > 0 && (
                                                    <Badge variant="outline">{part.forecastDemand} forecasted units</Badge>
                                                )}
                                            </div>
                                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                                {part.rationale.map((reason: string) => (
                                                    <p key={reason}>{reason}</p>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border bg-background px-4 py-3 text-right">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Recommended Qty</p>
                                            <p className="text-2xl font-black text-foreground">{part.recommendedQty}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReviewOpen(false)}>
                            Close
                        </Button>
                        <Button
                            onClick={handleProcessReorders}
                            disabled={reorderSuggestions.length === 0 || isProcessingReorders}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            {isProcessingReorders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
                            Create Draft Requisitions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PartQuickViewDrawer
                partId={partParam}
                open={Boolean(partParam)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDrawerParam('part', null);
                    }
                }}
                onOpenSupplier={(supplierId) => setDrawerParam('supplier', supplierId)}
            />

            <SupplierQuickViewDrawer
                supplierId={supplierParam}
                open={Boolean(supplierParam)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDrawerParam('supplier', null);
                    }
                }}
            />
        </>
    );
}
