'use client'

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { TrendingDown, DollarSign, Target, Award, Download, PiggyBank, ArrowDownRight } from "lucide-react";
import { getSavingsData } from "@/app/actions/savings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from '@/components/currency-provider';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SavingsPage() {
    const { geoLocale, formatCurrency: formatCurrencyGeo } = useCurrency();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<string>(geoLocale.currencyCode);

    useEffect(() => {
        getSavingsData().then(d => { setData(d); setLoading(false); });
    }, []);

    const fmt = (val: number) => {
        const LOCALE: Record<string, string> = { INR: 'en-IN', EUR: 'de-DE', USD: 'en-US', GBP: 'en-GB' };
        const locale = LOCALE[currency] || geoLocale.locale;
        try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(val); }
        catch { return `${geoLocale.currencySymbol}${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; }
    };

    const exportCSV = () => {
        if (!data) return;
        const rows = [
            ['Metric', 'Value'],
            ['Total Negotiated Savings', data.totalNegotiatedSavings],
            ['Total Actual Spend', data.totalActualSpend],
            ['Savings Rate (%)', data.savingsRate],
            ['Orders with Savings', data.ordersWithSavings],
        ];
        const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `axiom_savings_${new Date().toISOString().split('T')[0]}.csv`; a.click();
        URL.revokeObjectURL(url);
        toast.success("Savings report exported");
    };

    if (loading) return (
        <div className="flex h-[80vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );

    if (!data) return <div className="p-8 text-muted-foreground">Failed to load savings data.</div>;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <PiggyBank className="h-8 w-8 text-emerald-600" /> Savings Intelligence
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Track negotiated savings, cost avoidance, and procurement efficiency.
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
                        {[
                            { code: geoLocale.currencyCode, sym: geoLocale.currencySymbol },
                            ...(geoLocale.currencyCode !== 'USD' ? [{ code: 'USD', sym: '$' }] : []),
                            ...(geoLocale.currencyCode !== 'EUR' ? [{ code: 'EUR', sym: '€' }] : []),
                        ].map(opt => (
                            <button key={opt.code} onClick={() => setCurrency(opt.code)} className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all", currency === opt.code ? "bg-primary text-white shadow" : "hover:bg-muted")}>{opt.sym} {opt.code}</button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> Export</Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                        <TrendingDown className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-700">{fmt(data.totalNegotiatedSavings)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Negotiated below initial quote</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Actual Spend</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{fmt(data.totalActualSpend)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total procurement spend</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                        <Target className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-700">{data.savingsRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">Of total procurement value</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Orders with Savings</CardTitle>
                        <Award className="h-4 w-4 text-violet-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{data.ordersWithSavings}</div>
                        <p className="text-xs text-muted-foreground mt-1">Orders with negotiated savings</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Savings by Supplier */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top 10 — Savings by Supplier</CardTitle>
                        <CardDescription>Spend vs savings per supplier — gap represents procurement efficiency</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.savingsBySupplier?.slice(0, 10) || []} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="supplierName" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => { try { return new Intl.NumberFormat(geoLocale.locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 0 }).format(v); } catch { return String(v); } }} />
                                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} name="Savings" />
                                {data.savingsBySupplier?.[0]?.spend !== undefined && (
                                    <Bar dataKey="spend" fill="#3b82f6" fillOpacity={0.3} radius={[4, 4, 0, 0]} name="Spend" />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Savings Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Monthly Savings Trend</CardTitle>
                        <CardDescription>Savings trajectory with spend overlay</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={data.savingsTrend || []} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                                <defs>
                                    <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => { try { return new Intl.NumberFormat(geoLocale.locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 0 }).format(v); } catch { return String(v); } }} />
                                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Area type="monotone" dataKey="savings" stroke="#10b981" fill="url(#savingsGrad)" strokeWidth={2.5} name="Savings" dot={{ r: 3, fill: '#10b981' }} />
                                {data.savingsTrend?.[0]?.spend !== undefined && (
                                    <Area type="monotone" dataKey="spend" stroke="#3b82f6" fill="url(#spendGrad)" strokeWidth={1.5} strokeDasharray="5 5" name="Spend" />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Savings by Type */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Savings by Type</CardTitle>
                        <CardDescription>Negotiation, volume discount, strategic sourcing</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={data.savingsByType || []} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="type" label={(entry: any) => `${entry?.type || 'Type'} ${((entry?.percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                                    {(data.savingsByType || []).map((_: any, i: number) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Savings Orders Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top Savings Transactions</CardTitle>
                        <CardDescription>Orders with highest negotiated savings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {(data.topSavingsOrders || []).slice(0, 10).map((order: any, i: number) => (
                                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-muted-foreground w-6">#{i + 1}</span>
                                        <div>
                                            <p className="text-sm font-bold">{order.supplierName || 'N/A'}</p>
                                            <p className="text-xs text-muted-foreground">{order.savingsType || 'negotiation'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-700">{fmt(Number(order.savingsAmount || 0))}</p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                            <ArrowDownRight className="h-3 w-3 text-emerald-600" />
                                            {order.savingsRate?.toFixed(1) || '0'}% saved
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {(!data.topSavingsOrders || data.topSavingsOrders.length === 0) && (
                                <p className="text-center text-muted-foreground italic py-8">No savings data yet. Add initial quotes to orders to track savings.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
