"use client";

import Link from "next/link";
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
    ArrowUpRight,
    BriefcaseBusiness,
    CircleHelp,
    FileWarning,
    ListChecks,
    PackageSearch,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";

const CHART_COLORS = [
    "hsl(221, 83%, 53%)", // Vibrant Blue
    "hsl(262, 83%, 58%)", // Rich Purple
    "hsl(160, 84%, 39%)", // Emerald
    "hsl(35, 92%, 53%)",  // Amber
    "hsl(348, 83%, 47%)", // Rose
    "hsl(199, 89%, 48%)", // Sky Blue
];

type QuickAction = {
    key: "support" | "suppliers" | "findings" | "tasks";
    href: string;
    title: string;
    subtitle: string;
    countLabel?: string | null;
};

type MonthlyDatum = {
    name: string;
    total: number;
    orders?: number;
};

type CategoryDatum = {
    name: string;
    value: number;
    count?: number;
};

type CountryDatum = {
    countryCode: string;
    total: number;
    orders: number;
};

function QuickActionIcon({ actionKey }: { actionKey: QuickAction["key"] }) {
    switch (actionKey) {
        case "support":
            return <CircleHelp className="h-5 w-5 text-slate-700" />;
        case "suppliers":
            return <PackageSearch className="h-5 w-5 text-blue-700" />;
        case "findings":
            return <FileWarning className="h-5 w-5 text-rose-700" />;
        case "tasks":
            return <ListChecks className="h-5 w-5 text-sky-700" />;
        default:
            return <BriefcaseBusiness className="h-5 w-5 text-slate-700" />;
    }
}

function quickActionTone(actionKey: QuickAction["key"]) {
    switch (actionKey) {
        case "support":
            return "border-slate-200/50 bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner";
        case "suppliers":
            return "border-blue-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-inner";
        case "findings":
            return "border-rose-200/50 bg-gradient-to-br from-rose-50 to-orange-50 shadow-inner";
        case "tasks":
            return "border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 shadow-inner";
        default:
            return "border-slate-200/50 bg-gradient-to-br from-slate-50 to-slate-100 shadow-inner";
    }
}

function formatCountryLabel(countryCode: string) {
    try {
        const display = new Intl.DisplayNames(["en"], { type: "region" });
        return display.of(countryCode) || countryCode;
    } catch {
        return countryCode;
    }
}

function formatFlag(countryCode: string) {
    const normalized = countryCode?.toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) {
        return "🌐";
    }

    return String.fromCodePoint(...normalized.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function ChartTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string }>;
    label?: string;
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
                        <span className="font-bold text-foreground">{formatCurrency(entry.value ?? 0)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ProcurementCommandBoard({
    quickActions,
    monthlyData,
    categoryData,
    countryData,
}: {
    quickActions: QuickAction[];
    monthlyData: MonthlyDatum[];
    categoryData: CategoryDatum[];
    countryData: CountryDatum[];
}) {
    const topCategories = categoryData
        .filter((entry) => Number(entry.value || 0) > 0)
        .slice(0, 6);

    return (
        <section className="space-y-6">
            <div className="grid gap-3 xl:grid-cols-4">
                {quickActions.map((action) => (
                    <Link key={action.key} href={action.href}>
                        <Card className="h-full border-slate-200/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 group">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className={`rounded-2xl border p-4 transition-transform duration-300 group-hover:scale-105 ${quickActionTone(action.key)}`}>
                                    <QuickActionIcon actionKey={action.key} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="truncate text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{action.title}</p>
                                        <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-1">{action.subtitle}</p>
                                    {action.countLabel ? (
                                        <Badge variant="outline" className="mt-2.5 border-slate-200/60 bg-white/50 text-[10px] font-bold tracking-wider uppercase text-slate-700 backdrop-blur-sm">
                                            {action.countLabel}
                                        </Badge>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-black tracking-tight text-slate-900">Procurement analytics board</CardTitle>
                    <CardDescription>
                        Live spend, category concentration, and sourcing geography from the current operating dataset.
                    </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 space-y-6">
                    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
                        <Card className="min-w-0 border-slate-200 shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-black">Spend volume</CardTitle>
                                <CardDescription>Monthly posted order value across the live operating dataset.</CardDescription>
                            </CardHeader>
                            <CardContent className="min-w-0 pt-2">
                                {monthlyData.length > 0 ? (
                                    <div className="h-[300px] min-w-0 w-full relative">
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={monthlyData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                                                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} tickMargin={8} />
                                                <YAxis
                                                    tickLine={false}
                                                    axisLine={false}
                                                    fontSize={11}
                                                    tickFormatter={(value) => formatCurrency(value).replace(".00", "")}
                                                    width={80}
                                                    tickMargin={8}
                                                />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(37, 99, 235, 0.04)" }} />
                                                <Bar dataKey="total" name="Spend" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                                    {monthlyData.map((entry, index) => (
                                                        <Cell key={`${entry.name}-${index}`} fill={index === monthlyData.length - 1 ? "hsl(221, 83%, 53%)" : "hsl(221, 83%, 85%)"} className="transition-all duration-300 hover:opacity-80" />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                        Spend analytics will unlock once posted orders are available.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="min-w-0 border-slate-200 shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-black">Category volume</CardTitle>
                                <CardDescription>Current portfolio concentration across spend categories.</CardDescription>
                            </CardHeader>
                            <CardContent className="min-w-0 pt-2">
                                {topCategories.length > 0 ? (
                                    <>
                                        <div className="h-[220px] min-w-0 w-full relative">
                                            <ResponsiveContainer width="100%" height={220}>
                                                <PieChart>
                                                    <Pie
                                                        data={topCategories}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        innerRadius={54}
                                                        outerRadius={86}
                                                        paddingAngle={4}
                                                        stroke="none"
                                                    >
                                                        {topCategories.map((entry, index) => (
                                                            <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="transition-all duration-300 hover:opacity-80" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<ChartTooltip />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-2">
                                            {topCategories.map((entry, index) => (
                                                <div key={entry.name} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                                                        <span className="font-medium text-slate-700">{entry.name}</span>
                                                    </div>
                                                    <span className="text-slate-500">{formatCurrency(entry.value).replace(".00", "")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                        Category concentration appears once order lines are mapped.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="min-w-0 border-slate-200 shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-black">Country volume</CardTitle>
                                <CardDescription>Top geographies ranked by sourced order volume.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {countryData.length > 0 ? (
                                    <div className="space-y-4">
                                        {countryData.map((country, index) => {
                                            const maxValue = Math.max(...countryData.map((entry) => entry.total), 1);
                                            const width = `${Math.max(10, Math.round((country.total / maxValue) * 100))}%`;
                                            return (
                                                <div key={`${country.countryCode}-${index}`} className="space-y-2">
                                                    <div className="flex items-center justify-between gap-3 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{formatFlag(country.countryCode)}</span>
                                                            <div>
                                                                <p className="font-semibold text-slate-900">{formatCountryLabel(country.countryCode)}</p>
                                                                <p className="text-xs text-slate-500">{country.orders} orders</p>
                                                            </div>
                                                        </div>
                                                        <p className="font-black text-slate-900">{formatCurrency(country.total).replace(".00", "")}</p>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-blue-600" style={{ width }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                                        Country-level sourcing volume will appear once supplier geography is populated.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex justify-end">
                        <Link href="/admin/analytics">
                            <Button variant="outline" className="gap-2">
                                Open analytics
                                <ArrowUpRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
