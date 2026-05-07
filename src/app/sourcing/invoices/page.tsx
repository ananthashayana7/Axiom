'use client'

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInvoices } from "@/app/actions/invoices";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/components/currency-provider";
import { InvoiceReviewDialog } from "@/components/invoices/invoice-review-dialog";
import { convertCurrencyAmount } from "@/lib/finance";
import {
    FileText, CheckCircle2, Clock, AlertTriangle,
    Filter, Download, X, RefreshCcw, Globe, Calendar, Coins, BarChart3, Upload, Landmark, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceActions } from "./invoice-actions";
import { UploadInvoiceDialog } from "./upload-invoice-dialog";
import { toast } from "sonner";
import { getSuppliers } from "@/app/actions/suppliers";
import { downloadCsvFile } from "@/lib/client/download";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';

export const dynamic = 'force-dynamic';
type InvoiceRecord = Awaited<ReturnType<typeof getInvoices>>[number];

const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN', EUR: 'de-DE', USD: 'en-US', GBP: 'en-GB', JPY: 'ja-JP',
    CNY: 'zh-CN', KRW: 'ko-KR', AUD: 'en-AU', CAD: 'en-CA', BRL: 'pt-BR',
    SGD: 'en-SG', CHF: 'de-CH', SEK: 'sv-SE', MYR: 'ms-MY', THB: 'th-TH',
};

function formatAmount(amount: number, currencyCode: string): string {
    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
}

function hasFxPath(sourceCurrency: string, targetCurrency: string, preferBookRates: boolean, finance: ReturnType<typeof useCurrency>["finance"]) {
    const source = sourceCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (source === target) {
        return true;
    }

    if (preferBookRates && target === finance.reportingCurrency.toUpperCase() && Number(finance.bookRates[source] || 0) > 0) {
        return true;
    }

    const liveBase = finance.liveRates?.base?.toUpperCase();
    const liveRates = finance.liveRates?.rates;
    const sourceRate = source === liveBase ? 1 : Number(liveRates?.[source] || 0);
    const targetRate = target === liveBase ? 1 : Number(liveRates?.[target] || 0);

    if (sourceRate > 0 && targetRate > 0) {
        return true;
    }

    return target === finance.reportingCurrency.toUpperCase() && Number(finance.bookRates[source] || 0) > 0;
}

export default function InvoicesPage() {
    const [invoicesList, setInvoicesList] = useState<InvoiceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);
    const { activeCurrencyCode, displayMode, finance, ready } = useCurrency();
    const [filters, setFilters] = useState({
        invoiceNumber: '', status: 'all', country: '', continent: 'all',
        region: '', dateFrom: '', dateTo: '', currency: 'all',
    });

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getInvoices({
                invoiceNumber: filters.invoiceNumber || undefined,
                status: filters.status !== 'all' ? filters.status : undefined,
                country: filters.country || undefined,
                continent: filters.continent !== 'all' ? filters.continent : undefined,
                region: filters.region || undefined,
                dateFrom: filters.dateFrom || undefined,
                dateTo: filters.dateTo || undefined,
                currency: filters.currency !== 'all' ? filters.currency : undefined,
            });
            setInvoicesList(data);
        } finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    useEffect(() => {
        getSuppliers().then(s => setSuppliersList(s.map(sup => ({ id: sup.id, name: sup.name }))));
    }, []);

    const clearFilters = () => setFilters({ invoiceNumber: '', status: 'all', country: '', continent: 'all', region: '', dateFrom: '', dateTo: '', currency: 'all' });

    const activeFilterCount = [
        filters.invoiceNumber, filters.status !== 'all' && filters.status,
        filters.country, filters.continent !== 'all' && filters.continent,
        filters.region, filters.dateFrom, filters.dateTo, filters.currency !== 'all' && filters.currency,
    ].filter(Boolean).length;

    const exportToCSV = () => {
        if (invoicesList.length === 0) { toast.error("No data to export"); return; }
        const headers = ['Invoice #', 'Supplier', 'Status', 'Date', 'Amount', 'Currency', 'Country', 'Region', 'Continent', 'Order Ref'];
        const rows = invoicesList.map(inv => [
            inv.invoiceNumber, inv.supplierName || 'N/A', inv.status,
            new Date(inv.createdAt).toLocaleDateString(),
            Number(inv.amount).toFixed(2),
            inv.currency || 'INR', inv.country || inv.supplierCountry || 'N/A',
            inv.region || 'N/A', inv.continent || 'N/A', (inv.orderId || '').slice(0, 8),
        ]);
        downloadCsvFile(`axiom_invoices_${new Date().toISOString().split('T')[0]}.csv`, [headers, ...rows]);
        toast.success("Invoices exported to CSV");
    };

    const exportToPDF = () => {
        if (invoicesList.length === 0) { toast.error("No data to export"); return; }
        // Sanitize function to prevent XSS when inserting into HTML
        const escapeHtml = (str: string) =>
            String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');

        const rows = invoicesList.map(inv => {
            const currency = inv.currency || 'INR';
            return `<tr><td>${escapeHtml(inv.invoiceNumber)}</td><td>${escapeHtml(inv.supplierName || 'N/A')}</td><td>${escapeHtml((inv.status || '').toUpperCase())}</td><td>${escapeHtml(new Date(inv.createdAt).toLocaleDateString())}</td><td>${escapeHtml(formatAmount(Number(inv.amount) || 0, currency))} ${escapeHtml(currency)}</td><td>${escapeHtml(inv.country || inv.supplierCountry || 'N/A')}</td><td>${escapeHtml(inv.region || 'N/A')}</td><td>${escapeHtml(inv.continent || 'N/A')}</td></tr>`;
        }).join('');
        const html = `<!DOCTYPE html><html><head><title>Axiom — Invoice Report</title><style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:22px;margin-bottom:4px}p{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f3f4f6;padding:8px 12px;text-align:left;border:1px solid #e5e7eb;font-weight:700;text-transform:uppercase;font-size:10px}td{padding:8px 12px;border:1px solid #e5e7eb}tr:nth-child(even){background:#f9fafb}</style></head><body><h1>Axiom — Invoice Ledger</h1><p>Generated: ${new Date().toLocaleString()} | Records: ${invoicesList.length} | Amounts in original invoice currencies</p><table><thead><tr><th>Invoice #</th><th>Supplier</th><th>Status</th><th>Date</th><th>Amount</th><th>Country</th><th>Region</th><th>Continent</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        toast.success("PDF print dialog opened");
    };

    // Group totals by currency to show multi-currency summary
    const currencyTotals = invoicesList.reduce((acc: Record<string, number>, inv) => {
        const c = inv.currency || 'INR';
        acc[c] = (acc[c] || 0) + (Number(inv.amount) || 0);
        return acc;
    }, {});
    const currencyTotalEntries = Object.entries(currencyTotals);
    const reviewQueueCount = invoicesList.filter(inv => inv.requiresHumanReview || Number(inv.openReviewTasks || 0) > 0).length;
    const targetLensCurrency = displayMode === 'reporting' ? finance.reportingCurrency : activeCurrencyCode;
    const preferBookRates = displayMode === 'reporting';
    const lensLabel = !ready
        ? 'Loading currency lens'
        : displayMode === 'reporting'
            ? `${finance.reportingCurrency} Book View`
            : `${activeCurrencyCode} Local View`;
    const convertedExposureTotal = invoicesList.reduce((sum, inv) => (
        sum + convertCurrencyAmount(
            Number(inv.amount) || 0,
            inv.currency || finance.defaultCurrency,
            targetLensCurrency,
            finance,
            { preferBookRates },
        )
    ), 0);
    const coveredInvoices = invoicesList.filter((inv) => hasFxPath(
        inv.currency || finance.defaultCurrency,
        targetLensCurrency,
        preferBookRates,
        finance,
    )).length;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        Invoice Management
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">Filter, track and export invoices across all regions.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/sourcing/exceptions">
                        <Button variant="outline" className="gap-2"><AlertTriangle className="h-4 w-4" /> Exceptions</Button>
                    </Link>
                    <Button onClick={() => setShowUpload(true)} className="gap-2"><Upload className="h-4 w-4" /> Upload Invoice</Button>
                    <Button variant="outline" onClick={fetchInvoices} className="gap-2"><RefreshCcw className="h-4 w-4" /> Refresh</Button>
                    <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 relative">
                        <Filter className="h-4 w-4" /> Filters
                        {activeFilterCount > 0 && <Badge className="ml-1 h-5 w-5 p-0 text-[10px] flex items-center justify-center">{activeFilterCount}</Badge>}
                    </Button>
                    <Button variant="outline" onClick={exportToCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
                    <Button variant="outline" onClick={exportToPDF} className="gap-2"><FileText className="h-4 w-4" /> PDF</Button>
                </div>
            </div>

            <Card className="border-slate-200 bg-slate-50/70">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Landmark className="h-4 w-4 text-primary" />
                        Currency and review lens
                    </CardTitle>
                    <CardDescription>
                        Source invoice amounts stay untouched. The active lens changes display and rollups without rewriting supplier documents or country-specific tax evidence.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Active lens</p>
                        <p className="mt-2 text-lg font-black text-foreground">{lensLabel}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {displayMode === 'reporting'
                                ? "Stable reporting-book rates for finance rollups."
                                : "User-local FX view for regional operators and procurement teams."}
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Converted exposure</p>
                        <p className="mt-2 text-lg font-black text-foreground">{formatAmount(convertedExposureTotal, targetLensCurrency)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {coveredInvoices}/{invoicesList.length || 0} visible invoices have active FX coverage in this lens.
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Tax and release posture</p>
                        <p className="mt-2 text-lg font-black text-foreground">Source-country review</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            VAT, GST, and regional evidence stay tied to the original invoice and supplier country. Review the source document before release when tax handling is jurisdiction-sensitive.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Filter Panel */}
            {showFilters && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3 pt-4 px-6">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2"><Filter className="h-4 w-4" /> Advanced Filters</CardTitle>
                            <div className="flex gap-2">
                                {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs h-7"><X className="h-3 w-3" /> Clear all</Button>}
                                <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)} className="h-7 w-7 p-0"><X className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-6 pb-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Invoice #</Label>
                                <Input placeholder="Search invoice..." value={filters.invoiceNumber} onChange={e => setFilters(f => ({ ...f, invoiceNumber: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
                                <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                    <option value="all">All Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="matched">Matched</option>
                                    <option value="disputed">Disputed</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Continent</Label>
                                <select value={filters.continent} onChange={e => setFilters(f => ({ ...f, continent: e.target.value }))} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                    <option value="all">All Continents</option>
                                    <option value="Europe">Europe</option>
                                    <option value="Asia">Asia</option>
                                    <option value="Americas">Americas</option>
                                    <option value="Africa">Africa</option>
                                    <option value="Oceania">Oceania</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Country</Label>
                                <Input placeholder="e.g. Germany, India..." value={filters.country} onChange={e => setFilters(f => ({ ...f, country: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Region / Zone</Label>
                                <Input placeholder="e.g. EMEA, APAC..." value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground">Currency</Label>
                                <select value={filters.currency} onChange={e => setFilters(f => ({ ...f, currency: e.target.value }))} className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                                    <option value="all">All Currencies</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> From Date</Label>
                                <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="h-9 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> To Date</Label>
                                <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="h-9 text-sm" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoicesList.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Visible records</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoicesList.filter(i => i.status === 'pending').length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Matched & Verified</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoicesList.filter(i => i.status === 'matched' || i.status === 'paid').length}</div>
                        <p className="text-xs text-muted-foreground mt-1">3-way verified</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Manual Review Queue</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reviewQueueCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Escalated or low-confidence invoices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {currencyTotalEntries.length === 0 ? (
                            <div className="text-2xl font-bold tabular-nums">—</div>
                        ) : currencyTotalEntries.length === 1 ? (
                            <div className="text-2xl font-bold tabular-nums">{formatAmount(currencyTotalEntries[0][1], currencyTotalEntries[0][0])}</div>
                        ) : (
                            <div className="space-y-1">
                                {currencyTotalEntries.map(([c, amt]) => (
                                    <div key={c} className="text-sm font-bold tabular-nums">{formatAmount(amt, c)}</div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">In original invoice currencies</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            {!loading && invoicesList.length > 0 && (() => {
                const STATUS_COLORS: Record<string, string> = { pending: '#f59e0b', matched: '#10b981', disputed: '#ef4444', paid: '#3b82f6' };
                const statusData = Object.entries(
                    invoicesList.reduce((acc: Record<string, number>, inv) => {
                        const s = inv.status || 'unknown';
                        acc[s] = (acc[s] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: STATUS_COLORS[name] || '#94a3b8' }));

                // This chart uses invoice counts rather than summed values so mixed currencies are never combined.
                const continentData = Object.entries(
                    invoicesList.reduce((acc: Record<string, number>, inv) => {
                        const c = inv.continent || 'Unknown';
                        acc[c] = (acc[c] || 0) + 1;
                        return acc;
                    }, {})
                ).map(([name, value]) => ({ name, count: value })).sort((a, b) => b.count - a.count);

                // Monthly trend from invoice dates
                const monthlyMap: Record<string, number> = {};
                invoicesList.forEach(inv => {
                    const d = new Date(inv.createdAt);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthlyMap[key] = (monthlyMap[key] || 0) + 1;
                });
                const trendData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

                return (
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Status Distribution */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" /> Status Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name} (${value})`}>
                                            {statusData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Amount by Continent */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" /> Amount by Region
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={continentData} layout="vertical" margin={{ left: 0, right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                                        <Tooltip formatter={(value: number | string | undefined) => `${Number(value || 0)} invoices`} />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Monthly Trend */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" /> Invoice Volume Trend
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={trendData} margin={{ left: 0, right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Invoices" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                );
            })()}

            {/* Invoice Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Invoice Ledger</CardTitle>
                    <CardDescription>
                        {loading ? "Loading invoices..." : `${invoicesList.length} invoice(s) found — amounts shown in their original currency`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            {['Invoice #', 'Supplier', 'Status', 'Country', 'Region', 'Continent', 'Date', 'Amount', 'Actions'].map(h => (
                                                <th key={h} className="h-11 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoicesList.map((invoice) => (
                                            <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle font-bold">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        {invoice.invoiceNumber}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle text-sm font-medium">{invoice.supplierName || 'N/A'}</td>
                                                <td className="p-4 align-middle">
                                                    <Badge className={cn("uppercase text-[10px] font-black border",
                                                        invoice.status === 'paid' && "bg-green-500 text-white border-transparent",
                                                        invoice.status === 'matched' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                                                        invoice.status === 'disputed' && "bg-red-100 text-red-700 border-red-200",
                                                        invoice.status === 'pending' && "bg-amber-100 text-amber-700 border-amber-200",
                                                    )}>{invoice.status}</Badge>
                                                </td>
                                                <td className="p-4 align-middle text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1"><Globe className="h-3 w-3" />{invoice.country || invoice.supplierCountry || '—'}</div>
                                                </td>
                                                <td className="p-4 align-middle text-sm text-muted-foreground">{invoice.region || '—'}</td>
                                                <td className="p-4 align-middle text-sm text-muted-foreground">{invoice.continent || '—'}</td>
                                                <td className="p-4 align-middle text-muted-foreground text-sm">{new Date(invoice.createdAt).toLocaleDateString()}</td>
                                                <td className="p-4 align-middle font-black tabular-nums">
                                                    {formatAmount(Number(invoice.amount) || 0, invoice.currency || 'INR')}
                                                    {invoice.currency && <span className="text-[10px] text-muted-foreground ml-1 font-normal">{invoice.currency}</span>}
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <div className="flex justify-end gap-2 flex-wrap">
                                                        <InvoiceReviewDialog invoice={invoice} />
                                                        <InvoiceActions
                                                            invoiceId={invoice.id}
                                                            status={invoice.status}
                                                            releaseHold={invoice.releaseHold}
                                                            reversedAt={invoice.reversedAt}
                                                            pendingOverrideRequestType={invoice.pendingOverrideRequestType}
                                                            onChanged={fetchInvoices}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {invoicesList.length === 0 && (
                                            <tr><td colSpan={9} className="p-12 text-center text-muted-foreground italic">No invoices found matching the current filters.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadInvoiceDialog
                open={showUpload}
                onOpenChange={setShowUpload}
                onSuccess={fetchInvoices}
                suppliers={suppliersList}
            />
        </div>
    );
}
