'use client'

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Package,
    ArrowRight,
    AlertCircle,
    Sparkles,
    ShoppingCart
} from "lucide-react";
import { getSuggestedReplenishments, predictReplenishmentAlert } from "@/app/actions/replenishment";
import Link from "next/link";

export function SuggestedRequisitions() {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await getSuggestedReplenishments();
            // Enrich with AI for the first 2 suggestions
            const enriched = await Promise.all(data.slice(0, 2).map(async (s) => {
                const ai = await predictReplenishmentAlert(s.partId);
                return { ...s, ai };
            }));
            setSuggestions([...enriched, ...data.slice(2)]);
            setLoading(false);
        };
        load();
    }, []);

    if (loading) return <div className="animate-pulse bg-muted rounded-xl h-[300px]" />;
    if (suggestions.length === 0) return null;

    return (
        <Card className="border-emerald-200/50 bg-emerald-50/5 shadow-none overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-emerald-100 bg-emerald-50/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900">
                        <Sparkles className="h-4 w-4 fill-emerald-600 text-emerald-600" />
                        <CardTitle className="text-base font-bold">Predictive Replenishment</CardTitle>
                    </div>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700">AI Optimized</Badge>
                </div>
                <CardDescription className="text-emerald-700/60 text-xs">Axiom identifies part shortages before they impact production.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-emerald-100/50">
                    {suggestions.slice(0, 3).map((s) => (
                        <div key={s.partId} className="p-4 hover:bg-emerald-50/30 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-stone-900">{s.partName}</span>
                                        <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded uppercase">{s.sku}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-stone-500">Stock: <strong className={s.currentStock === 0 ? 'text-red-500' : 'text-stone-900'}>{s.currentStock}</strong>/{s.minStock}</span>
                                        {s.ai && (
                                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                Next out: {s.ai.daysUntilStockOut} days
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" className="h-8 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" asChild>
                                    <Link href={`/sourcing/requisitions/new?partId=${s.partId}`}>
                                        Draft Reqn <ArrowRight className="h-3 w-3" />
                                    </Link>
                                </Button>
                            </div>
                            {s.ai && (
                                <div className="mt-3 p-2 bg-white/60 rounded-lg border border-emerald-100 text-[10px] text-emerald-900 leading-relaxed italic">
                                    " {s.ai.insight} "
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
