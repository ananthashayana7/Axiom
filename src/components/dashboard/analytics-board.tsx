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

const COLORS = ["#065f46", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface AnalyticsBoardProps {
    monthlyData: { name: string; total: number }[];
    categoryData: { name: string; value: number }[];
}

export function AnalyticsBoard({ monthlyData, categoryData }: AnalyticsBoardProps) {
    const [view, setView] = useState<"trend" | "category">("trend");
    const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">("bar");

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl">
                    <p className="font-display font-bold text-lg mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium text-muted-foreground">
                            Spend: <span className="text-foreground font-bold">₹{payload[0].value.toLocaleString()}</span>
                        </p>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderChart = () => {
        const data = view === "trend" ? monthlyData : categoryData;

        if (!data || data.length === 0) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border/50">
                    <BarChart3 className="h-10 w-10 mb-4 opacity-20" />
                    <p className="font-medium">No analytics data available</p>
                    <p className="text-xs">Start creating orders to see spend trends.</p>
                </div>
            );
        }

        const xKey = view === "trend" ? "name" : "name";
        const yKey = view === "trend" ? "total" : "value";

        if (chartType === "pie") {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            stroke="none"
                        >
                            {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-background hover:opacity-80 transition-opacity duration-300" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "line") {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                        <XAxis
                            dataKey="name"
                            stroke="var(--color-muted-foreground)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            fontFamily="var(--font-sans)"
                        />
                        <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `₹${v}`}
                            dx={-10}
                            fontFamily="var(--font-sans)"
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 2, strokeDasharray: '5 5' }} />
                        <Line
                            type="monotone"
                            dataKey="total"
                            stroke="var(--color-primary)"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "var(--color-background)", stroke: "var(--color-primary)", strokeWidth: 2 }}
                            activeDot={{ r: 8, fill: "var(--color-primary)", stroke: "var(--color-background)", strokeWidth: 2 }}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "area") {
            return (
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                        <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} fontFamily="var(--font-sans)" />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} dx={-10} fontFamily="var(--font-sans)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="total"
                            stroke="var(--color-primary)"
                            fillOpacity={1}
                            fill="url(#colorTotal)"
                            strokeWidth={3}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} fontFamily="var(--font-sans)" />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} dx={-10} fontFamily="var(--font-sans)" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.2 }} />
                    <Bar
                        dataKey={yKey}
                        fill="var(--color-primary)"
                        radius={[6, 6, 0, 0]}
                        animationDuration={1500}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={view === "trend" ? "var(--color-primary)" : COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Card className="shadow-lg border-accent/20 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:border-accent/40">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-xl font-display font-bold flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Analytics Engine
                    </CardTitle>
                    <CardDescription className="text-sm font-medium mt-1">
                        {view === "trend" ? "Real-time spending trajectory analysis." : "Category-wise capital distribution."}
                    </CardDescription>
                </div>
                <div className="flex bg-muted/50 p-1 rounded-xl gap-1 border border-border/50">
                    <Button
                        variant={view === "trend" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setView("trend"); if (chartType === 'pie') setChartType('bar') }}
                        className="rounded-lg font-medium"
                    >
                        Trend
                    </Button>
                    <Button
                        variant={view === "category" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView("category")}
                        className="rounded-lg font-medium"
                    >
                        Categories
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-8">
                    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
                        <Button
                            variant={chartType === "bar" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={() => setChartType("bar")}
                            title="Bar Chart"
                        >
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === "line" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={() => setChartType("line")}
                            disabled={view === "category"}
                            title="Line Chart"
                        >
                            <LineIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === "area" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={() => setChartType("area")}
                            disabled={view === "category"}
                            title="Area Chart"
                        >
                            <AreaIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === "pie" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8 rounded-md"
                            onClick={() => { setChartType("pie"); setView("category"); }}
                            title="Pie Chart"
                        >
                            <PieIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="h-[400px] w-full">
                    {renderChart()}
                </div>
            </CardContent>
        </Card>
    );
}
