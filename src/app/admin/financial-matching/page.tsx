'use client'

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    RefreshCcw,
    FileText,
    TrendingUp,
    DollarSign,
    Filter,
    X,
    Scale,
    ArrowUpRight,
    ShieldAlert,
    Lock,
    RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { escalateInvoiceToHumanReview, getInvoiceOverrideRequests, getInvoices, requestInvoiceOverride, rerunInvoiceMatch, reviewInvoiceOverride, updateInvoiceStatus } from "@/app/actions/invoices";
import { InvoiceReviewDialog } from "@/components/invoices/invoice-review-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getThreeWayMatchReasonLabel } from "@/lib/utils/three-way-match";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN',
    EUR: 'de-DE',
    USD: 'en-US',
    GBP: 'en-GB',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    KRW: 'ko-KR',
    AUD: 'en-AU',
    CAD: 'en-CA',
    BRL: 'pt-BR',
    SGD: 'en-SG',
    CHF: 'de-CH',
    SEK: 'sv-SE',
    MYR: 'ms-MY',
    THB: 'th-TH',
};

function formatAmount(amount: number, currencyCode: string): string {
    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
}

type InvoiceRecord = Awaited<ReturnType<typeof getInvoices>>[number];
type OverrideRequestRecord = Awaited<ReturnType<typeof getInvoiceOverrideRequests>>[number];

export default function FinancialMatchingPage() {
    const [invoicesList, setInvoicesList] = useState<InvoiceRecord[]>([]);
    const [overrideRequests, setOverrideRequests] = useState<OverrideRequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [search, setSearch] = useState('');

    const [overrideRequestDialog, setOverrideRequestDialog] = useState<{
        invoiceId: string;
        requestType: 'place_hold' | 'clear_hold' | 'payment_reversal';
        actionLabel: string;
        reason: string;
    } | null>(null);

    const [overrideDecisionDialog, setOverrideDecisionDialog] = useState<{
        requestId: string;
        decision: 'approved' | 'rejected';
        requestType: string;
        decisionNotes: string;
        reversalReference: string;
        title: string;
        description: string;
    } | null>(null);

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const [data, overrides] = await Promise.all([
                getInvoices({
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    invoiceNumber: search || undefined,
                }),
                getInvoiceOverrideRequests({ status: 'pending', limit: 20 }),
            ]);
            setInvoicesList(data);
            setOverrideRequests(overrides);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, search]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const handleRunRules = (invoiceId: string) => {
        startTransition(async () => {
            try {
                const result = await rerunInvoiceMatch(invoiceId);
                if (!result.success) {
                    toast.error(result.error || "Failed to run deterministic matching");
                    return;
                }

                if (result.status === 'MATCHED') {
                    toast.success("Deterministic match passed", {
                        description: result.reason
                            ? getThreeWayMatchReasonLabel(result.reason)
                            : "PO, receipt, QC, and invoice evidence now align.",
                    });
                } else {
                    toast.warning("Invoice remains blocked", {
                        description: result.reason
                            ? getThreeWayMatchReasonLabel(result.reason)
                            : "The rule engine kept this invoice in review.",
                    });
                }

                await fetchInvoices();
            } catch {
                toast.error("Failed to run deterministic matching");
            }
        });
    };

    const handleDispute = (invoiceId: string) => {
        startTransition(async () => {
            try {
                const result = await updateInvoiceStatus(invoiceId, 'disputed');
                if (!result.success) {
                    toast.error(result.error || "Failed to move invoice to dispute");
                    return;
                }

                toast.warning("Invoice flagged as disputed - supplier will be notified");
                await fetchInvoices();
            } catch {
                toast.error("Failed to update invoice");
            }
        });
    };

    const handleMarkPaid = (invoiceId: string) => {
        startTransition(async () => {
            try {
                const result = await updateInvoiceStatus(invoiceId, 'paid');
                if (!result.success) {
                    toast.error(result.error || "Failed to mark invoice as paid");
                    return;
                }

                toast.success("Invoice marked as paid");
                await fetchInvoices();
            } catch {
                toast.error("Failed to update invoice");
            }
        });
    };

    const handleEscalateToHuman = (invoiceId: string) => {
        startTransition(async () => {
            try {
                const result = await escalateInvoiceToHumanReview(invoiceId);
                if (!result.success) {
                    toast.error(result.error || "Failed to route invoice to manual review");
                    return;
                }

                toast.success(result.reused ? "Review task refreshed" : "Escalated for review", {
                    description: result.reused
                        ? "An existing invoice review task was reopened in the queue."
                        : "A manual validation task now blocks the status change until the review task is closed.",
                });
                await fetchInvoices();
            } catch {
                toast.error("Failed to route invoice to manual review");
            }
        });
    };

    const handleOverrideRequest = (invoiceId: string, requestType: 'place_hold' | 'clear_hold' | 'payment_reversal') => {
        const actionLabel = requestType === 'place_hold'
            ? 'place a release hold'
            : requestType === 'clear_hold'
                ? 'clear the release hold'
                : 'reverse the payment';
        setOverrideRequestDialog({ invoiceId, requestType, actionLabel, reason: '' });
    };

    const submitOverrideRequest = async () => {
        if (!overrideRequestDialog || !overrideRequestDialog.reason.trim()) return;
        const { invoiceId, requestType, reason } = overrideRequestDialog;
        setOverrideRequestDialog(null);

        startTransition(async () => {
            try {
                const result = await requestInvoiceOverride({ invoiceId, requestType, reason });
                if (!result.success) {
                    toast.error(result.error || "Failed to route override request");
                    return;
                }

                toast.success("Dual approval request submitted", {
                    description: "A second finance approver must now approve or reject this request.",
                });
                await fetchInvoices();
            } catch {
                toast.error("Failed to route override request");
            }
        });
    };

    const handleOverrideDecision = (requestId: string, decision: 'approved' | 'rejected', requestType: string) => {
        const title = decision === 'approved' ? 'Approve Override Request' : 'Reject Override Request';
        const description = decision === 'approved'
            ? 'Provide a note for this approval. It will be recorded in the audit trail.'
            : 'Provide a reason for this rejection.';

        setOverrideDecisionDialog({
            requestId,
            decision,
            requestType,
            decisionNotes: '',
            reversalReference: '',
            title,
            description
        });
    };

    const submitOverrideDecision = async () => {
        if (!overrideDecisionDialog) return;
        const { requestId, decision, decisionNotes, reversalReference } = overrideDecisionDialog;
        setOverrideDecisionDialog(null);

        startTransition(async () => {
            try {
                const result = await reviewInvoiceOverride({
                    requestId,
                    decision,
                    decisionNotes,
                    reversalReference,
                });
                if (!result.success) {
                    toast.error(result.error || "Failed to review override request");
                    return;
                }

                toast.success(
                    decision === 'approved' ? 'Dual approval recorded' : 'Override request rejected',
                );
                await fetchInvoices();
            } catch {
                toast.error("Failed to review override request");
            }
        });
    };

    const pendingCount = invoicesList.filter((invoice) => invoice.status === 'pending').length;
    const matchedCount = invoicesList.filter((invoice) => invoice.status === 'matched' || invoice.status === 'paid').length;
    const disputedCount = invoicesList.filter((invoice) => invoice.status === 'disputed').length;
    const humanReviewCount = invoicesList.filter((invoice) => invoice.requiresHumanReview || invoice.openReviewTasks > 0).length;
    const dualApprovalCount = overrideRequests.length;

    const statusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <Badge className="bg-green-500 text-white border-transparent text-[10px] font-black uppercase">Paid</Badge>;
            case 'matched':
                return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black uppercase">Matched</Badge>;
            case 'disputed':
                return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-black uppercase">Disputed</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black uppercase">Pending</Badge>;
        }
    };

    const confidenceBadge = (invoice: InvoiceRecord) => {
        if (!invoice.confidenceLabel) {
            return null;
        }

        const isEscalated = invoice.requiresHumanReview || invoice.reviewConfidenceScore < 75;
        return (
            <Badge
                variant="outline"
                className={cn(
                    "text-[10px] font-black uppercase",
                    isEscalated
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
            >
                {invoice.reviewConfidenceScore}% · {invoice.confidenceLabel}
            </Badge>
        );
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <Scale className="h-8 w-8 text-primary" />
                        Financial Matching
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Admin console - run deterministic 3-way verification between PO, receipt, and invoice before any release.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/sourcing/exceptions">
                        <Button variant="outline" className="gap-2">
                            <AlertTriangle className="h-4 w-4" /> Exceptions
                        </Button>
                    </Link>
                    <Link href="/sourcing/invoices">
                        <Button variant="outline" className="gap-2">
                            <ArrowUpRight className="h-4 w-4" /> Invoice Records
                        </Button>
                    </Link>
                    <Button variant="outline" onClick={fetchInvoices} className="gap-2">
                        <RefreshCcw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-amber-600">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Invoices pending 3-way match</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Matched / Paid</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-emerald-600">{matchedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">3-way match verified</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Disputed</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-red-600">{disputedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requires resolution</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-rose-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Manual Review Queue</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-rose-600">{humanReviewCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Blocked until a human signs off</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                        <FileText className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-600">{invoicesList.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">In current filter</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldAlert className="h-5 w-5 text-amber-600" />
                        Dual-Approval Override Queue
                    </CardTitle>
                    <CardDescription>
                        A requester cannot approve their own finance override. Holds and payment reversals need a second approver before the invoice state can change.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {dualApprovalCount === 0 ? (
                        <p className="text-sm text-muted-foreground">No invoice overrides are waiting on a second approver.</p>
                    ) : (
                        <div className="space-y-3">
                            {overrideRequests.map((request) => (
                                <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                                {request.requestType.replace(/_/g, ' ')}
                                            </Badge>
                                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                                                Invoice {request.invoiceNumber}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">{request.reason}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Requested by {request.requestedByName} on {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            disabled={isPending}
                                            onClick={() => handleOverrideDecision(request.id, 'approved', request.requestType)}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-200 text-red-700 hover:bg-red-50"
                                            disabled={isPending}
                                            onClick={() => handleOverrideDecision(request.id, 'rejected', request.requestType)}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-1 rounded-lg border bg-card p-1">
                    {['all', 'pending', 'matched', 'disputed', 'paid'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all",
                                statusFilter === status ? "bg-primary text-white shadow" : "hover:bg-muted",
                            )}
                        >
                            {status === 'all' ? 'All' : status}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search invoice #..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="pl-8 h-9 text-sm"
                    />
                    {search ? (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-primary" /> Invoice Matching Queue
                    </CardTitle>
                    <CardDescription>
                        {loading
                            ? "Loading..."
                            : `${invoicesList.length} invoice(s). Run rules before status updates, dispute exceptions, and mark an invoice paid only after a clean match.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        {['Invoice #', 'Supplier', 'Amount', 'Status', 'Confidence', 'Date', 'Control Actions'].map((heading) => (
                                            <th
                                                key={heading}
                                                className="h-11 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoicesList.map((invoice) => (
                                        <tr
                                            key={invoice.id}
                                            className={cn(
                                                "border-b transition-colors hover:bg-muted/30",
                                                invoice.status === 'disputed' && "bg-red-50/30",
                                                invoice.status === 'matched' && "bg-emerald-50/20",
                                                invoice.status === 'paid' && "bg-green-50/20",
                                            )}
                                        >
                                            <td className="p-4 align-middle font-bold font-mono text-xs">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    {invoice.invoiceNumber}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-sm font-medium">{invoice.supplierName || 'N/A'}</td>
                                            <td className="p-4 align-middle font-black tabular-nums text-sm">
                                                {formatAmount(Number(invoice.amount) || 0, invoice.currency || 'USD')}
                                                {invoice.currency ? (
                                                    <span className="text-[10px] text-muted-foreground ml-1 font-normal">{invoice.currency}</span>
                                                ) : null}
                                            </td>
                                            <td className="p-4 align-middle">{statusBadge(invoice.status)}</td>
                                            <td className="p-4 align-middle">
                                                <div className="space-y-2">
                                                    {confidenceBadge(invoice)}
                                                    {invoice.reviewSignals?.length ? (
                                                        <p className="max-w-[220px] text-[11px] leading-5 text-muted-foreground">
                                                            {invoice.reviewSignals.slice(0, 2).join(" · ")}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[11px] text-muted-foreground">No open review blockers.</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground text-xs">
                                                {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex gap-2 flex-wrap">
                                                    <InvoiceReviewDialog invoice={invoice} />
                                                    {invoice.status === 'pending' ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                                                disabled={isPending}
                                                                onClick={() => handleRunRules(invoice.id)}
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Run Rules
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-red-700 border-red-200 hover:bg-red-50"
                                                                disabled={isPending}
                                                                onClick={() => handleDispute(invoice.id)}
                                                            >
                                                                <AlertTriangle className="h-3 w-3 mr-1" /> Dispute
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                                disabled={isPending}
                                                                onClick={() => handleEscalateToHuman(invoice.id)}
                                                            >
                                                                <ShieldAlert className="h-3 w-3 mr-1" /> Escalate
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    {invoice.status === 'matched' ? (
                                                        <>
                                                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                                                                <Lock className="mr-1 h-3 w-3" /> {invoice.releaseHold ? 'Hold Active' : 'Locked'}
                                                            </span>
                                                            {invoice.pendingOverrideRequestType ? (
                                                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                                                                    <ShieldAlert className="mr-1 h-3 w-3" /> Approval Pending
                                                                </span>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-[10px] font-bold text-rose-700 border-rose-200 hover:bg-rose-50"
                                                                    disabled={isPending}
                                                                    onClick={() => handleOverrideRequest(invoice.id, invoice.releaseHold ? 'clear_hold' : 'place_hold')}
                                                                >
                                                                    <ShieldAlert className="h-3 w-3 mr-1" /> {invoice.releaseHold ? 'Request Hold Release' : 'Request Hold'}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                                disabled={isPending}
                                                                onClick={() => handleEscalateToHuman(invoice.id)}
                                                            >
                                                                <ShieldAlert className="h-3 w-3 mr-1" /> Escalate
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-green-700 border-green-200 hover:bg-green-50"
                                                                disabled={isPending || Boolean(invoice.releaseHold) || Boolean(invoice.pendingOverrideRequestType)}
                                                                onClick={() => handleMarkPaid(invoice.id)}
                                                            >
                                                                <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    {invoice.status === 'disputed' ? (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                                disabled={isPending}
                                                                onClick={() => handleRunRules(invoice.id)}
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Run Rules
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                                disabled={isPending}
                                                                onClick={() => handleEscalateToHuman(invoice.id)}
                                                            >
                                                                <ShieldAlert className="h-3 w-3 mr-1" /> Escalate
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    {invoice.status === 'paid' ? (
                                                        <>
                                                            {invoice.reversedAt ? (
                                                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700">
                                                                    <RotateCcw className="mr-1 h-3 w-3" /> Reversed
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                                                                    <Lock className="mr-1 h-3 w-3" /> Archived
                                                                </span>
                                                            )}
                                                            {invoice.pendingOverrideRequestType ? (
                                                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                                                                    <ShieldAlert className="mr-1 h-3 w-3" /> Approval Pending
                                                                </span>
                                                            ) : !invoice.reversedAt ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-[10px] font-bold text-rose-700 border-rose-200 hover:bg-rose-50"
                                                                        disabled={isPending}
                                                                        onClick={() => handleOverrideRequest(invoice.id, 'payment_reversal')}
                                                                    >
                                                                        <RotateCcw className="h-3 w-3 mr-1" /> Request Reversal
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                                        disabled={isPending}
                                                                        onClick={() => handleOverrideRequest(invoice.id, invoice.releaseHold ? 'clear_hold' : 'place_hold')}
                                                                    >
                                                                        <ShieldAlert className="h-3 w-3 mr-1" /> {invoice.releaseHold ? 'Request Hold Release' : 'Request Hold'}
                                                                    </Button>
                                                                </>
                                                            ) : null}
                                                        </>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {invoicesList.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-muted-foreground italic">
                                                <div className="flex flex-col items-center gap-3 not-italic">
                                                    <p className="text-sm font-medium text-foreground">No invoices match the current filters.</p>
                                                    <p className="max-w-xl text-xs text-muted-foreground">
                                                        Financial Matching only processes supplier invoices. Goods receipts unlock three-way
                                                        match validation, but they do not appear in this queue until an invoice is recorded
                                                        against the order.
                                                    </p>
                                                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                                                        <Link href="/sourcing/invoices">
                                                            <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase">
                                                                Open Invoice Records
                                                            </Button>
                                                        </Link>
                                                        <Link href="/sourcing/orders">
                                                            <Button size="sm" className="h-8 text-[10px] font-bold uppercase">
                                                                Review Source Orders
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-blue-200/50 bg-blue-50/20">
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" /> How 3-Way Match Works
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
                        <div className="space-y-1">
                            <p className="font-bold text-foreground">1. Purchase Order (PO)</p>
                            <p>Verify the invoice supplier, items, and quantities match the original purchase order approved in Axiom.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-foreground">2. Goods Receipt</p>
                            <p>Confirm the physical goods were received and logged in the Goods Receiving Log with a passed QC inspection.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-foreground">3. Invoice Verification</p>
                            <p>Match invoice amounts, taxes, and currency to the PO and receipt - only then approve payment.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!overrideRequestDialog} onOpenChange={(open) => { if (!open) setOverrideRequestDialog(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Override Reason</DialogTitle>
                        <DialogDescription>
                            Enter the reason to {overrideRequestDialog?.actionLabel} for this invoice. This will be logged in the audit trail.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="req-reason">Reason <span className="text-destructive">*</span></Label>
                        <Textarea
                            id="req-reason"
                            rows={3}
                            placeholder="Describe the business justification..."
                            value={overrideRequestDialog?.reason || ''}
                            onChange={(e) => setOverrideRequestDialog((prev) => prev ? { ...prev, reason: e.target.value } : null)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOverrideRequestDialog(null)}>Cancel</Button>
                        <Button onClick={submitOverrideRequest} disabled={isPending || !overrideRequestDialog?.reason.trim()}>
                            {isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Submit Request'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!overrideDecisionDialog} onOpenChange={(open) => { if (!open) setOverrideDecisionDialog(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{overrideDecisionDialog?.title}</DialogTitle>
                        <DialogDescription>{overrideDecisionDialog?.description}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="dec-notes">Notes {overrideDecisionDialog?.decision === 'rejected' && <span className="text-destructive">*</span>}</Label>
                            <Textarea
                                id="dec-notes"
                                rows={3}
                                placeholder="Decision notes..."
                                value={overrideDecisionDialog?.decisionNotes || ''}
                                onChange={(e) => setOverrideDecisionDialog((prev) => prev ? { ...prev, decisionNotes: e.target.value } : null)}
                            />
                        </div>
                        {overrideDecisionDialog?.requestType === 'payment_reversal' && overrideDecisionDialog?.decision === 'approved' && (
                            <div className="space-y-2">
                                <Label htmlFor="rev-ref">Reversal Reference / Journal ID</Label>
                                <Input
                                    id="rev-ref"
                                    placeholder="e.g. JV-2024-001"
                                    value={overrideDecisionDialog?.reversalReference || ''}
                                    onChange={(e) => setOverrideDecisionDialog((prev) => prev ? { ...prev, reversalReference: e.target.value } : null)}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOverrideDecisionDialog(null)}>Cancel</Button>
                        <Button
                            variant={overrideDecisionDialog?.decision === 'rejected' ? 'destructive' : 'default'}
                            onClick={submitOverrideDecision}
                            disabled={isPending || (overrideDecisionDialog?.decision === 'rejected' && !overrideDecisionDialog.decisionNotes.trim())}
                        >
                            {isPending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Submit Decision'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
