'use client'

import { useEffect, useMemo, useState } from 'react';
import { getSpendStats } from "@/app/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    ScatterChart,
    Scatter,
    ZAxis
} from 'recharts';
import { Download, Filter, BarChart3, TrendingUp, Factory, Boxes, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const INR_TO_EUR = 0.011;

function convertAmount(value: number, currency: 'INR' | 'EUR') {
    return currency === 'EUR' ? value * INR_TO_EUR : value;
}

function formatAmount(value: number, currency: 'INR' | 'EUR') {
    const converted = convertAmount(value, currency);
    if (currency === 'EUR') {
        return `€${converted.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
    }
    return `₹${converted.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function AnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currency, setCurrency] = useState<'INR' | 'EUR'>('INR');

    useEffect(() => {
        const fetchData = async () => {
            const statsData = await getSpendStats();
            setStats(statsData);
            setLoading(false);
        };
        fetchData();
    }, []);

    const top10Suppliers = useMemo(() => stats?.spendBySupplier ?? [], [stats]);
    const top10Categories = useMemo(() => stats?.spendByCategory ?? [], [stats]);
    const top10Parts = useMemo(() => stats?.topParts ?? [], [stats]);

    const exportToCSV = () => {
        if (!stats) return;

        const rows: string[] = [];
        rows.push('Top 10 Suppliers by Spend');
        rows.push('Supplier,Spend');
        top10Suppliers.forEach((row: any) => rows.push(`${row.supplierName},${convertAmount(Number(row.totalSpend || 0), currency)}`));

        rows.push('');
        rows.push('Top 10 Categories by Spend');
        rows.push('Category,Spend');
        top10Categories.forEach((row: any) => rows.push(`${row.category},${convertAmount(Number(row.totalSpend || 0), currency)}`));

        rows.push('');
        rows.push('Top 10 Articles by Volume');
        rows.push('Part,Category,Total Quantity,Spend');
        top10Parts.forEach((row: any) => rows.push(`${row.partName},${row.category},${Number(row.totalQuantity || 0)},${convertAmount(Number(row.totalSpend || 0), currency)}`));

        const csvContent = `data:text/csv;charset=utf-8,${rows.join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `axiom_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('Report generated', {
            description: 'Top 10 analytics CSV downloaded.'
        });
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground animate-pulse">Building strategic analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Spend & Strategic Intelligence</h1>
                    <p className="text-muted-foreground mt-1">Top 10 visibility across suppliers, categories, and articles.</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
                        <button
                            onClick={() => setCurrency('INR')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currency === 'INR' ? 'bg-primary text-white shadow' : 'hover:bg-muted'}`}
                        >
                            ₹ INR
                        </button>
                        <button
                            onClick={() => setCurrency('EUR')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${currency === 'EUR' ? 'bg-primary text-white shadow' : 'hover:bg-muted'}`}
                        >
                            € EUR
                        </button>
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" /> Filter Period
                    </Button>
                    <Button onClick={exportToCSV} className="gap-2">
                        <Download className="h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Actual Spend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatAmount(Number(stats.totalActualSpend || 0), currency)}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Realized Savings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-700">{formatAmount(Number(stats.realizedSavings || 0), currency)}</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{Number(stats.savingsRate || 0).toFixed(1)}%</div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Tracked Entities</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{top10Suppliers.length + top10Categories.length + top10Parts.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" /> Monthly Spend Trend
                        </CardTitle>
                        <CardDescription>6-month spend trajectory.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[290px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={(stats.spendTrend || []).map((row: any) => ({ ...row, displayTotal: convertAmount(Number(row.totalSpend || 0), currency) }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                                <YAxis hide />
                                <Tooltip formatter={(value: any) => [formatAmount(Number(value), currency), 'Spend']} />
                                <Line type="monotone" dataKey="displayTotal" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Factory className="h-5 w-5 text-emerald-600" /> Top 10 Suppliers by Spend
                        </CardTitle>
                        <CardDescription>Ranked by fulfilled procurement spend.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[290px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top10Suppliers.map((row: any) => ({ ...row, displayTotal: convertAmount(Number(row.totalSpend || 0), currency) }))} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="supplierName" type="category" width={140} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value: any) => [formatAmount(Number(value), currency), 'Spend']} />
                                <Bar dataKey="displayTotal" fill="#059669" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-amber-600" /> Top 10 Categories by Spend
                        </CardTitle>
                        <CardDescription>Spend concentration by category.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top10Categories.map((row: any) => ({ ...row, displayTotal: convertAmount(Number(row.totalSpend || 0), currency) }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="category" axisLine={false} tickLine={false} angle={-20} height={70} textAnchor="end" />
                                <YAxis hide />
                                <Tooltip formatter={(value: any) => [formatAmount(Number(value), currency), 'Spend']} />
                                <Bar dataKey="displayTotal" fill="#d97706" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Boxes className="h-5 w-5 text-violet-600" /> Top 10 Articles by Volume
                        </CardTitle>
                        <CardDescription>Highest moving parts by ordered quantity.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top10Parts}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="partName" axisLine={false} tickLine={false} angle={-20} height={70} textAnchor="end" />
                                <YAxis hide />
                                <Tooltip formatter={(value: any, name?: string) => [name === 'totalSpend' ? formatAmount(Number(value), currency) : Number(value), name === 'totalSpend' ? 'Spend' : 'Quantity']} />
                                <Bar dataKey="totalQuantity" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Radar className="h-5 w-5 text-cyan-700" /> Supplier Performance vs Spend
                                </CardTitle>
                                <CardDescription>Scatter view of risk and performance against supplier spend.</CardDescription>
                            </div>
                            <Badge variant="outline">Top 10 suppliers by spend</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[330px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" dataKey="riskScore" name="Risk Score" domain={[0, 100]} />
                                <YAxis type="number" dataKey="performanceScore" name="Performance Score" domain={[0, 100]} />
                                <ZAxis type="number" dataKey="totalSpend" range={[80, 550]} name="Spend" />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    formatter={(value: any, name?: string) => {
                                        if (name === 'Spend') return [formatAmount(Number(value), currency), 'Spend'];
                                        return [Number(value).toFixed(0), name || 'Metric'];
                                    }}
                                    labelFormatter={(label: any) => String(label || 'Supplier')}
                                />
                                <Scatter
                                    name="Supplier Profile"
                                    data={(stats.supplierPerformance || []).map((row: any) => ({
                                        ...row,
                                        totalSpend: convertAmount(Number(row.totalSpend || 0), currency)
                                    }))}
                                    fill="#0e7490"
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
