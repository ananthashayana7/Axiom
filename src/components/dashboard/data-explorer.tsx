"use client"

import { useState, useMemo } from "react"
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    Cell
} from "recharts"

const COLORS = [
    "#065f46", // Emerald-800
    "#0d9488", // Teal-600
    "#047857", // Emerald-700
    "#0891b2", // Cyan-600
    "#22c55e", // Green-500
    "#d97706", // Amber-600
    "#dc2626", // Red-600
    "#db2777", // Pink-600
];
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar, Filter, BarChart3, Download, RefreshCcw, Database, Info } from "lucide-react"

interface DataExplorerProps {
    monthlyData: any[];
    categoryData: any[];
    supplierData?: any[]; // Optional if we want to show supplier analytics
}

export function DataExplorer({ monthlyData, categoryData, supplierData = [] }: DataExplorerProps) {
    // BI STATE: What are we looking at?
    const [dimension, setDimension] = useState<"time" | "category" | "supplier">("time");
    const [metric, setMetric] = useState<"spend" | "orders" | "mixed">("spend");
    const [chartType, setChartType] = useState<"composed" | "bar" | "area">("composed");
    const [timeRange, setTimeRange] = useState("ytd");

    // 1. DATA TRANSFORMATION ENGINE (Simulate BI Cube)
    const currentData = useMemo(() => {
        let data: any[] = [];

        if (dimension === "time") {
            data = monthlyData;
            // Time Range Slicing (Simulated)
            if (timeRange === '30d') data = monthlyData.slice(-1);
            if (timeRange === '90d') data = monthlyData.slice(-3);
            if (timeRange === 'ytd') data = monthlyData; // Assuming data passed is YTD
            if (timeRange === 'all') data = monthlyData;
        }
        else if (dimension === "category") {
            data = categoryData;
        }
        else if (dimension === "supplier") {
            data = supplierData;
        }

        return data;
    }, [dimension, monthlyData, categoryData, supplierData, timeRange]);

    // 2. CONFIGURATION ENGINE (Chart Settings)
    const chartConfig = useMemo(() => {
        let xKey = "name";
        let barKey = "";
        let lineKey = "";
        let colorBar = "#06b6d4"; // Cyan-500
        let colorLine = "#8b5cf6"; // Violet-500

        if (dimension === "time") {
            xKey = "name";
            barKey = metric === 'orders' ? "orders" : "total"; // Switch between Total Spend and Orders
            lineKey = metric === 'orders' ? "orders" : "total";
        } else if (dimension === "category") {
            xKey = "name";
            barKey = metric === 'orders' ? "count" : "value"; // Assuming categoryData has 'count' for orders
        } else if (dimension === "supplier") {
            xKey = "name";
            barKey = metric === 'orders' ? "orders" : "spend";
            lineKey = "reliability";
        }

        return { xKey, barKey, lineKey, colorBar, colorLine };
    }, [dimension, metric]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover/95 backdrop-blur-sm border border-border p-4 rounded-xl shadow-2xl min-w-[200px]">
                    <p className="font-display font-bold text-lg mb-2 border-b border-border/50 pb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1">
                            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}
                            </span>
                            <span className="font-mono font-bold text-foreground">
                                {entry.name === 'reliability' || entry.name === 'Reliability Score' ? `${entry.value}%` :
                                    entry.value >= 10000000 ? `₹${(entry.value / 10000000).toFixed(1)}Cr` :
                                        entry.value >= 100000 ? `₹${(entry.value / 100000).toFixed(1)}L` :
                                            entry.value >= 1000 ? `₹${(entry.value / 1000).toFixed(0)}K` :
                                                `₹${entry.value.toLocaleString()}`}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="col-span-4 glass-card border-slate-200/50 dark:border-slate-800/50 shadow-2xl overflow-hidden group">
            <div className="border-b bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 backdrop-blur-md">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none">
                            <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-sans font-black text-xl leading-tight tracking-tighter text-slate-900 dark:text-white uppercase">Intelligence Hub</h3>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Pulse</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 w-full xl:w-auto">
                        <Select value={dimension} onValueChange={(v: any) => setDimension(v)}>
                            <SelectTrigger className="w-fit min-w-[150px] h-9 text-[10px] bg-white/50 backdrop-blur-sm border-slate-200 rounded-xl hover:border-emerald-400 transition-all font-bold uppercase tracking-wider">
                                <Filter className="h-3 w-3 text-emerald-600 mr-2" />
                                {dimension}
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                                <SelectItem value="time">Time Series</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="supplier">Supplier</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
                            <SelectTrigger className="w-fit min-w-[140px] h-9 text-[10px] bg-white/50 backdrop-blur-sm border-slate-200 rounded-xl hover:border-emerald-400 transition-all font-bold uppercase tracking-wider">
                                Metric: {metric}
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                                <SelectItem value="spend">Total Spend (₹)</SelectItem>
                                <SelectItem value="orders">Order Volume</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center bg-white/50 border rounded-xl p-1 gap-1">
                            <Button
                                variant={chartType === 'composed' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 px-3 rounded-lg text-[10px] font-bold uppercase"
                                onClick={() => setChartType('composed')}
                            >
                                Bar
                            </Button>
                            <Button
                                variant={chartType === 'area' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-7 px-3 rounded-lg text-[10px] font-bold uppercase"
                                onClick={() => setChartType('area')}
                            >
                                Area
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <CardContent className="p-0 h-[450px] relative">
                {currentData.length > 0 ? (
                    <div className="p-6 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={currentData}
                                margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
                            >
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#059669" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#059669" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} vertical={false} />
                                <XAxis
                                    dataKey={chartConfig.xKey}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10, fontWeight: 600 }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10, fontWeight: 600 }}
                                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-primary)', opacity: 0.05 }} />
                                <Bar
                                    yAxisId="left"
                                    dataKey={chartConfig.barKey}
                                    fill="url(#colorBar)"
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={2000}
                                >
                                    {dimension !== 'time' && currentData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                                {chartType === 'area' && (
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey={chartConfig.lineKey}
                                        stroke="#059669"
                                        strokeWidth={4}
                                        fill="url(#colorArea)"
                                        animationDuration={2500}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 bg-slate-50/30 dark:bg-slate-900/30 p-12 text-center">
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-2xl animate-bounce">
                            <Database className="h-12 w-12 text-emerald-600" />
                        </div>
                        <div className="max-w-md">
                            <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Awaiting Enterprise Data</h4>
                            <p className="text-sm text-muted-foreground font-medium mt-2 leading-relaxed">
                                Our intelligence engines are ready. Once you create your first **Purchase Order** or onboard a **Supplier**, this hub will illuminate with real-time spend dynamics and risk telemetry.
                            </p>
                            <div className="flex gap-2 justify-center mt-6">
                                <Badge variant="outline" className="bg-emerald-50 border-emerald-100 text-emerald-700 font-bold uppercase tracking-widest text-[9px] px-2 py-1">
                                    <Info className="h-3 w-3 mr-1" />
                                    Action Required: Create PO
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
