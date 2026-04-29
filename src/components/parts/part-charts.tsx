'use client';

import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const STOCK_COLORS = { normal: '#10b981', low: '#f59e0b', critical: '#ef4444' };

interface PartChartsProps {
    parts: any[];
}

export function PartCharts({ parts }: PartChartsProps) {
    // Category distribution
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const p of parts) {
            counts[p.category || 'Uncategorized'] = (counts[p.category || 'Uncategorized'] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [parts]);

    // Stock status distribution
    const stockStatusData = useMemo(() => [
        { name: 'Normal Stock', value: parts.filter(p => p.stockLevel > (p.reorderPoint || 50)).length, color: STOCK_COLORS.normal },
        { name: 'Low Stock', value: parts.filter(p => p.stockLevel <= (p.reorderPoint || 50) && p.stockLevel > (p.minStockLevel || 20)).length, color: STOCK_COLORS.low },
        { name: 'Critical', value: parts.filter(p => p.stockLevel <= (p.minStockLevel || 20)).length, color: STOCK_COLORS.critical },
    ].filter(d => d.value > 0), [parts]);

    // Market trend distribution
    const trendData = useMemo(() => {
        const counts: Record<string, number> = { rising: 0, stable: 0, falling: 0, volatile: 0 };
        for (const p of parts) {
            const t = p.marketTrend?.toLowerCase() || 'stable';
            counts[t] = (counts[t] || 0) + 1;
        }
        return [
            { name: 'Rising', value: counts.rising, color: '#ef4444', icon: '↑' },
            { name: 'Stable', value: counts.stable, color: '#3b82f6', icon: '→' },
            { name: 'Falling', value: counts.falling, color: '#10b981', icon: '↓' },
            { name: 'Volatile', value: counts.volatile, color: '#f59e0b', icon: '~' },
        ].filter(d => d.value > 0);
    }, [parts]);

    // ABC Classification
    const abcData = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const p of parts) {
            const cls = p.abcClassification || 'Unclassified';
            counts[cls] = (counts[cls] || 0) + 1;
        }
        return Object.entries(counts)
            .map(([name, value]) => ({ name: `Class ${name}`, value }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [parts]);

    // Top 10 parts by stock level (bar chart)
    const topStockParts = useMemo(() =>
        parts
            .slice()
            .sort((a, b) => (b.stockLevel || 0) - (a.stockLevel || 0))
            .slice(0, 10)
            .map(p => ({ name: p.sku || p.name?.slice(0, 10), stock: p.stockLevel || 0, reorder: p.reorderPoint || 50 })),
        [parts]);

    if (parts.length === 0) return null;

    return (
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Stock Level Overview (Bar) */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Top Parts — Stock vs Reorder Point</CardTitle>
                    <CardDescription>Current stock benchmarked against the reorder trigger for your busiest SKUs.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={topStockParts} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v, n) => [v as number, n === 'stock' ? 'Stock' : 'Reorder Point']} />
                            <Bar dataKey="stock" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Stock" />
                            <Bar dataKey="reorder" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Reorder Point" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Current stock
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Reorder trigger
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Stock Status Distribution (Pie) */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Stock Health Distribution</CardTitle>
                    <CardDescription>Parts by stock level status</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={stockStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                paddingAngle={3} dataKey="value" nameKey="name">
                                {stockStatusData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v as number, n as string]} />
                            <Legend iconType="circle" iconSize={10} formatter={(v) => <span className="text-xs font-medium">{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Category Distribution (Bar) */}
            {categoryData.length > 0 && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-black uppercase tracking-wide">Parts by Category</CardTitle>
                        <CardDescription>Number of SKUs per category</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                                <Tooltip />
                                <Bar dataKey="value" name="Parts">
                                    {categoryData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Market Trend & ABC Classification (Pie) */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Market Trend Breakdown</CardTitle>
                    <CardDescription>Current price trend across all SKUs</CardDescription>
                </CardHeader>
                <CardContent>
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={trendData} cx="50%" cy="50%" outerRadius={80}
                                    paddingAngle={3} dataKey="value" nameKey="name">
                                    {trendData.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v, n) => [v as number, n as string]} />
                                <Legend iconType="circle" iconSize={10} formatter={(v) => <span className="text-xs font-medium">{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No trend data available</div>
                    )}
                </CardContent>
            </Card>

            {/* ABC Classification */}
            {abcData.length > 0 && (
                <Card className="shadow-sm lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-black uppercase tracking-wide">ABC / XYZ Classification</CardTitle>
                        <CardDescription>Parts stratified by value and demand pattern — A=high value, B=medium, C=low; X=regular, Y=variable, Z=sporadic</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={abcData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" name="Parts" radius={[4, 4, 0, 0]}>
                                    {abcData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
