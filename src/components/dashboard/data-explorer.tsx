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
    "#06b6d4", // Cyan
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#3b82f6", // Blue
    "#6366f1", // Indigo
    "#d946ef", // Fuchsia
];
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Filter, BarChart3, Download, RefreshCcw } from "lucide-react"

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
        <Card className="col-span-4 shadow-xl border-primary/20 bg-card overflow-hidden">
            {/* POWER BI TOOLBAR */}
            {/* POWER BI TOOLBAR */}
            <div className="border-b bg-muted/30 px-6 py-3 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex flex-col xl:flex-row items-center justify-between gap-4">

                    {/* LEFT: Title */}
                    <div>
                        <h3 className="font-sans font-black text-xl leading-tight tracking-tight">Telemetry</h3>
                    </div>

                    {/* RIGHT: Controls */}
                    <div className="flex flex-wrap items-center justify-end gap-2 w-full xl:w-auto">

                        {/* 1. DIMENSION SELECTOR */}
                        <Select value={dimension} onValueChange={(v: any) => setDimension(v)}>
                            <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border hover:border-primary/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-semibold uppercase truncate"><span className="text-muted-foreground font-normal">View:</span> {dimension}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="time">Time Series</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="supplier">Supplier</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* 2. METRIC SELECTOR */}
                        <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
                            <SelectTrigger className="w-[130px] h-8 text-xs bg-background border-border hover:border-primary/50 transition-colors">
                                <span className="font-semibold uppercase truncate"><span className="text-muted-foreground font-normal">Metric:</span> {metric}</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="spend">Total Spend (₹)</SelectItem>
                                <SelectItem value="orders">Order Volume</SelectItem>
                                <SelectItem value="mixed">Mixed View</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* 3. TIME RANGE */}
                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-background border-border hover:border-primary/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-semibold">{timeRange === 'ytd' ? 'Year to Date' : timeRange === '30d' ? '30 Days' : timeRange === '90d' ? 'Quarter' : 'All Time'}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                                <SelectItem value="90d">Last Quarter</SelectItem>
                                <SelectItem value="ytd">Year to Date</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="h-5 w-px bg-border mx-1" />

                        {/* 4. VISUALIZATION TOGGLES */}
                        <div className="flex items-center bg-background border rounded-md p-0.5">
                            <Button
                                variant={chartType === 'composed' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-7 w-7 rounded-sm"
                                onClick={() => setChartType('composed')}
                                title="Bar Chart"
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant={chartType === 'area' ? 'secondary' : 'ghost'}
                                size="icon"
                                className="h-7 w-7 rounded-sm"
                                onClick={() => setChartType('area')}
                                title="Area Chart"
                            >
                                <div className="h-3.5 w-3.5 rounded-[1px] border-2 border-current border-t-0 border-r-0" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CHART CANVAS */}
            <CardContent id="telemetry-chart-container" className="p-6 h-[450px] bg-gradient-to-b from-card to-muted/20">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={currentData}
                        margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
                        barGap={0}
                        barCategoryGap="25%"
                    >
                        <defs>
                            <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartConfig.colorBar} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={chartConfig.colorBar} stopOpacity={0.3} />
                            </linearGradient>
                            <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartConfig.colorLine} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={chartConfig.colorLine} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey={chartConfig.xKey}
                            axisLine={false}
                            tickLine={false}
                            scale="band"
                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                            padding={{ left: 10, right: 10 }}
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                            tickFormatter={(value) => {
                                if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
                                if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
                                if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
                                return `₹${value}`;
                            }}
                        />
                        {/* Secondary Y-Axis for Mixed Metrics (e.g. Reliability %) */}
                        {dimension === 'supplier' && (
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                                unit="%"
                                domain={[0, 100]}
                            />
                        )}

                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.1 }} />
                        <Legend iconType="circle" />

                        {/* DYNAMIC LAYERS */}
                        {(chartType === 'composed' || chartType === 'bar') && (
                            <Bar
                                yAxisId="left"
                                dataKey={chartConfig.barKey}
                                name={dimension === 'supplier' ? "Spend Volume" : "Total Spend"}
                                fill="url(#colorBar)"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                                animationDuration={1500}
                            >
                                {dimension !== 'time' && currentData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        )}

                        {(chartType === 'composed' || chartType === 'area') && chartConfig.lineKey && (
                            <Area
                                yAxisId={dimension === 'supplier' ? "right" : "left"}
                                type="monotone"
                                dataKey={chartConfig.lineKey}
                                name={dimension === 'supplier' ? "Reliability Score" : "Trend Line"}
                                stroke={chartConfig.colorLine}
                                strokeWidth={3}
                                fill="url(#colorArea)"
                                dot={{ r: 4, strokeWidth: 2, fill: "var(--color-background)" }}
                                animationDuration={2000}
                            />
                        )}

                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
