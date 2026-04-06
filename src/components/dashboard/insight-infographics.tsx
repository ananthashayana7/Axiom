"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BriefcaseBusiness,
    Globe2,
    Landmark,
    PieChart as PieChartIcon,
    TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalCurrency, formatLocalCurrencyCompact, getGeoLocale } from "@/lib/utils/geo-currency";
import {
    buildCategoryMix,
    getInfographicHighlights,
    type InfographicCategoryDatum,
    type InfographicMonthlyDatum,
    type InfographicRiskSupplierDatum,
    type InfographicSupplierDatum,
} from "@/lib/dashboard-infographic";

const CHART_COLORS = ["#2563eb", "#a855f7", "#14b8a6", "#f59e0b", "#94a3b8"];
const subscribe = () => () => {};

interface InsightInfographicsProps {
    monthlyData: InfographicMonthlyDatum[];
    categoryData: InfographicCategoryDatum[];
    supplierData: InfographicSupplierDatum[];
    riskySuppliers: InfographicRiskSupplierDatum[];
    stats: {
        totalSpend?: number | string;
        supplierCount?: number;
    };
}

function ChartTooltip({
    active,
    payload,
    label,
    formatValue,
}: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string }>;
    label?: string;
    formatValue: (value: number) => string;
}) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
            {label ? <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p> : null}
            <div className="mt-2 space-y-1.5">
                {payload.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-bold text-foreground">{formatValue(entry.value ?? 0)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HighlightCard({
    title,
    value,
    subtitle,
    icon,
    tone = "bg-slate-50 text-slate-700 border-slate-200",
    trend,
}: {
    title: string;
    value: string;
    subtitle: string;
    icon: ReactNode;
    tone?: string;
    trend?: number | null;
}) {
    return (
        <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{value}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${tone}`}>{icon}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
                {typeof trend === "number" ? (
                    <Badge
                        variant="outline"
                        className={trend >= 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"}
                    >
                        {trend >= 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                        {Math.abs(trend).toFixed(1)}%
                    </Badge>
                ) : null}
                <span className="text-muted-foreground">{subtitle}</span>
            </div>
        </div>
    );
}

export function InsightInfographics({
    monthlyData,
    categoryData,
    supplierData,
    riskySuppliers,
    stats,
}: InsightInfographicsProps) {
    const hasMounted = useSyncExternalStore(subscribe, () => true, () => false);

    const geoLocale = useMemo(
        () => hasMounted ? getGeoLocale() : getGeoLocale("IN"),
        [hasMounted],
    );

    const categoryMix = useMemo(() => buildCategoryMix(categoryData), [categoryData]);
    const highlights = useMemo(() => getInfographicHighlights({
        monthlyData,
        categoryData,
        supplierData,
        riskySuppliers,
        totalSpend: Number(stats.totalSpend ?? 0),
        supplierCount: Number(stats.supplierCount ?? 0),
    }), [categoryData, monthlyData, riskySuppliers, stats.supplierCount, stats.totalSpend, supplierData]);

    const topSuppliers = useMemo(
        () => [...supplierData].sort((a, b) => b.spend - a.spend).slice(0, 4),
        [supplierData],
    );
    const highestRiskSupplier = useMemo(
        () => [...supplierData].sort((a, b) => Number(b.riskScore ?? 0) - Number(a.riskScore ?? 0))[0] ?? null,
        [supplierData],
    );

    const formatCompactValue = (value: number) => formatLocalCurrencyCompact(value, geoLocale);
    const formatValue = (value: number) => formatLocalCurrency(value, geoLocale);

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Insight Infographics</h2>
                    <p className="text-sm text-muted-foreground">
                        A quick visual snapshot of spend momentum, category mix, and supplier exposure.
                    </p>
                </div>
                <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 text-primary">
                    Last 12 months
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HighlightCard
                    title="Spend under watch"
                    value={formatCompactValue(highlights.totalSpend)}
                    subtitle="Total enterprise spend tracked"
                    icon={<Landmark className="h-5 w-5" />}
                    tone="border-blue-200 bg-blue-50 text-blue-700"
                    trend={highlights.momentum.change}
                />
                <HighlightCard
                    title="Peak month"
                    value={highlights.peakMonth ? `${highlights.peakMonth.name}` : "No data"}
                    subtitle={highlights.peakMonth ? formatValue(highlights.peakMonth.total) : "Waiting for order history"}
                    icon={<TrendingUp className="h-5 w-5" />}
                    tone="border-emerald-200 bg-emerald-50 text-emerald-700"
                />
                <HighlightCard
                    title="Category spread"
                    value={String(highlights.activeCategories)}
                    subtitle="Active spend categories"
                    icon={<PieChartIcon className="h-5 w-5" />}
                    tone="border-violet-200 bg-violet-50 text-violet-700"
                />
                <HighlightCard
                    title="Supplier exposure"
                    value={`${highlights.criticalSuppliers}/${highlights.supplierCount}`}
                    subtitle="Critical suppliers above risk 60"
                    icon={<Globe2 className="h-5 w-5" />}
                    tone="border-amber-200 bg-amber-50 text-amber-700"
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
                <Card className="overflow-hidden border-primary/10 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Spend rhythm
                        </CardTitle>
                        <CardDescription>Monthly order value trend for quick executive review.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {monthlyData.length > 0 ? (
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                                        <YAxis
                                            tickLine={false}
                                            axisLine={false}
                                            fontSize={12}
                                            tickFormatter={(value) => formatCompactValue(value)}
                                            width={70}
                                        />
                                        <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                                        <Bar dataKey="total" name="Spend" radius={[10, 10, 0, 0]}>
                                            {monthlyData.map((entry, index) => (
                                                <Cell
                                                    key={`${entry.name}-${index}`}
                                                    fill={index === monthlyData.length - 1 ? "#2563eb" : "#93c5fd"}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                Spend data will appear once orders start flowing.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-violet-100 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                            <PieChartIcon className="h-4 w-4 text-violet-600" />
                            Category mix
                        </CardTitle>
                        <CardDescription>Where procurement activity is concentrated right now.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {categoryMix.length > 0 ? (
                            <>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryMix}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={54}
                                                outerRadius={84}
                                                paddingAngle={4}
                                            >
                                                {categoryMix.map((entry, index) => (
                                                    <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid gap-2">
                                    {categoryMix.map((entry, index) => (
                                        <div key={entry.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="h-2.5 w-2.5 rounded-full"
                                                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                                />
                                                <span className="font-medium text-foreground">{entry.name}</span>
                                            </div>
                                            <span className="text-muted-foreground">{formatCompactValue(entry.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                Category insights will unlock with order line items.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-amber-100 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide">
                            <BriefcaseBusiness className="h-4 w-4 text-amber-600" />
                            Supplier pulse
                        </CardTitle>
                        <CardDescription>Top supplier concentration and active risk watchlist.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                        {topSuppliers.length > 0 ? (
                            <div className="space-y-3">
                                {topSuppliers.map((supplier) => (
                                    <div key={supplier.name} className="rounded-2xl border bg-muted/20 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{supplier.name}</p>
                                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                    {supplier.orders} orders · Perf {supplier.reliability}% · Risk {Number(supplier.riskScore ?? 0)}
                                                </p>
                                            </div>
                                            <p className="text-sm font-black text-foreground">{formatCompactValue(supplier.spend)}</p>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-amber-100">
                                            <div
                                                className="h-2 rounded-full bg-amber-500"
                                                style={{ width: `${Math.max(12, Math.min(100, supplier.reliability))}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                Supplier spend signals will surface here.
                            </div>
                        )}

                        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                    <p className="text-sm font-black uppercase tracking-wide text-red-700">Risk watchlist</p>
                                </div>
                                <Badge className="bg-red-500 text-white hover:bg-red-500">{highlights.criticalSuppliers} live</Badge>
                            </div>
                            <div className="mt-3 space-y-2">
                                {riskySuppliers.length > 0 ? riskySuppliers.slice(0, 3).map((supplier) => (
                                    <div key={supplier.id} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-red-950">{supplier.name}</span>
                                        <span className="font-black text-red-700">Risk {supplier.riskScore ?? 0}</span>
                                    </div>
                                )) : (
                                    <p className="text-sm text-red-800/80">
                                        {highestRiskSupplier && Number(highestRiskSupplier.riskScore ?? 0) > 0
                                            ? `No suppliers currently exceed the critical threshold. Highest current risk: ${highestRiskSupplier.name} at ${Number(highestRiskSupplier.riskScore ?? 0)}.`
                                            : "No suppliers currently exceed the risk threshold."}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
