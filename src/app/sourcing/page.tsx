export const dynamic = 'force-dynamic';

import React from 'react';
import { SuggestedRequisitions } from "@/components/dashboard/suggested-requisitions";
import { ContractAlerts } from "@/components/dashboard/contract-alerts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Zap,
    Target,
    ArrowUpRight,
    Briefcase,
    BarChart3
} from "lucide-react";
import Link from "next/link";
import { getSpendStats } from "@/app/actions/analytics";
import { getMarketIntelligenceSummary } from "@/app/actions/cost-intelligence";
import { RefreshBenchmarksButton } from "@/components/sourcing/refresh-benchmarks-button";
import { auth } from "@/auth";

export default async function SourcingIntelligencePage() {
    const session = await auth();
    const isAdmin = session?.user?.role === 'admin';
    const stats = await getSpendStats();
    const marketSummary = await getMarketIntelligenceSummary().catch(() => ({
        benchmarkCoverage: 0,
        categoriesTracked: 0,
        totalCategories: 0,
        rfqsReadyForNegotiation: 0,
        hotCategories: [] as Array<{
            category: string;
            averagePrice: number;
            benchmarkPrice: number;
            spend: number;
            lineCount: number;
            gapPercent: number;
            signal: string;
            source: string;
        }>,
        lastBenchmarkRefresh: null as Date | null,
    }));
    const leadCategory = marketSummary.hotCategories[0] || null;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 flex items-center gap-3">
                        Sourcing Command Hub
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Strategic oversight of requisitions, contracts, and savings opportunities.</p>
                </div>
                {isAdmin ? <RefreshBenchmarksButton /> : null}
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-l-4 border-l-primary bg-gradient-to-br from-background to-primary/5 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            Sourcing Alpha
                            <Zap className="h-4 w-4 text-primary fill-primary" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.savingsRate}%</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">Negotiated Savings Rate</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            Realized Cost Avoidance
                            <Target className="h-4 w-4 text-emerald-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">INR {stats.realizedSavings.toLocaleString()}</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">Total Savings Identified</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            Benchmark Coverage
                            <BarChart3 className="h-4 w-4 text-amber-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">{marketSummary.benchmarkCoverage}%</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">{marketSummary.categoriesTracked}/{marketSummary.totalCategories} categories benchmarked</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-sky-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            Negotiation Queue
                            <ArrowUpRight className="h-4 w-4 text-sky-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-sky-700">{marketSummary.rfqsReadyForNegotiation}</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">RFQs with 2+ live quotes</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                <div className="space-y-8">
                    <SuggestedRequisitions />
                    <Card className="bg-stone-900 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Briefcase size={80} />
                        </div>
                        <CardHeader>
                            <CardTitle>Category Strategy</CardTitle>
                            <CardDescription className="text-stone-400">Internal benchmark intelligence generated from real Axiom order and quote history.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {leadCategory ? (
                                <p className="text-sm text-stone-300 leading-relaxed">
                                    <strong>{leadCategory.category}</strong> is the strongest current negotiation target.
                                    Buyers are paying around <strong>INR {leadCategory.averagePrice.toLocaleString()}</strong> against an internal benchmark of <strong>INR {leadCategory.benchmarkPrice.toLocaleString()}</strong>, leaving a <strong>{leadCategory.gapPercent}%</strong> pricing gap to attack.
                                </p>
                            ) : (
                                <p className="text-sm text-stone-300 leading-relaxed">
                                    Refresh benchmark intelligence to start building live category strategies from your own order and quote history.
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Link href="/sourcing/rfqs?action=new" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
                                    Initiate Framework RFQ <ArrowUpRight size={14} />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Market Intelligence Feed</CardTitle>
                            <CardDescription>
                                Highest-signal categories from internal benchmarks and realized spend.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {marketSummary.hotCategories.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No benchmark categories available yet.</p>
                            ) : marketSummary.hotCategories.map((category) => (
                                <div key={category.category} className="rounded-xl border p-3 bg-background/80">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-sm">{category.category}</p>
                                            <p className="text-xs text-muted-foreground">{category.signal} signal from {category.source}</p>
                                        </div>
                                        <div className={`text-sm font-black ${category.gapPercent > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {category.gapPercent > 0 ? '+' : ''}{category.gapPercent}%
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                                        <span>Avg buy price: INR {category.averagePrice.toLocaleString()}</span>
                                        <span>Benchmark: INR {category.benchmarkPrice.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <ContractAlerts />
                </div>
            </div>
        </div>
    );
}
