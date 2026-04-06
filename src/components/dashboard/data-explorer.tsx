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
    Cell,
    ScatterChart,
    Scatter,
    ZAxis,
    ReferenceLine,
} from "recharts"

const COLORS = [
    "#065f46", "#0d9488", "#047857", "#0891b2", "#22c55e",
    "#d97706", "#dc2626", "#db2777", "#4f46e5", "#7c3aed",
    "#2563eb", "#0369a1", "#0f766e", "#15803d", "#92400e",
];
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, BarChart3, Database, Info, TrendingUp } from "lucide-react"
import { useCurrency } from "@/components/currency-provider"

type ExplorerTooltipPayload = {
    color?: string;
    name?: string;
    value?: number;
};

function ExplorerTooltip({
    active,
    payload,
    label,
    currencySymbol,
}: {
    active?: boolean;
    payload?: ExplorerTooltipPayload[];
    label?: string;
    currencySymbol?: string;
}) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const sym = currencySymbol || '';
    const fmtVal = (v: number, name: string) => {
        if (name === 'reliability' || name === 'Reliability Score' || name === 'Fulfillment %' || name === 'Performance Score' || name === 'Performance %') return `${v.toFixed(1)}%`;
        if (v >= 10000000) return `${sym}${(v / 10000000).toFixed(1)}Cr`;
        if (v >= 100000) return `${sym}${(v / 100000).toFixed(1)}L`;
        if (v >= 1000) return `${sym}${(v / 1000).toFixed(1)}K`;
        return `${sym}${v.toLocaleString()}`;
    };

    return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border p-4 rounded-xl shadow-2xl min-w-[200px]">
            <p className="font-display font-bold text-lg mb-2 border-b border-border/50 pb-2">{label}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.name}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                        {fmtVal(entry.value || 0, entry.name || '')}
                    </span>
                </div>
            ))}
        </div>
    );
}

interface DataExplorerProps {
    monthlyData: ExplorerDatum[];
    categoryData: ExplorerDatum[];
    supplierData?: ExplorerDatum[];
}

type ExplorerDatum = {
    name: string;
    [key: string]: string | number | undefined;
};

type Dimension = "time" | "category" | "supplier";
type Metric = "spend" | "orders" | "mixed" | "performance";

const toDimension = (value: string): Dimension => {
    if (value === "time" || value === "category" || value === "supplier") return value;
    return "time";
};

const toMetric = (value: string): Metric => {
    if (value === "spend" || value === "orders" || value === "mixed" || value === "performance") return value;
    return "spend";
};

export function DataExplorer({ monthlyData, categoryData, supplierData = [] }: DataExplorerProps) {
    const { geoLocale } = useCurrency();
    const sym = geoLocale.currencySymbol || '';

    const [dimension, setDimension] = useState<Dimension>("time");
    const [metric, setMetric] = useState<Metric>("spend");
    const [chartType, setChartType] = useState<"composed" | "bar" | "area" | "scatter">("composed");
    const [showTrend, setShowTrend] = useState(false);

    const currentData = useMemo(() => {
        if (dimension === "time") return monthlyData;
        if (dimension === "category") return categoryData;
        if (dimension === "supplier") return supplierData;
        return [];
    }, [dimension, monthlyData, categoryData, supplierData]);

    // Compute trend line data for time series
    const trendData = useMemo(() => {
        if (dimension !== 'time' || currentData.length < 2) return currentData;
        const vals = currentData.map((d) => Number(d.total || d.spend || 0));
        const n = vals.length;
        const sumX = n * (n - 1) / 2;
        const sumY = vals.reduce((a: number, b: number) => a + b, 0);
        const sumXY = vals.reduce((sum: number, y: number, i: number) => sum + i * y, 0);
        const sumX2 = vals.reduce((sum: number, _: number, i: number) => sum + i * i, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        return currentData.map((d, i) => ({ ...d, trend: Math.round(intercept + slope * i) }));
    }, [dimension, currentData]);

    const chartConfig = useMemo(() => {
        let xKey = "name";
        let barKey = "";
        let lineKey = "";
        if (dimension === "time") {
            xKey = "name";
            barKey = metric === 'orders' ? "orders" : "total";
            lineKey = metric === 'orders' ? "orders" : "total";
        } else if (dimension === "category") {
            xKey = "name";
            barKey = metric === 'orders' ? "count" : "value";
        } else if (dimension === "supplier") {
            xKey = "name";
            barKey = metric === 'orders' ? "orders" : "spend";
            lineKey = "reliability";
        }
        return { xKey, barKey, lineKey };
    }, [dimension, metric]);

    const avgValue = useMemo(() => {
        if (!currentData.length) return 0;
        const vals = currentData.map((d) => Number(d[chartConfig.barKey] || 0));
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }, [currentData, chartConfig.barKey]);

    const fmtTick = (value: number) => {
        if (metric === 'orders') return value.toLocaleString();
        if (value >= 10000000) return `${sym}${(value / 10000000).toFixed(1)}Cr`;
        if (value >= 100000) return `${sym}${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `${sym}${(value / 1000).toFixed(0)}K`;
        return `${sym}${value}`;
    };

    const customTooltipProps = { currencySymbol: sym };

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
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Pulse — {sym} {geoLocale.currencyCode}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 w-full xl:w-auto">
                        <Select value={dimension} onValueChange={(v: string) => setDimension(toDimension(v))}>
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

                        <Select value={metric} onValueChange={(v: string) => setMetric(toMetric(v))}>
                            <SelectTrigger className="w-fit min-w-[140px] h-9 text-[10px] bg-white/50 backdrop-blur-sm border-slate-200 rounded-xl hover:border-emerald-400 transition-all font-bold uppercase tracking-wider">
                                Metric: {metric}
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-2xl">
                                <SelectItem value="spend">Total Spend ({sym})</SelectItem>
                                <SelectItem value="orders">Order Volume</SelectItem>
                                {dimension === "supplier" && <SelectItem value="performance">Performance Score</SelectItem>}
                            </SelectContent>
                        </Select>

                        <div className="flex items-center bg-white/50 border rounded-xl p-1 gap-1">
                            {(['composed', 'area', 'scatter'] as const).map(ct => (
                                <Button key={ct} variant={chartType === ct ? 'secondary' : 'ghost'} size="sm"
                                    className="h-7 px-3 rounded-lg text-[10px] font-bold uppercase"
                                    onClick={() => setChartType(ct)}>
                                    {ct === 'composed' ? 'Bar' : ct === 'area' ? 'Area' : 'Scatter'}
                                </Button>
                            ))}
                        </div>

                        {dimension === 'time' && (
                            <Button variant={showTrend ? 'secondary' : 'outline'} size="sm"
                                className="h-9 text-[10px] font-bold uppercase rounded-xl gap-1"
                                onClick={() => setShowTrend(t => !t)}>
                                <TrendingUp className="h-3 w-3" /> Trend
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <CardContent className="p-0 h-[450px] relative">
                {currentData.length > 0 ? (
                    <div className="p-6 h-full">
                        {chartType === 'scatter' && dimension === 'supplier' ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                                    <XAxis dataKey="spend" name="Spend" tickFormatter={fmtTick} tick={{ fontSize: 10, fontWeight: 600 }} label={{ value: `Spend (${sym})`, position: 'insideBottom', offset: -10, fontSize: 10 }} />
                                    <YAxis dataKey="reliability" name="Performance %" tick={{ fontSize: 10, fontWeight: 600 }} domain={[0, 100]} label={{ value: 'Performance %', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                                    <ZAxis dataKey="orders" range={[40, 400]} name="Orders" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={(p: unknown) => <ExplorerTooltip {...(p as { active?: boolean; payload?: ExplorerTooltipPayload[]; label?: string })} {...customTooltipProps} />} />
                                    <Scatter data={currentData} fill="#059669">
                                        {currentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={showTrend ? trendData : currentData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
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
                                    <XAxis dataKey={chartConfig.xKey} axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10, fontWeight: 600 }} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10, fontWeight: 600 }}
                                        tickFormatter={fmtTick} />
                                    {dimension === 'supplier' && metric !== 'orders' && (
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false}
                                            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10, fontWeight: 600 }}
                                            tickFormatter={v => `${v}%`} domain={[0, 100]} />
                                    )}
                                    <Tooltip content={(p: unknown) => <ExplorerTooltip {...(p as { active?: boolean; payload?: ExplorerTooltipPayload[]; label?: string })} {...customTooltipProps} />} cursor={{ fill: 'var(--color-primary)', opacity: 0.05 }} />
                                    {avgValue > 0 && (
                                        <ReferenceLine yAxisId="left" y={avgValue} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Avg', fill: '#f59e0b', fontSize: 9 }} />
                                    )}
                                    {chartType === 'area' ? (
                                        <Area yAxisId="left" type="monotone" dataKey={chartConfig.barKey} stroke="#059669"
                                            strokeWidth={3} fill="url(#colorArea)" animationDuration={2000}>
                                            {dimension !== 'time' && currentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Area>
                                    ) : (
                                        <Bar yAxisId="left" dataKey={chartConfig.barKey} fill="url(#colorBar)"
                                            radius={[6, 6, 0, 0]} animationDuration={2000}>
                                            {dimension !== 'time' && currentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    )}
                                    {showTrend && dimension === 'time' && (
                                        <Line yAxisId="left" type="monotone" dataKey="trend" stroke="#f59e0b" strokeWidth={2.5}
                                            strokeDasharray="5 3" dot={false} name="Trend" animationDuration={2500} />
                                    )}
                                    {dimension === 'supplier' && metric !== 'orders' && chartConfig.lineKey && (
                                        <Line yAxisId="right" type="monotone" dataKey={chartConfig.lineKey}
                                            stroke="#0891b2" strokeWidth={3} dot={{ r: 4, fill: '#0891b2' }} name="Performance Score" animationDuration={2500} />
                                    )}
                                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[10px] font-bold uppercase tracking-wide">{v}</span>} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 bg-slate-50/30 dark:bg-slate-900/30 p-12 text-center">
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-2xl animate-bounce">
                            <Database className="h-12 w-12 text-emerald-600" />
                        </div>
                        <div className="max-w-md">
                            <h4 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Awaiting Enterprise Data</h4>
                            <p className="text-sm text-muted-foreground font-medium mt-2 leading-relaxed">
                                Our intelligence engines are ready. Once you create your first <strong>Purchase Order</strong> or onboard a <strong>Supplier</strong>, this hub will illuminate with real-time spend dynamics and risk telemetry.
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

