'use server'

import React from 'react';
import { SuggestedRequisitions } from "@/components/dashboard/suggested-requisitions";
import { ContractAlerts } from "@/components/dashboard/contract-alerts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Zap,
    Target,
    ArrowUpRight,
    ShieldCheck,
    Briefcase
} from "lucide-react";
import Link from "next/link";
import { getSpendStats } from "@/app/actions/analytics";

export default async function SourcingIntelligencePage() {
    const stats = await getSpendStats();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 flex items-center gap-3">
                        Sourcing Command Hub
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Strategic oversight of requisitions, contracts, and savings opportunities.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                        <div className="text-2xl font-bold text-emerald-700">₹{stats.realizedSavings.toLocaleString()}</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">Total Savings Identified</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            Strategic Sourcing
                            <ShieldCheck className="h-4 w-4 text-amber-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">92%</div>
                        <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-wider font-bold">Contract Compliance</p>
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
                            <CardDescription className="text-stone-400">AI-suggested sourcing strategies for electronics.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-stone-300 leading-relaxed">
                                Market volatility in raw silicon is projected to increase by 8% in Q3.
                                Axiom recommends transitioning from Spot buys to Framework Agreements for <strong>Passive Components</strong>.
                            </p>
                            <div className="flex gap-2">
                                <Link href="/sourcing/rfqs/new" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
                                    Initiate Framework RFQ <ArrowUpRight size={14} />
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <ContractAlerts />
                </div>
            </div>
        </div>
    );
}
