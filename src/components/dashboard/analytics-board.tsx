"use client"

import { useState } from "react"
import {
    Bar, BarChart,
    Line, LineChart,
    Area, AreaChart,
    Pie, PieChart, Cell,
    ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, Layers } from "lucide-react"

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface AnalyticsBoardProps {
    monthlyData: { name: string; total: number }[];
    categoryData: { name: string; value: number }[];
}

export function AnalyticsBoard({ monthlyData, categoryData }: AnalyticsBoardProps) {
    const [view, setView] = useState<"trend" | "category">("trend");
    const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">("bar");

    const renderChart = () => {
        const data = view === "trend" ? monthlyData : categoryData;
        const xKey = view === "trend" ? "name" : "name";
        const yKey = view === "trend" ? "total" : "value";

        if (chartType === "pie") {
            return (
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                            {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Spend']}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "line") {
            return (
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Total Spend']} />
                        <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "area") {
            return (
                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={monthlyData}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Total Spend']} />
                        <Area type="monotone" dataKey="total" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Total Spend']} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Card className="shadow-lg border-accent/50">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Sophisticated Analytics
                    </CardTitle>
                    <CardDescription>
                        {view === "trend" ? "Monthly spending trends over the current year." : "Distribution of spend across part categories."}
                    </CardDescription>
                </div>
                <div className="flex bg-muted p-1 rounded-lg gap-1">
                    <Button
                        variant={view === "trend" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => { setView("trend"); if (chartType === 'pie') setChartType('bar') }}
                    >
                        Trend
                    </Button>
                    <Button
                        variant={view === "category" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setView("category")}
                    >
                        Categories
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-6">
                    <Button
                        variant={chartType === "bar" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setChartType("bar")}
                        title="Bar Chart"
                    >
                        <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={chartType === "line" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setChartType("line")}
                        disabled={view === "category"}
                        title="Line Chart"
                    >
                        <LineIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={chartType === "area" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setChartType("area")}
                        disabled={view === "category"}
                        title="Area Chart"
                    >
                        <AreaIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={chartType === "pie" ? "default" : "outline"}
                        size="icon"
                        onClick={() => { setChartType("pie"); setView("category"); }}
                        title="Pie Chart"
                    >
                        <PieIcon className="h-4 w-4" />
                    </Button>
                </div>
                {renderChart()}
            </CardContent>
        </Card>
    );
}
