'use client'

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { ArrowRight, History, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateRFQModal } from "@/components/sourcing/create-rfq-modal";

type PartOption = {
    id: string;
    sku: string;
    name: string;
    category: string;
};

type RFQRow = {
    id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    createdAt?: Date | string | null;
    createdAtLabel?: string;
    items?: Array<{ id: string; [key: string]: unknown }>;
    suppliers?: Array<{ id: string; supplier?: { name?: string | null; [key: string]: unknown } | null; [key: string]: unknown }>;
    [key: string]: unknown;
};

type RFQsListClientProps = {
    rfqs: RFQRow[];
    isAdmin: boolean;
    parts: PartOption[];
    defaultCreateOpen?: boolean;
};

type StatusFilter = 'all' | 'draft' | 'open' | 'closed' | 'cancelled';
type SupplierFilter = 'all' | 'invited' | 'unassigned';
type SortKey = 'newest' | 'oldest' | 'title' | 'items' | 'suppliers';

export function RFQsListClient({ rfqs, isAdmin, parts, defaultCreateOpen = false }: RFQsListClientProps) {
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [supplierFilter, setSupplierFilter] = useState<SupplierFilter>('all');
    const [sortBy, setSortBy] = useState<SortKey>('newest');
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const showHeaderCreateAction = isAdmin && rfqs.length > 0;
    const showEmptyStateCreateAction = isAdmin && rfqs.length === 0;

    const filteredRfqs = [...rfqs]
        .filter((rfq) => {
            const supplierNames = (rfq.suppliers || []).map((supplier) => supplier.supplier?.name || "").join(" ").toLowerCase();
            const matchesQuery = !deferredQuery
                || (rfq.title || "").toLowerCase().includes(deferredQuery)
                || (rfq.description || "").toLowerCase().includes(deferredQuery)
                || supplierNames.includes(deferredQuery);

            const matchesStatus = statusFilter === 'all' || rfq.status === statusFilter;
            const supplierCount = rfq.suppliers?.length || 0;
            const matchesSupplier = supplierFilter === 'all'
                || (supplierFilter === 'invited' && supplierCount > 0)
                || (supplierFilter === 'unassigned' && supplierCount === 0);

            return matchesQuery && matchesStatus && matchesSupplier;
        })
        .sort((left, right) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
                case 'title':
                    return (left.title || "").localeCompare(right.title || "");
                case 'items':
                    return (right.items?.length || 0) - (left.items?.length || 0);
                case 'suppliers':
                    return (right.suppliers?.length || 0) - (left.suppliers?.length || 0);
                case 'newest':
                default:
                    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
            }
        });

    return (
        <>
            <div className="mb-8 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold tracking-tight">Sourcing Requests (RFQs)</h1>
                    <p className="mt-1 text-muted-foreground">Manage quotations, supplier invitations, and sourcing progress with quick filters.</p>
                </div>
                {showHeaderCreateAction ? (
                    <CreateRFQModal
                        key={defaultCreateOpen ? 'header-create-open' : 'header-create-closed'}
                        parts={parts}
                        defaultOpen={defaultCreateOpen}
                    />
                ) : null}
            </div>

            <Card className="mb-6 border-accent/20 shadow-sm">
                <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.72fr))_auto]">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Title, description, supplier"
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="all">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suppliers</label>
                        <select
                            value={supplierFilter}
                            onChange={(event) => setSupplierFilter(event.target.value as SupplierFilter)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="all">All RFQs</option>
                            <option value="invited">With suppliers</option>
                            <option value="unassigned">Without suppliers</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort</label>
                        <select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as SortKey)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="title">Title A-Z</option>
                            <option value="items">Most items</option>
                            <option value="suppliers">Most suppliers</option>
                        </select>
                    </div>
                    <div className="flex items-end justify-between gap-3 md:col-span-2 xl:col-span-4 2xl:col-span-1 2xl:justify-end">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <SlidersHorizontal className="h-4 w-4" />
                            {filteredRfqs.length} result{filteredRfqs.length === 1 ? '' : 's'}
                        </div>
                        {(query || statusFilter !== 'all' || supplierFilter !== 'all' || sortBy !== 'newest') && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setQuery("");
                                    setStatusFilter('all');
                                    setSupplierFilter('all');
                                    setSortBy('newest');
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6">
                {filteredRfqs.map((rfq) => (
                    <Card key={rfq.id} className="border-accent/20 transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-3">
                                    <CardTitle className="text-xl leading-tight break-words">{rfq.title}</CardTitle>
                                    <Badge variant={
                                        rfq.status === 'open' ? 'default' :
                                            rfq.status === 'draft' ? 'secondary' :
                                                'outline'
                                    }>
                                        {(rfq.status || 'draft').toUpperCase()}
                                    </Badge>
                                </div>
                                <CardDescription suppressHydrationWarning className="hidden">
                                    <History size={14} />
                                    Created {new Date(rfq.createdAt || 0).toLocaleDateString()} • {rfq.status === 'closed' && (rfq.items?.length || 0) === 0 ? 'archived item detail unavailable' : `${rfq.items?.length || 0} items`} • {rfq.suppliers?.length || 0} suppliers
                                </CardDescription>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                    <History size={14} />
                                    Created {rfq.createdAtLabel || 'N/A'} | {rfq.status === 'closed' && (rfq.items?.length || 0) === 0 ? 'archived item detail unavailable' : `${rfq.items?.length || 0} items`} | {rfq.suppliers?.length || 0} suppliers
                                </div>
                            </div>
                            <Link href={`/sourcing/rfqs/${rfq.id}`} className="w-full sm:w-auto">
                                <Button variant="ghost" className="w-full gap-2 sm:w-auto">
                                    View Details
                                    <ArrowRight size={16} />
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-3 break-words text-sm text-muted-foreground">
                                {rfq.description || "No description provided."}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-muted-foreground">AI Selected Suppliers:</span>
                                {rfq.suppliers?.map((supplier) => (
                                    <Badge key={supplier.id} variant="secondary" className="border-primary/20 bg-primary/5 px-3 text-primary hover:bg-primary/10">
                                        {supplier.supplier?.name || "Unknown"}
                                    </Badge>
                                ))}
                                {(rfq.suppliers?.length || 0) === 0 && <span className="italic text-muted-foreground">None invited yet</span>}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredRfqs.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent/30 bg-background px-6 py-20 text-center">
                        <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
                        <h3 className="text-lg font-semibold">No sourcing requests found</h3>
                        <p className="mb-6 text-muted-foreground">
                            {rfqs.length === 0
                                ? "Create your first RFQ to start automated supplier selection."
                                : "Adjust the filters to widen the result set."}
                        </p>
                        {showEmptyStateCreateAction ? (
                            <CreateRFQModal
                                key={defaultCreateOpen ? 'empty-create-open' : 'empty-create-closed'}
                                parts={parts}
                                defaultOpen={defaultCreateOpen}
                            />
                        ) : null}
                    </div>
                )}
            </div>
        </>
    );
}
