'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getIntelligenceData, getFilterOptions, type AnalyticsFilters } from '@/app/actions/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Line, PieChart, Pie, Cell, Area,
    ScatterChart, Scatter, ZAxis, ComposedChart, Legend, RadarChart,
    Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
    Download, Filter, BarChart3, TrendingUp, Factory, Boxes, Radar as RadarIcon,
    DollarSign, FileText, Globe, PieChart as PieChartIcon, Activity,
    ArrowUpRight, ArrowDownRight, Layers, Receipt, X, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

/* ─── Color Palettes ─── */
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#e11d48', '#a855f7', '#22c55e', '#eab308'];
const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b', matched: '#10b981', disputed: '#ef4444', paid: '#3b82f6',
    draft: '#94a3b8', pending_approval: '#f59e0b', approved: '#10b981', rejected: '#ef4444',
    sent: '#06b6d4', fulfilled: '#22c55e', cancelled: '#6b7280',
};

/* Currency formatting — auto-detected via geo-locale, uses Intl for any currency */
const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN', EUR: 'de-DE', USD: 'en-US', GBP: 'en-GB', JPY: 'ja-JP',
    CNY: 'zh-CN', KRW: 'ko-KR', AUD: 'en-AU', CAD: 'en-CA', BRL: 'pt-BR',
    MXN: 'es-MX', ZAR: 'en-ZA', AED: 'ar-AE', SGD: 'en-SG', CHF: 'de-CH',
    SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK', PLN: 'pl-PL', TRY: 'tr-TR',
    THB: 'th-TH', MYR: 'ms-MY', IDR: 'id-ID', PHP: 'en-PH', RUB: 'ru-RU',
    SAR: 'ar-SA', PKR: 'en-PK', BDT: 'bn-BD', NGN: 'en-NG', KES: 'en-KE',
};
const CURRENCY_SYMBOL: Record<string, string> = {
    INR: '₹', EUR: '€', USD: '$', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩',
    AUD: 'A$', CAD: 'C$', BRL: 'R$', MXN: 'MX$', ZAR: 'R', AED: 'د.إ',
    SGD: 'S$', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł',
    TRY: '₺', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱', RUB: '₽',
    SAR: '﷼', PKR: '₨', BDT: '৳', NGN: '₦', KES: 'KSh',
};
function fmt(v: number, c: string) {
    const locale = CURRENCY_LOCALE[c] || 'en-US';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v); }
    catch { return `${CURRENCY_SYMBOL[c] || '$'}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; }
}
function fmtCompact(v: number, c: string) {
    const sym = CURRENCY_SYMBOL[c] || '$';
    const abs = Math.abs(v);
    if (c === 'INR') {
        if (abs >= 1e7) return `${sym}${(v / 1e7).toFixed(2)}Cr`;
        if (abs >= 1e5) return `${sym}${(v / 1e5).toFixed(2)}L`;
        if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}K`;
        return `${sym}${v.toFixed(0)}`;
    }
    if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}K`;
    return `${sym}${v.toFixed(0)}`;
}

/* ─── Multi-select Dropdown Component ─── */
function MultiSelect({ label, options, selected, onChange, icon }: {
    label: string; options: { value: string; label: string }[]; selected: string[];
    onChange: (v: string[]) => void; icon?: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const toggle = (val: string) => {
        onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
    };
    return (
        <div className="relative">
            <button onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-xs font-medium hover:bg-muted transition-colors min-w-[120px]">
                {icon}
                <span className="truncate">{selected.length ? `${label} (${selected.length})` : label}</span>
                {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute z-50 mt-1 w-56 max-h-60 overflow-auto rounded-lg border bg-card shadow-lg">
                        {selected.length > 0 && (
                            <button onClick={() => onChange([])}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950 border-b">
                                Clear all
                            </button>
                        )}
                        {options.map(o => (
                            <button key={o.value} onClick={() => toggle(o.value)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2 ${selected.includes(o.value) ? 'bg-primary/10 font-semibold' : ''}`}>
                                <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${selected.includes(o.value) ? 'bg-primary border-primary text-white' : 'border-muted-foreground/30'}`}>
                                    {selected.includes(o.value) && <span className="text-[10px]">✓</span>}
                                </span>
                                <span className="truncate">{o.label}</span>
                            </button>
                        ))}
                        {options.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No options</p>}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── KPI Card ─── */
function KpiCard({ title, value, subtitle, icon, color, trend, href }: {
    title: string; value: string; subtitle?: string; icon: React.ReactNode; color: string; trend?: { value: number; label: string }; href?: string;
}) {
    const card = (
        <Card className={`border-l-4 ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} style={{ borderLeftColor: color }}>
            <CardHeader className="pb-1 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '18' }}>
                        {icon}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="text-xl font-black tracking-tight">{value}</div>
                {(subtitle || trend) && (
                    <div className="flex items-center gap-2 mt-1">
                        {trend && (
                            <span className={`flex items-center text-[10px] font-bold ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {Math.abs(trend.value).toFixed(1)}%
                            </span>
                        )}
                        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
    return href ? <Link href={href}>{card}</Link> : card;
}

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label, currency }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold mb-1">{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-muted-foreground">{p.name}:</span>
                    <span className="font-bold">{typeof p.value === 'number' && p.value > 100 ? fmt(p.value, currency) : p.value}</span>
                </p>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
    const [data, setData] = useState<Awaited<ReturnType<typeof getIntelligenceData>> | null>(null);
    const [filterOptions, setFilterOptions] = useState<{ regions: string[]; suppliers: { id: string; name: string }[]; categories: string[]; countries: string[] }>({ regions: [], suppliers: [], categories: [], countries: [] });
    const [loading, setLoading] = useState(true);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [trendView, setTrendView] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
    const currency = 'INR';

    // Filter state
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedInvoiceStatuses, setSelectedInvoiceStatuses] = useState<string[]>([]);
    const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<string[]>([]);

    const activeFilterCount = [dateFrom, dateTo, selectedRegions.length, selectedSuppliers.length, selectedCategories.length, selectedInvoiceStatuses.length, selectedOrderStatuses.length].filter(Boolean).length;

    const buildFilters = useCallback((): AnalyticsFilters => ({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        regions: selectedRegions.length ? selectedRegions : undefined,
        supplierIds: selectedSuppliers.length ? selectedSuppliers : undefined,
        categories: selectedCategories.length ? selectedCategories : undefined,
        invoiceStatuses: selectedInvoiceStatuses.length ? selectedInvoiceStatuses : undefined,
        orderStatuses: selectedOrderStatuses.length ? selectedOrderStatuses : undefined,
    }), [dateFrom, dateTo, selectedRegions, selectedSuppliers, selectedCategories, selectedInvoiceStatuses, selectedOrderStatuses]);

    const fetchData = useCallback(async (filters: AnalyticsFilters = {}) => {
        setLoading(true);
        try {
            const result = await getIntelligenceData(filters);
            setData(result);
        } catch { /* handled in action */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        Promise.all([getFilterOptions(), getIntelligenceData()]).then(([opts, result]) => {
            setFilterOptions(opts);
            setData(result);
            setLoading(false);
        });
    }, []);

    const applyFilters = () => { fetchData(buildFilters()); };
    const resetFilters = () => {
        setDateFrom(''); setDateTo(''); setSelectedRegions([]); setSelectedSuppliers([]);
        setSelectedCategories([]); setSelectedInvoiceStatuses([]); setSelectedOrderStatuses([]);
        fetchData({});
    };

    // Derived chart data (amounts shown in detected currency — no conversion)
    const trendData = useMemo(() => {
        if (!data) return [];
        if (trendView === 'yearly') return data.yearlyTrend.map(r => ({ label: r.year, spend: r.spend, savings: r.savings, orders: r.orders }));
        if (trendView === 'quarterly') return data.quarterlyTrend.map(r => ({ label: r.quarter, spend: r.spend, savings: r.savings, orders: r.orders }));
        return data.spendTrend.map(r => ({ label: r.month, spend: r.spend, savings: r.savings, orders: r.orders }));
    }, [data, trendView]);

    const categoryPieData = useMemo(() => (data?.spendByCategory || []).map(r => ({ name: r.category, value: r.spend })), [data]);
    const invoicePieData = useMemo(() => (data?.invoiceDistribution || []).map(r => ({ name: r.status, value: r.count })), [data]);
    const orderPieData = useMemo(() => (data?.orderDistribution || []).map(r => ({ name: r.status, value: r.count })), [data]);
    const regionBarData = useMemo(() => (data?.spendByRegion || []).map(r => ({ name: r.region, spend: r.spend, suppliers: r.supplierCount })), [data]);
    const supplierBarData = useMemo(() => (data?.spendBySupplier || []).slice(0, 15).map(r => ({ name: r.name, spend: r.spend, savings: r.savings, orders: r.orders })), [data]);
    const savingsData = useMemo(() => (data?.savingsByType || []).map(r => ({ name: r.type, value: r.totalSavings, count: r.count })), [data]);
    const varianceData = useMemo(() => (data?.priceVariance || []).map(r => ({ month: r.month, initial: r.avgInitial, actual: r.avgActual, variance: r.variance })), [data]);
    const scatterData = useMemo(() => (data?.supplierPerformance || []).map(r => ({ ...r, spend: r.spend })), [data]);
    const topPartsData = useMemo(() => (data?.topParts || []).slice(0, 15).map(r => ({ name: r.name, spend: r.totalSpend, qty: r.totalQty, avgPrice: r.avgUnitPrice })), [data]);
    const countryData = useMemo(() => (data?.spendByCountry || []).slice(0, 15).map(r => ({ name: r.country, spend: r.spend, suppliers: r.supplierCount, orders: r.orderCount })), [data]);
    const invoiceRegionData = useMemo(() => (data?.invoiceByRegion || []).map(r => ({ name: r.region, amount: r.totalAmount, count: r.count })), [data]);
    const contractData = useMemo(() => {
        if (!data?.contractAnalysis?.length) return [];
        const grouped: Record<string, number> = {};
        data.contractAnalysis.forEach(r => { grouped[r.type] = (grouped[r.type] || 0) + r.totalValue; });
        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }, [data]);

    // Radar data for top 5 supplier comparison
    const radarData = useMemo(() => {
        if (!data?.supplierPerformance?.length) return [];
        const top5 = data.supplierPerformance.slice(0, 5);
        const dimensions = ['riskScore', 'performanceScore', 'esgScore', 'financialScore'] as const;
        return dimensions.map(dim => {
            const entry: Record<string, any> = { metric: dim.replace('Score', '').replace(/([A-Z])/g, ' $1').trim() };
            top5.forEach(s => { entry[s.name] = s[dim]; });
            return entry;
        });
    }, [data]);
    const radarSupplierNames = useMemo(() => (data?.supplierPerformance || []).slice(0, 5).map(s => s.name), [data]);

    /* ─── CSV Export ─── */
    const exportToCSV = () => {
        if (!data) return;
        const rows: string[] = ['Axiom Intelligence Hub Export', `Currency: ${currency}`, `Generated: ${new Date().toISOString()}`, ''];
        rows.push('=== KPIs ===');
        rows.push(`Total Spend,${fmt(data.kpis.totalSpend, currency)}`);
        rows.push(`Total Savings,${fmt(data.kpis.totalSavings, currency)}`);
        rows.push(`Savings Rate,${data.kpis.savingsRate}%`);
        rows.push(`Order Count,${data.kpis.orderCount}`);
        rows.push(`Supplier Count,${data.kpis.supplierCount}`);
        rows.push(`Invoice Count,${data.kpis.invoiceCount}`);
        rows.push('');
        rows.push('=== Spend by Category ===');
        rows.push('Category,Spend');
        data.spendByCategory.forEach(r => rows.push(`${r.category},${r.spend.toFixed(2)}`));
        rows.push('');
        rows.push('=== Spend by Supplier ===');
        rows.push('Supplier,Spend,Orders,Savings');
        data.spendBySupplier.forEach(r => rows.push(`${r.name},${r.spend.toFixed(2)},${r.orders},${r.savings.toFixed(2)}`));
        rows.push('');
        rows.push('=== Spend Trend ===');
        rows.push('Month,Spend,Savings,Orders');
        data.spendTrend.forEach(r => rows.push(`${r.month},${r.spend.toFixed(2)},${r.savings.toFixed(2)},${r.orders}`));
        rows.push('');
        rows.push('=== Top Parts ===');
        rows.push('Part,Category,Spend,Quantity,Avg Price');
        data.topParts.forEach(r => rows.push(`${r.name},${r.category},${r.totalSpend.toFixed(2)},${r.totalQty},${r.avgUnitPrice.toFixed(2)}`));

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `axiom_intelligence_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Intelligence report exported');
    };

    /* ─── Loading State ─── */
    if (loading && !data) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground animate-pulse">Initializing Intelligence Hub...</p>
                </div>
            </div>
        );
    }

    const kpis = data?.kpis;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-6 space-y-5">
            {/* ─── Header ─── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" /> Intelligence Hub
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Enterprise procurement analytics with recorded-value reporting and multi-dimensional filtering</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Trend Toggle */}
                    <div className="flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
                        {(['monthly', 'quarterly', 'yearly'] as const).map(v => (
                            <button key={v} onClick={() => setTrendView(v)}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold capitalize transition-all ${trendView === v ? 'bg-primary text-white shadow' : 'hover:bg-muted'}`}>{v}</button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setFiltersOpen(!filtersOpen)}>
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                        {activeFilterCount > 0 && <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">{activeFilterCount}</Badge>}
                    </Button>
                    <Button size="sm" className="gap-1.5 text-xs" onClick={exportToCSV}>
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                </div>
            </div>

            {/* ─── Filter Panel ─── */}
            {filtersOpen && (
                <Card className="border-primary/20 bg-primary/[0.02]">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
                                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" />
                            </div>
                            <MultiSelect label="Region" icon={<Globe className="h-3 w-3" />}
                                options={filterOptions.regions.map(r => ({ value: r, label: r }))}
                                selected={selectedRegions} onChange={setSelectedRegions} />
                            <MultiSelect label="Supplier" icon={<Factory className="h-3 w-3" />}
                                options={filterOptions.suppliers.map(s => ({ value: s.id, label: s.name }))}
                                selected={selectedSuppliers} onChange={setSelectedSuppliers} />
                            <MultiSelect label="Category" icon={<Boxes className="h-3 w-3" />}
                                options={filterOptions.categories.map(c => ({ value: c, label: c }))}
                                selected={selectedCategories} onChange={setSelectedCategories} />
                            <MultiSelect label="Invoice Status" icon={<Receipt className="h-3 w-3" />}
                                options={['pending', 'matched', 'disputed', 'paid'].map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                                selected={selectedInvoiceStatuses} onChange={setSelectedInvoiceStatuses} />
                            <MultiSelect label="Order Status" icon={<FileText className="h-3 w-3" />}
                                options={['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'fulfilled', 'cancelled'].map(s => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
                                selected={selectedOrderStatuses} onChange={setSelectedOrderStatuses} />
                            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={applyFilters}>
                                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Apply
                            </Button>
                            {activeFilterCount > 0 && (
                                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-red-500 hover:text-red-600" onClick={resetFilters}>
                                    <X className="h-3 w-3" /> Reset
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── KPI Row ─── */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
                <KpiCard title="Total Spend" value={fmtCompact(kpis?.totalSpend || 0, currency)} icon={<DollarSign className="h-4 w-4" style={{ color: '#3b82f6' }} />} color="#3b82f6" subtitle={`${kpis?.orderCount || 0} orders`} href="/sourcing/orders" />
                <KpiCard title="Savings" value={fmtCompact(kpis?.totalSavings || 0, currency)} icon={<TrendingUp className="h-4 w-4" style={{ color: '#10b981' }} />} color="#10b981" trend={{ value: kpis?.savingsRate || 0, label: 'rate' }} href="/savings" />
                <KpiCard title="Savings Rate" value={`${kpis?.savingsRate || 0}%`} icon={<ArrowUpRight className="h-4 w-4" style={{ color: '#8b5cf6' }} />} color="#8b5cf6" subtitle="of initial quotes" href="/savings" />
                <KpiCard title="Avg Order" value={fmtCompact(kpis?.avgOrderValue || 0, currency)} icon={<Layers className="h-4 w-4" style={{ color: '#f59e0b' }} />} color="#f59e0b" href="/sourcing/orders" />
                <KpiCard title="Suppliers" value={String(kpis?.supplierCount || 0)} icon={<Factory className="h-4 w-4" style={{ color: '#06b6d4' }} />} color="#06b6d4" subtitle="active in period" href="/suppliers" />
                <KpiCard title="Orders" value={String(kpis?.orderCount || 0)} icon={<FileText className="h-4 w-4" style={{ color: '#ec4899' }} />} color="#ec4899" href="/sourcing/orders" />
                <KpiCard title="Invoices" value={String(kpis?.invoiceCount || 0)} icon={<Receipt className="h-4 w-4" style={{ color: '#f97316' }} />} color="#f97316" subtitle={fmtCompact(kpis?.invoiceTotal || 0, currency)} href="/sourcing/invoices" />
                <KpiCard title="Categories" value={String(data?.spendByCategory?.length || 0)} icon={<PieChartIcon className="h-4 w-4" style={{ color: '#84cc16' }} />} color="#84cc16" subtitle="tracked" href="/sourcing/parts" />
            </div>

            {/* ═══ CHART GRID ═══ */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">

                {/* ── 1. Spend Trend (full width) ─── */}
                <Card className="lg:col-span-2 xl:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-600" /> Spend &amp; Savings Trend</CardTitle>
                        <CardDescription className="text-xs">
                            {trendView === 'monthly' ? 'Monthly' : trendView === 'quarterly' ? 'Quarterly' : 'Yearly'} spend trajectory with savings overlay
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => fmtCompact(v, currency)} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Area type="monotone" dataKey="spend" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} name="Spend" />
                                <Bar dataKey="savings" fill="#10b981" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="Savings" barSize={trendView === 'monthly' ? 12 : 20} />
                                <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} dot={false} yAxisId="right" name="Orders" />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 2. Category Pie Chart ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-amber-600" /> Category Distribution</CardTitle>
                        <CardDescription className="text-xs">Spend concentration across categories</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {categoryPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 3. Top Suppliers Bar ─── */}
                <Card className="lg:col-span-1 xl:col-span-1">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2"><Factory className="h-4 w-4 text-emerald-600" /> Top Suppliers</CardTitle>
                            <Badge variant="outline" className="text-[10px]">by spend</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={supplierBarData} layout="vertical" margin={{ left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="spend" fill="#059669" radius={[0, 4, 4, 0]} name="Spend" />
                                <Bar dataKey="savings" fill="#10b981" fillOpacity={0.5} radius={[0, 4, 4, 0]} name="Savings" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 4. Invoice Status Pie ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-600" /> Invoice Status</CardTitle>
                        <CardDescription className="text-xs">Distribution by status</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={invoicePieData} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }: any) => `${name} (${value})`}>
                                    {invoicePieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 5. Order Status Donut ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-cyan-600" /> Order Status</CardTitle>
                        <CardDescription className="text-xs">Procurement order distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={orderPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={2} dataKey="value" label={({ name, value }: any) => `${name.replace(/_/g, ' ')} (${value})`} labelLine={false}>
                                    {orderPieData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 6. Spend by Region Bar ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-indigo-600" /> Spend by Region</CardTitle>
                        <CardDescription className="text-xs">Geographic spend distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={regionBarData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} angle={-20} height={50} textAnchor="end" />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => fmtCompact(v, currency)} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Bar dataKey="spend" fill="#6366f1" radius={[6, 6, 0, 0]} name="Spend">
                                    {regionBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 7. Price Variance (Quote vs Actual) ─── */}
                <Card className="lg:col-span-2 xl:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-600" /> Price Variance Analysis</CardTitle>
                        <CardDescription className="text-xs">Average initial quote vs actual price over time — gap represents negotiation savings</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={varianceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => fmtCompact(v, currency)} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                <Area type="monotone" dataKey="initial" fill="#ef444420" stroke="#ef4444" strokeWidth={2} name="Avg Initial Quote" />
                                <Area type="monotone" dataKey="actual" fill="#3b82f620" stroke="#3b82f6" strokeWidth={2} name="Avg Actual Price" />
                                <Bar dataKey="variance" fill="#10b981" fillOpacity={0.6} radius={[4, 4, 0, 0]} barSize={8} name="Savings Gap" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 8. Savings by Type Pie ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Savings Breakdown</CardTitle>
                        <CardDescription className="text-xs">By negotiation strategy type</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={savingsData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {savingsData.map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 9. Supplier Performance Scatter ─── */}
                <Card className="lg:col-span-2 xl:col-span-2">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm flex items-center gap-2"><RadarIcon className="h-4 w-4 text-cyan-700" /> Supplier Risk vs Performance</CardTitle>
                                <CardDescription className="text-xs">Bubble size = spend volume. Top 50 suppliers by spend.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px]">scatter</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" dataKey="riskScore" name="Risk" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: 'Risk Score →', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                                <YAxis type="number" dataKey="performanceScore" name="Performance" domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: 'Performance →', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                                <ZAxis type="number" dataKey="spend" range={[60, 500]} name="Spend" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                                    content={({ active, payload }: any) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0]?.payload;
                                        return (
                                            <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                                                <p className="font-bold">{d?.name}</p>
                                                <p>Risk: <b>{d?.riskScore}</b> | Perf: <b>{d?.performanceScore}</b></p>
                                                <p>ESG: <b>{d?.esgScore}</b> | Financial: <b>{d?.financialScore}</b></p>
                                                <p>Spend: <b>{fmt(d?.spend || 0, currency)}</b></p>
                                            </div>
                                        );
                                    }} />
                                <Scatter name="Suppliers" data={scatterData} fill="#0e7490">
                                    {scatterData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />)}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 10. Supplier Radar Comparison ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><RadarIcon className="h-4 w-4 text-purple-600" /> Top 5 Supplier Comparison</CardTitle>
                        <CardDescription className="text-xs">Multi-dimensional score overlay</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                                {radarSupplierNames.map((name, i) => (
                                    <Radar key={name} name={name} dataKey={name} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                                ))}
                                <Legend wrapperStyle={{ fontSize: 9 }} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 11. Spend by Country ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-teal-600" /> Spend by Country</CardTitle>
                        <CardDescription className="text-xs">Top procurement destinations</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={countryData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Bar dataKey="spend" radius={[0, 6, 6, 0]} name="Spend">
                                    {countryData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 12. Invoice by Region ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4 text-rose-600" /> Invoice Volume by Region</CardTitle>
                        <CardDescription className="text-xs">Regional invoice concentration</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={invoiceRegionData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} angle={-15} height={50} textAnchor="end" />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => fmtCompact(v, currency)} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="amount" fill="#e11d48" radius={[6, 6, 0, 0]} name="Invoice Amount" />
                                <Bar dataKey="count" fill="#f97316" fillOpacity={0.6} radius={[6, 6, 0, 0]} name="Count" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 13. Top Parts ─── */}
                <Card className="lg:col-span-2 xl:col-span-2">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm flex items-center gap-2"><Boxes className="h-4 w-4 text-violet-600" /> Top Articles by Spend</CardTitle>
                                <CardDescription className="text-xs">Highest value parts with volume and price metrics</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px]">Top 15</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={topPartsData} margin={{ bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => fmtCompact(v, currency)} />
                                <YAxis yAxisId="qty" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                                <Tooltip content={<ChartTooltip currency={currency} />} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="spend" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Spend" />
                                <Line type="monotone" dataKey="qty" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} yAxisId="qty" name="Quantity" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── 14. Contract Value Distribution ─── */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-sky-600" /> Contract Portfolio</CardTitle>
                        <CardDescription className="text-xs">Value distribution by contract type</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={contractData} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value"
                                    label={({ name, percent }: any) => `${name.replace(/_/g, ' ')} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                    {contractData.map((_, i) => <Cell key={i} fill={COLORS[(i + 6) % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmt(Number(v), currency)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Footer ─── */}
            <p className="text-center text-[10px] text-muted-foreground pb-2">
                Intelligence Hub — {data?.spendByCategory?.length || 0} categories · {data?.spendBySupplier?.length || 0} suppliers · {data?.spendTrend?.length || 0} periods tracked
                {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
            </p>
        </div>
    );
}
