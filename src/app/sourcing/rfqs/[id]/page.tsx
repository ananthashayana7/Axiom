import { getRFQById, updateRFQStatus } from "@/app/actions/rfqs";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    FileText,
    TrendingUp,
    ShieldCheck,
    Clock,
    Wallet
} from "lucide-react";
import { AnalyzeQuoteButton } from "@/components/sourcing/analyze-quote-button";
import { ApproveOrderButton } from "@/components/sourcing/approve-order-button";
import { ComplianceStatus } from "@/components/sourcing/compliance-status";
import { CostIntelligence } from "@/components/sourcing/cost-intelligence";
import { getSuppliers } from "@/app/actions/suppliers";
import { ManualInviteDialog } from "@/components/sourcing/manual-invite-dialog";
import { getRFQNegotiationWorkbench } from "@/app/actions/cost-intelligence";
import Link from "next/link";
import type { Supplier, Part } from "@/db/schema";
import { LaunchSourcingButton, ComparePricesButton, PrepareNegotiationButton } from "@/components/sourcing/rfq-action-buttons";

export const dynamic = 'force-dynamic';

// Define types for the RFQ with relations
type RFQItem = {
    id: string;
    rfqId: string;
    partId: string;
    quantity: number;
    part: Part;
};

type RFQSupplier = {
    id: string;
    rfqId: string;
    supplierId: string;
    status: string | null;
    quoteAmount: string | null;
    aiAnalysis: string | null;
    createdAt: Date | null;
    supplier: Supplier;
};

type RFQWithRelations = {
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    createdAt: Date | null;
    items: RFQItem[];
    suppliers: RFQSupplier[];
    documents?: unknown[];
};

type ParsedSupplierAnalysis = {
    deliveryWeeks: number | null;
    terms: string | null;
    highlights: string[];
};

function parseSupplierAnalysis(value: string | null): ParsedSupplierAnalysis {
    if (!value) {
        return { deliveryWeeks: null, terms: null, highlights: [] };
    }

    try {
        const parsed = JSON.parse(value) as {
            deliveryWeeks?: number;
            deliveryLeadTime?: string;
            leadTimeWeeks?: number;
            terms?: string;
            paymentTerms?: string;
            highlights?: string[];
        };

        const deliveryMatch = typeof parsed.deliveryLeadTime === 'string'
            ? parsed.deliveryLeadTime.match(/(\d+)/)
            : null;

        return {
            deliveryWeeks: typeof parsed.deliveryWeeks === 'number'
                ? parsed.deliveryWeeks
                : typeof parsed.leadTimeWeeks === 'number'
                    ? parsed.leadTimeWeeks
                    : deliveryMatch
                        ? Number(deliveryMatch[1])
                        : null,
            terms: parsed.terms || parsed.paymentTerms || null,
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        };
    } catch {
        return { deliveryWeeks: null, terms: null, highlights: [] };
    }
}

function formatCurrency(value: number | string | null | undefined) {
    return `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = session?.user?.role === 'admin';
    const canManageRfqs = Boolean(session?.user && session.user.role !== 'supplier');

    const rfq = await getRFQById(id) as RFQWithRelations | null;

    if (!rfq) {
        notFound();
    }

    const sortedSuppliers = [...rfq.suppliers].sort((a, b) => {
        const scoreA = (a.supplier.performanceScore || 0) * 0.7 + (100 - (a.supplier.riskScore || 0)) * 0.3;
        const scoreB = (b.supplier.performanceScore || 0) * 0.7 + (100 - (b.supplier.riskScore || 0)) * 0.3;
        return scoreB - scoreA;
    });
    const topSupplierId = sortedSuppliers[0]?.id;
    const quotedSuppliers = sortedSuppliers.filter((s) => s.aiAnalysis);
    const fastestQuotedSupplier = quotedSuppliers
        .map((supplier) => ({
            supplier,
            analysis: parseSupplierAnalysis(supplier.aiAnalysis),
        }))
        .filter((entry) => entry.analysis.deliveryWeeks !== null)
        .sort((left, right) => (left.analysis.deliveryWeeks || 0) - (right.analysis.deliveryWeeks || 0))[0] || null;

    const allSuppliersMaster = await getSuppliers();
    const negotiationWorkbench = canManageRfqs ? await getRFQNegotiationWorkbench(id).catch(() => null) : null;

    const handleStatusChange = async (formData: FormData) => {
        'use server';
        const newStatus = formData.get('status') as 'draft' | 'open' | 'closed' | 'cancelled';
        await updateRFQStatus(id, newStatus);
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <div className="mb-6">
                <Link href="/sourcing/rfqs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sourcing Requests
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">{rfq.title}</h1>
                        <Badge variant={rfq.status === 'open' ? 'default' : 'secondary'} className="text-sm px-3">
                            {rfq.status?.toUpperCase()}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-lg max-w-2xl">{rfq.description || "No description provided."}</p>
                </div>

                <Card className="w-full lg:w-[350px] p-6 bg-background shadow-sm border-accent/50">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Created</span>
                            <span className="text-sm font-semibold">{new Date(rfq.createdAt!).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-4">
                            <span className="text-sm font-medium text-muted-foreground">Request Items</span>
                            <span className="text-sm font-semibold">{rfq.items.length} Unique Parts</span>
                        </div>
                        {isAdmin && (
                            <div className="pt-4 border-t space-y-3">
                                <form action={handleStatusChange} className="flex gap-2">
                                    <select
                                        name="status"
                                        defaultValue={rfq.status!}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="open">Open (Invite Suppliers)</option>
                                        <option value="closed">Closed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                    <Button type="submit" size="sm" variant="secondary">Update</Button>
                                </form>
                                {rfq.status === 'draft' && (
                                    <LaunchSourcingButton rfqId={rfq.id} />
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 mb-10">
                {/* Left: Items List */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="h-full border-accent/20 rounded-3xl shadow-sm bg-background/50 backdrop-blur-sm">
                        <CardHeader className="pb-4 border-b border-muted">
                            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                <FileText className="h-6 w-6 text-primary" />
                                Line Item Spec
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {rfq.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border bg-muted/30 hover:bg-muted/50 transition-colors">
                                        <div className="space-y-1">
                                            <p className="font-bold text-sm text-foreground">{item.part.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border inline-block">{item.part.sku}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-primary">{item.quantity} Units</p>
                                            <Badge variant="outline" className="text-[10px] font-bold h-4 px-1.5 uppercase opacity-60 mt-1">{item.part.category}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: AI Selection & Insights */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-primary/20 bg-emerald-50/10 shadow-xl rounded-[2rem] overflow-hidden border-2">
                        <CardHeader className="pb-6 border-b border-primary/10 bg-primary/5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                                    <Sparkles className="h-7 w-7 text-primary" />
                                    Sourcing Intelligence
                                </CardTitle>
                                <div className="flex items-center gap-3">
                                    {isAdmin && (
                                        <ManualInviteDialog
                                            rfqId={id}
                                            suppliers={allSuppliersMaster}
                                            alreadyInvitedIds={rfq.suppliers.map(s => s.supplierId)}
                                        />
                                    )}
                                    <Badge variant="outline" className="bg-emerald-600 text-white border-none font-bold uppercase text-[10px] py-1.5 px-4 shadow-lg shadow-emerald-200">
                                        ENGINE ACTIVE
                                    </Badge>
                                </div>
                            </div>
                            <CardDescription className="text-muted-foreground mt-2 font-medium">
                                Multidimensional supplier evaluation using procurement telemetry and financial risk modeling.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8 pt-8 px-8 pb-10">
                            {sortedSuppliers.map((s) => {
                                const analysis = parseSupplierAnalysis(s.aiAnalysis);
                                const hasCommercialAnalysis = analysis.deliveryWeeks !== null || Boolean(analysis.terms) || analysis.highlights.length > 0;
                                const isTop = s.id === topSupplierId;
                                const performance = s.supplier.performanceScore || 0;
                                const risk = s.supplier.riskScore || 0;
                                const matchScore = Math.round((performance * 0.7) + ((100 - risk) * 0.3));

                                return (
                                    <div key={s.id} className={`flex flex-col gap-8 p-10 rounded-[2rem] border transition-all group relative overflow-hidden ${isTop ? 'border-primary/30 bg-white shadow-2xl scale-[1.02] z-10' : 'bg-background hover:border-accent hover:shadow-lg opacity-90 hover:opacity-100'}`}>

                                        <div className="flex flex-col xl:flex-row justify-between gap-10">
                                            <div className="flex-1 space-y-8">
                                                <div>
                                                    <div className="flex items-center gap-4 mb-2 flex-wrap">
                                                        <h3 className="text-3xl font-black tracking-tighter text-foreground group-hover:text-primary transition-colors">
                                                            {s.supplier.name}
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest h-6 bg-primary/5 text-primary border-primary/20 px-3 shrink-0">
                                                                {s.status}
                                                            </Badge>
                                                            {isTop && (
                                                                <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase h-6 px-3 flex items-center gap-1.5 shadow-md shadow-primary/20 border-none whitespace-nowrap">
                                                                    <Sparkles size={10} />
                                                                    Recommended Strategy
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-base text-muted-foreground font-medium flex items-center gap-2">
                                                        AI Intentionality Match:
                                                        <span className="text-primary font-black bg-primary/10 px-2 py-0.5 rounded-full">{matchScore}%</span>
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Performance</p>
                                                        <div className="flex items-center gap-2 font-black text-2xl text-foreground">
                                                            <TrendingUp size={24} className="text-green-500" />
                                                            {performance}%
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Risk Intelligence</p>
                                                        <div className="flex items-center gap-2 font-black text-2xl text-foreground">
                                                            <ShieldCheck size={24} className={risk > 30 ? 'text-red-500' : 'text-blue-500'} />
                                                            {risk <= 20 ? 'Verified' : risk <= 50 ? 'Moderate' : 'Critical'}
                                                        </div>
                                                    </div>
                                                    {hasCommercialAnalysis && (
                                                        <>
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Financial Quote</p>
                                                                <div className="flex items-center gap-2 font-black text-2xl text-primary">
                                                                    <Wallet size={24} />
                                                                    {formatCurrency(s.quoteAmount)}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Fulfillment</p>
                                                                <div className="flex items-center gap-2 font-black text-2xl text-foreground">
                                                                    <Clock size={24} />
                                                                    {analysis.deliveryWeeks !== null ? `${analysis.deliveryWeeks}w` : 'TBD'}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {hasCommercialAnalysis && (
                                                    <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 shadow-inner">
                                                        <p className="text-[10px] font-black text-primary mb-3 flex items-center gap-2 uppercase tracking-widest">
                                                            <Sparkles size={12} />
                                                            AI Deep-Extract Summary
                                                        </p>
                                                        <div className="grid md:grid-cols-2 gap-4">
                                                            <ul className="text-sm space-y-2">
                                                                {analysis.highlights.map((h: string, i: number) => (
                                                                    <li key={i} className="flex items-start gap-2 font-medium text-foreground/80">
                                                                        <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
                                                                        {h}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            <div className="border-l border-primary/10 pl-4 flex flex-col justify-center">
                                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Commercial Terms</p>
                                                                <p className="text-xs font-bold text-primary italic leading-relaxed">
                                                                    {analysis.terms ? `"${analysis.terms}"` : 'Terms pending supplier confirmation.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-4 shrink-0 xl:pl-10 xl:border-l border-muted-foreground/10 w-full xl:w-[260px] justify-center pt-8 xl:pt-0">
                                                {isAdmin && (
                                                    <div className="space-y-4">
                                                        <ApproveOrderButton
                                                            rfqId={rfq.id}
                                                            supplierId={s.supplier.id}
                                                            variant={isTop ? 'default' : 'secondary'}
                                                        />
                                                        <AnalyzeQuoteButton rfqSupplierId={s.id} hasAnalysis={!!s.aiAnalysis} />
                                                        <div className="flex items-center gap-2">
                                                            <Link href={`/suppliers/${s.supplier.id}`} className="flex-1">
                                                                <Button size="sm" variant="outline" className="w-full h-10 font-bold text-xs shadow-sm">Supplier Profile</Button>
                                                            </Link>
                                                            <ComparePricesButton />
                                                        </div>
                                                    </div>
                                                )}
                                                {!isAdmin && (
                                                    <Link href={`/suppliers/${s.supplier.id}`}>
                                                        <Button size="lg" variant="outline" className="w-full font-bold shadow-md">Full Intelligence Profile</Button>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {sortedSuppliers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <AlertTriangle className="h-10 w-10 text-yellow-500 mb-2" />
                                    <p className="font-semibold">No suppliers selected yet</p>
                                    <p className="text-sm text-muted-foreground">Move the RFQ to &apos;Open&apos; to trigger AI invitation logic.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card id="rfq-cost-insights" className="border-accent/30 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Sourcing Intelligence Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <CostIntelligence
                                quoteItems={quotedSuppliers.map(s => ({
                                    sku: "multiple", // Simplified for this component
                                    price: parseFloat(s.quoteAmount || '0'),
                                    supplier: s.supplier.name
                                }))}
                                historicalParts={rfq.items.map(i => i.part)}
                            />
                            <ComplianceStatus
                                rfqId={rfq.id}
                                rfqRequirements={rfq.description || ""}
                                initialDocuments={rfq.documents || []}
                            />
                        </CardContent>
                    </Card>

                    {negotiationWorkbench && (
                        <Card className="border-primary/20 shadow-sm bg-background/90">
                            <CardHeader className="border-b border-primary/10">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                                            <Sparkles className="h-6 w-6 text-primary" />
                                            Negotiation Workbench
                                        </CardTitle>
                                        <CardDescription className="mt-2 max-w-2xl">
                                            Benchmark-backed negotiation guidance that turns quote variance into action, savings, and award confidence.
                                        </CardDescription>
                                    </div>
                                    {isAdmin && negotiationWorkbench.hasQuotes ? (
                                        <PrepareNegotiationButton rfqId={rfq.id} />
                                    ) : null}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                {negotiationWorkbench.hasQuotes ? (
                                    <>
                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-3xl border bg-primary/5 p-5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</p>
                                                <div className="mt-3 flex items-center justify-between">
                                                    <span className="text-2xl font-black text-foreground">{negotiationWorkbench.negotiationPriority.toUpperCase()}</span>
                                                    <Badge className={negotiationWorkbench.negotiationPriority === 'critical' ? 'bg-red-600' : negotiationWorkbench.negotiationPriority === 'high' ? 'bg-amber-500' : 'bg-slate-700'}>
                                                        {negotiationWorkbench.quoteCount} quotes
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">{negotiationWorkbench.benchmarkCoveragePercent}% of line items are backed by historical or benchmark data.</p>
                                            </div>

                                            <div className="rounded-3xl border p-5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Should-Cost Target</p>
                                                <p className="mt-3 text-2xl font-black text-foreground">{formatCurrency(negotiationWorkbench.shouldCostTotal)}</p>
                                                <p className="mt-2 text-xs text-muted-foreground">Modeled benchmark-backed target across all RFQ lines.</p>
                                            </div>

                                            <div className="rounded-3xl border p-5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Best Quote</p>
                                                <p className="mt-3 text-2xl font-black text-foreground">{formatCurrency(negotiationWorkbench.bestQuoteAmount)}</p>
                                                <p className="mt-2 text-xs text-muted-foreground">Competitive baseline {formatCurrency(negotiationWorkbench.competitiveBaseline)}.</p>
                                            </div>

                                            <div className="rounded-3xl border p-5">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Negotiation Headroom</p>
                                                <p className="mt-3 text-2xl font-black text-emerald-700">{formatCurrency(negotiationWorkbench.shouldCostGap || negotiationWorkbench.competitiveSavings)}</p>
                                                <p className="mt-2 text-xs text-muted-foreground">Spread {negotiationWorkbench.spreadPercent}% across quoted suppliers.</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-6 xl:grid-cols-2">
                                            <div className="rounded-[2rem] border p-6 bg-background">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black tracking-tight">Recommended Award Path</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Best balance of price, delivery, and supplier quality.</p>
                                                    </div>
                                                    {negotiationWorkbench.recommendedSupplier ? (
                                                        <Badge variant="outline" className="text-[10px] uppercase">
                                                            Rank #1
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                {negotiationWorkbench.recommendedSupplier ? (
                                                    <div className="mt-5 space-y-4">
                                                        <div className="rounded-2xl bg-primary text-primary-foreground p-5">
                                                            <p className="text-xs uppercase tracking-widest opacity-80">Recommended supplier</p>
                                                            <p className="mt-2 text-2xl font-black">{negotiationWorkbench.recommendedSupplier.supplierName}</p>
                                                            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                                                                <span>Quote: {formatCurrency(negotiationWorkbench.recommendedSupplier.quoteAmount)}</span>
                                                                <span>Score: {negotiationWorkbench.recommendedSupplier.totalScore}</span>
                                                                <span>Risk: {negotiationWorkbench.recommendedSupplier.riskScore}</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {negotiationWorkbench.actionPlan.map((action, index) => (
                                                                <div key={index} className="flex items-start gap-3 rounded-2xl border p-4">
                                                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                                                                    <p className="text-sm font-medium leading-relaxed">{action}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="rounded-[2rem] border p-6 bg-background">
                                                <div>
                                                    <p className="text-sm font-black tracking-tight">Supplier Scoreboard</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Use the ranked field to drive best-and-final negotiation rounds.</p>
                                                </div>
                                                <div className="mt-5 space-y-3">
                                                    {negotiationWorkbench.supplierRankings.map((supplier, index) => (
                                                        <div key={supplier.supplierId} className="rounded-2xl border p-4">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div>
                                                                    <p className="font-semibold">{index + 1}. {supplier.supplierName}</p>
                                                                    <p className="text-xs text-muted-foreground mt-1">
                                                                        Quote {formatCurrency(supplier.quoteAmount)} | Delivery {supplier.deliveryWeeks !== null ? `${supplier.deliveryWeeks} weeks` : 'TBD'} | Risk {supplier.riskScore}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-lg font-black">{supplier.totalScore}</p>
                                                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted score</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                {supplier.deltaVsShouldCost !== null ? (
                                                                    <Badge variant="outline" className="text-[10px]">
                                                                        Gap vs should-cost: {formatCurrency(supplier.deltaVsShouldCost)}
                                                                    </Badge>
                                                                ) : null}
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    Delta vs lead: {formatCurrency(supplier.deltaVsBest)}
                                                                </Badge>
                                                                {supplier.terms ? (
                                                                    <Badge variant="outline" className="text-[10px]">
                                                                        {supplier.terms}
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[2rem] border p-6 bg-muted/20">
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <div>
                                                    <p className="text-sm font-black tracking-tight">Should-Cost Backbone</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Every RFQ line now carries a benchmark trail into negotiation.</p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {negotiationWorkbench.itemBenchmarks.length} lines
                                                </Badge>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                {negotiationWorkbench.itemBenchmarks.map((item) => (
                                                    <div key={item.partId} className="rounded-2xl border bg-background p-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="font-semibold text-sm">{item.partName}</p>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{item.sku} | {item.category}</p>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                                Qty {item.quantity}
                                                            </Badge>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Should-cost</p>
                                                                <p className="font-black">{formatCurrency(item.shouldCostTotal)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Current ref</p>
                                                                <p className="font-black">{formatCurrency(item.currentUnitPrice * item.quantity)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Benchmark unit</p>
                                                                <p className="font-semibold">{item.benchmarkUnitPrice !== null ? formatCurrency(item.benchmarkUnitPrice) : 'Pending'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Historical unit</p>
                                                                <p className="font-semibold">{item.historicalUnitPrice !== null ? formatCurrency(item.historicalUnitPrice) : 'Pending'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
                                        Collect supplier quotes to unlock should-cost targets, negotiation actions, and supplier scorecards.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {quotedSuppliers.length > 1 && (
                        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background shadow-2xl rounded-[2.5rem] overflow-hidden border-2 mt-12">
                            <CardHeader className="pb-8 pt-8 px-10 border-b border-primary/10">
                                <CardTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
                                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                    Strategic Award Intelligence
                                </CardTitle>
                                <CardDescription className="text-lg font-medium text-muted-foreground">
                                    Weighted decision matrix comparing performance, speed, and unit economics.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-10">
                                <div className="grid md:grid-cols-3 gap-8">
                                    <div className="p-4 lg:p-8 rounded-[2rem] bg-background border-2 border-green-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div className="space-y-4">
                                            <div className="p-3 bg-green-100 rounded-2xl w-fit">
                                                <Wallet className="h-8 w-8 text-green-700" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black tracking-tight text-green-900">Unit Economic Leader</p>
                                                <p className="text-sm text-green-600 font-medium">Lowest total cost per unit.</p>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-green-50">
                                            <p className="text-2xl font-black text-foreground">
                                                {[...quotedSuppliers].sort((a, b) => parseFloat(a.quoteAmount || '0') - parseFloat(b.quoteAmount || '0'))[0]?.supplier.name}
                                            </p>
                                            <p className="text-sm font-black text-green-700 mt-1 uppercase tracking-widest">{formatCurrency([...quotedSuppliers].sort((a, b) => parseFloat(a.quoteAmount || '0') - parseFloat(b.quoteAmount || '0'))[0]?.quoteAmount || '0')}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 lg:p-8 rounded-[2rem] bg-background border-2 border-blue-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div className="space-y-4">
                                            <div className="p-3 bg-blue-100 rounded-2xl w-fit">
                                                <Clock className="h-8 w-8 text-blue-700" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black tracking-tight text-blue-900">Speed Velocity Pick</p>
                                                <p className="text-sm text-blue-600 font-medium">Shortest logistical lead time.</p>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-blue-50">
                                            <p className="text-2xl font-black text-foreground">
                                                {fastestQuotedSupplier?.supplier.supplier.name || 'No lead-time data'}
                                            </p>
                                            <p className="text-sm font-black text-blue-700 mt-1 uppercase tracking-widest">{fastestQuotedSupplier?.analysis.deliveryWeeks || 'N/A'} Weeks Arrival</p>
                                        </div>
                                    </div>

                                    <div className="p-4 lg:p-10 rounded-[2rem] bg-primary text-primary-foreground shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-500">
                                            <Sparkles size={120} />
                                        </div>
                                        <div className="space-y-4 relative z-10">
                                            <div className="p-3 bg-white/20 rounded-2xl w-fit backdrop-blur-md">
                                                <CheckCircle2 className="h-8 w-8 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-xl font-black tracking-tight">System Optimal Choice</p>
                                                <Badge className="bg-white/20 text-white border-none text-[10px] mt-2 font-bold uppercase py-0.5">Weighted Rank #1</Badge>
                                            </div>
                                        </div>
                                        <div className="mt-8 pt-6 border-t border-white/20 relative z-10">
                                            <p className="text-3xl font-black">{negotiationWorkbench?.recommendedSupplier?.supplierName || sortedSuppliers[0]?.supplier.name}</p>
                                            <p className="text-sm font-bold opacity-80 mt-1 italic italic">AI Recommended Outcome</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
