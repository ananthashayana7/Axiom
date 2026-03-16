'use client';

import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STATUS_COLORS: Record<string, string> = {
    draft: '#94a3b8',
    pending: '#f59e0b',
    pending_approval: '#f59e0b',
    approved: '#10b981',
    sent: '#06b6d4',
    fulfilled: '#22c55e',
    cancelled: '#6b7280',
};

interface OrderChartsProps {
    orders: any[];
}

export function OrderCharts({ orders }: OrderChartsProps) {
    // Status distribution
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const o of orders) {
            const s = o.status || 'draft';
            counts[s] = (counts[s] || 0) + 1;
        }
        return Object.entries(counts).map(([name, value]) => ({
            name: name.replace('_', ' '),
            value,
            color: STATUS_COLORS[name] || '#94a3b8',
        }));
    }, [orders]);

    // Top suppliers by order count
    const supplierData = useMemo(() => {
        const counts: Record<string, { count: number; total: number }> = {};
        for (const o of orders) {
            const name = o.supplier?.name || 'Unknown';
            if (!counts[name]) counts[name] = { count: 0, total: 0 };
            counts[name].count++;
            counts[name].total += Number(o.totalAmount) || 0;
        }
        return Object.entries(counts)
            .map(([name, v]) => ({ name: name.slice(0, 12), count: v.count, total: Math.round(v.total) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [orders]);

    // Monthly spend trend (last 6 months)
    const monthlyData = useMemo(() => {
        const now = new Date();
        const months: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            months[key] = 0;
        }
        for (const o of orders) {
            if (!o.createdAt) continue;
            const d = new Date(o.createdAt);
            const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            if (months[key] !== undefined) {
                months[key] += Number(o.totalAmount) || 0;
            }
        }
        return Object.entries(months).map(([month, amount]) => ({ month, amount: Math.round(amount) }));
    }, [orders]);

    if (orders.length === 0) return null;

    return (
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
            {/* Status Distribution */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Order Status</CardTitle>
                    <CardDescription>Distribution by procurement stage</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                                paddingAngle={3} dataKey="value" nameKey="name">
                                {statusData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v, n) => [v as number, n as string]} />
                            <Legend iconType="circle" iconSize={9} formatter={(v) => <span className="text-[10px] font-medium capitalize">{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Monthly Spend */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Monthly Spend</CardTitle>
                    <CardDescription>Total order value over 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                            <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Amount']} />
                            <Bar dataKey="amount" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Amount" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Top Suppliers */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase tracking-wide">Top Suppliers</CardTitle>
                    <CardDescription>By number of orders placed</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={supplierData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                            <Tooltip formatter={(v, n) => [v, n === 'count' ? 'Orders' : n]} />
                            <Bar dataKey="count" fill="#10b981" name="Orders" radius={[0, 3, 3, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
