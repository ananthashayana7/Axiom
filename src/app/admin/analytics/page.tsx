'use client'

import React, { useEffect, useState } from 'react';
import { getSpendStats } from "@/app/actions/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart as PieIcon,
    BarChart3,
    Download,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SpendAnalysisView } from "@/components/admin/spend-analysis-view";
import { getOrders } from "@/app/actions/orders";
import { getSuppliers } from "@/app/actions/suppliers";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#0088FE', '#00C49F', '#FFBB28'];

export default function AnalyticsPage() {
    const [stats, setStats] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const [statsData, ordersData, suppliersData] = await Promise.all([
                getSpendStats(),
                getOrders(),
                getSuppliers()
            ]);
            setStats(statsData);
            setOrders(ordersData);
            setSuppliers(suppliersData);
            setLoading(false);
        };
        fetchData();
    }, []);

    const exportToCSV = () => {
        if (!stats) return;

        // Prepare CSV content for Spend by Category
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Category Analytics\n";
        csvContent += "Category,Total Spend (INR)\n";
        stats.spendByCategory.forEach((row: any) => {
            csvContent += `${row.category},${row.totalSpend}\n`;
        });

        csvContent += "\nTop Suppliers\n";
        csvContent += "Supplier,Total Volume (INR)\n";
        stats.spendBySupplier.forEach((row: any) => {
            csvContent += `${row.supplierName},${row.totalSpend}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `axiom_spend_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Report generated", {
            description: "Spend analysis CSV has been downloaded."
        });
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground animate-pulse">Aggregating procurement intelligence...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Spend & Strategic Intelligence</h1>
                    <p className="text-muted-foreground mt-1">Holistic view of organizational spend and realized savings.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" /> Filter Period
                    </Button>
                    <Button onClick={exportToCSV} className="gap-2">
                        <Download className="h-4 w-4" /> Generate Report
                    </Button>
                </div>
            </div>

            {/* Top Level Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Managed Spend</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{(stats.totalActualSpend / 100000).toFixed(1)}L</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <ArrowUpRight className="text-green-600 h-3 w-3" />
                            <span className="text-green-600 font-bold">14.2%</span> from last quarter
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Realized Savings</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{(stats.realizedSavings / 100000).toFixed(1)}L</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="text-green-600 font-bold">{stats.savingsRate}%</span> Avg Savings Rate
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
                        <PieIcon className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.spendByCategory.length}</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Diversified across 8 sectors</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-background to-purple-50/20 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">AI Negotiation Alpha</CardTitle>
                        <Zap className="h-4 w-4 text-purple-600 fill-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">4.8%</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium italic">Incremental margin identified</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Spend Trend */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Monthly Spend Dynamics
                        </CardTitle>
                        <CardDescription>Spend progression across the last 6 months.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.spendTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: any) => [`₹${(value / 1000).toFixed(1)}k`, 'Spend']}
                                />
                                <Line type="monotone" dataKey="totalSpend" stroke="#8884d8" strokeWidth={3} dot={{ r: 4, fill: '#8884d8' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Spend by Category */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PieIcon className="h-5 w-5 text-blue-600" />
                            Spend by Category
                        </CardTitle>
                        <CardDescription>Visual breakdown of allocation across part categories.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.spendByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="totalSpend"
                                    nameKey="category"
                                >
                                    {stats.spendByCategory.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => [`₹${(value / 1000).toFixed(1)}k`, 'Amount']}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Top Suppliers by Spend */}
                <Card className="shadow-sm lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-green-600" />
                                    Top Suppliers by Volume
                                </CardTitle>
                                <CardDescription>Identifying key strategic partners by financial contribution.</CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Fulfilled Orders Only</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.spendBySupplier} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="supplierName" type="category" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 12, fontWeight: 500 }} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(value: any) => [`₹${(value / 1000).toFixed(1)}k`, 'Total Volume']}
                                />
                                <Bar dataKey="totalSpend" fill="#82ca9d" radius={[0, 8, 8, 0]} barSize={35} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* AI Strategic Advice Section */}
            <SpendAnalysisView orders={orders} suppliers={suppliers} />
        </div>
    );
}
