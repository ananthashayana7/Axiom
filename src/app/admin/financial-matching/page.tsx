'use client'

import { useState, useEffect, useCallback, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInvoices } from "@/app/actions/invoices";
import { updateInvoiceStatus } from "@/app/actions/invoices";
import {
    CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCcw,
    FileText, TrendingUp, DollarSign, Filter, X, Scale
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN', EUR: 'de-DE', USD: 'en-US', GBP: 'en-GB', JPY: 'ja-JP',
    CNY: 'zh-CN', KRW: 'ko-KR', AUD: 'en-AU', CAD: 'en-CA', BRL: 'pt-BR',
    SGD: 'en-SG', CHF: 'de-CH', SEK: 'sv-SE', MYR: 'ms-MY', THB: 'th-TH',
};

function formatAmount(amount: number, currencyCode: string): string {
    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency', currency: currencyCode,
            minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(amount);
    } catch {
        return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
}

export default function FinancialMatchingPage() {
    const [invoicesList, setInvoicesList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    const [search, setSearch] = useState('');

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getInvoices({
                status: statusFilter !== 'all' ? statusFilter : undefined,
                invoiceNumber: search || undefined,
            });
            setInvoicesList(data);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, search]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const handleMatch = (invoiceId: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatus(invoiceId, 'matched');
                toast.success("Invoice matched and verified (3-way match complete)");
                await fetchInvoices();
            } catch {
                toast.error("Failed to update invoice");
            }
        });
    };

    const handleDispute = (invoiceId: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatus(invoiceId, 'disputed');
                toast.warning("Invoice flagged as disputed — supplier will be notified");
                await fetchInvoices();
            } catch {
                toast.error("Failed to update invoice");
            }
        });
    };

    const handleMarkPaid = (invoiceId: string) => {
        startTransition(async () => {
            try {
                await updateInvoiceStatus(invoiceId, 'paid');
                toast.success("Invoice marked as paid");
                await fetchInvoices();
            } catch {
                toast.error("Failed to update invoice");
            }
        });
    };

    const pendingCount = invoicesList.filter(i => i.status === 'pending').length;
    const matchedCount = invoicesList.filter(i => i.status === 'matched' || i.status === 'paid').length;
    const disputedCount = invoicesList.filter(i => i.status === 'disputed').length;

    const statusBadge = (status: string) => {
        switch (status) {
            case 'paid': return <Badge className="bg-green-500 text-white border-transparent text-[10px] font-black uppercase">Paid</Badge>;
            case 'matched': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black uppercase">Matched</Badge>;
            case 'disputed': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-black uppercase">Disputed</Badge>;
            default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black uppercase">Pending</Badge>;
        }
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
                        Admin console — perform 3-way match verification between PO, receipt, and invoice. Approve, dispute, or mark invoices as paid.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchInvoices} className="gap-2">
                    <RefreshCcw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
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

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-1 rounded-lg border bg-card p-1">
                    {['all', 'pending', 'matched', 'disputed', 'paid'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all",
                                statusFilter === s ? "bg-primary text-white shadow" : "hover:bg-muted")}>
                            {s === 'all' ? 'All' : s}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search invoice #..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 h-9 text-sm" />
                    {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
                </div>
            </div>

            {/* Invoice Matching Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-primary" /> Invoice Matching Queue
                    </CardTitle>
                    <CardDescription>
                        {loading ? "Loading..." : `${invoicesList.length} invoice(s). Use Match to verify 3-way match, Dispute to flag discrepancies, Mark Paid to close.`}
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
                                        {['Invoice #', 'Supplier', 'Amount', 'Status', 'Date', 'Match Actions'].map(h => (
                                            <th key={h} className="h-11 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoicesList.map((invoice: any) => (
                                        <tr key={invoice.id} className={cn("border-b transition-colors hover:bg-muted/30",
                                            invoice.status === 'disputed' && "bg-red-50/30",
                                            invoice.status === 'matched' && "bg-emerald-50/20",
                                            invoice.status === 'paid' && "bg-green-50/20",
                                        )}>
                                            <td className="p-4 align-middle font-bold font-mono text-xs">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    {invoice.invoiceNumber}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-sm font-medium">{invoice.supplierName || 'N/A'}</td>
                                            <td className="p-4 align-middle font-black tabular-nums text-sm">
                                                {formatAmount(Number(invoice.amount) || 0, invoice.currency || 'USD')}
                                                {invoice.currency && <span className="text-[10px] text-muted-foreground ml-1 font-normal">{invoice.currency}</span>}
                                            </td>
                                            <td className="p-4 align-middle">{statusBadge(invoice.status)}</td>
                                            <td className="p-4 align-middle text-muted-foreground text-xs">
                                                {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex gap-2 flex-wrap">
                                                    {invoice.status === 'pending' && (
                                                        <>
                                                            <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                                                disabled={isPending} onClick={() => handleMatch(invoice.id)}>
                                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Match
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-red-700 border-red-200 hover:bg-red-50"
                                                                disabled={isPending} onClick={() => handleDispute(invoice.id)}>
                                                                <AlertTriangle className="h-3 w-3 mr-1" /> Dispute
                                                            </Button>
                                                        </>
                                                    )}
                                                    {invoice.status === 'matched' && (
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-green-700 border-green-200 hover:bg-green-50"
                                                            disabled={isPending} onClick={() => handleMarkPaid(invoice.id)}>
                                                            <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
                                                        </Button>
                                                    )}
                                                    {invoice.status === 'disputed' && (
                                                        <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                            disabled={isPending} onClick={() => handleMatch(invoice.id)}>
                                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Re-Match
                                                        </Button>
                                                    )}
                                                    {(invoice.status === 'paid') && (
                                                        <span className="text-[10px] text-muted-foreground italic">Closed</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {invoicesList.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                                No invoices match the current filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3-Way Match Explanation */}
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
                            <p>Match invoice amounts, taxes, and currency to the PO and receipt — only then approve payment.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
