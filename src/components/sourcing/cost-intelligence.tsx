'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Sparkles, Loader2, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { analyzeCosts } from "@/app/actions/ai-agents";
import { toast } from "sonner";

interface Variance {
    sku: string;
    variancePercentage: number;
    trend: "up" | "down" | "stable";
}

interface CostAnalysisResult {
    variances: Variance[];
    negotiationStrategy: string;
    potentialSavings: number;
}

export function CostIntelligence({ quoteItems, historicalParts }: { quoteItems: any[], historicalParts: any[] }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<CostAnalysisResult | null>(null);

    const handleAnalyze = async () => {
        if (!quoteItems.length) {
            toast.warning("No quote data found for cost analysis.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const response = await analyzeCosts(quoteItems, historicalParts);

            if (response.success) {
                setResult(response.data);
                toast.success("Cost intelligence analysis complete.");
            } else {
                toast.error("Failed to analyze costs");
            }
        } catch (error) {
            toast.error("An error occurred during cost analysis");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-4 rounded-lg bg-muted/30 border border-muted flex flex-col gap-4">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <TrendingUp className={`h-5 w-5 mt-0.5 ${result ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    <div>
                        <p className="text-sm font-bold">Should-Cost & Savings Intelligence</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {result
                                ? `Analyzing variances against ${historicalParts.length} historical benchmarks.`
                                : "Price variance analysis against historical data and market trends."
                            }
                        </p>
                    </div>
                </div>
                {!result && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[10px] uppercase font-bold text-primary gap-1.5"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Compare Prices
                    </Button>
                )}
            </div>

            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-background rounded border border-primary/20 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Potential Savings</p>
                            <p className="text-lg font-black text-primary">{formatCurrency(result.potentialSavings)}</p>
                        </div>
                        <div className="p-3 bg-background rounded border border-border/50 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg. Variance</p>
                            <p className="text-lg font-black">{Math.round(result.variances.reduce((acc, v) => acc + v.variancePercentage, 0) / result.variances.length)}%</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SKU Variances</p>
                        <div className="grid gap-2">
                            {result.variances.map((v, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded bg-background border border-border/50">
                                    <span className="text-[10px] font-mono font-bold text-muted-foreground">{v.sku}</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[11px] font-bold ${v.variancePercentage > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {v.variancePercentage > 0 ? '+' : ''}{v.variancePercentage}%
                                        </span>
                                        {v.trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-red-500" /> :
                                            v.trend === 'down' ? <ArrowDownRight className="h-3 w-3 text-green-500" /> :
                                                <Minus className="h-3 w-3 text-muted-foreground" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-3 rounded bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            <p className="text-[10px] font-bold text-blue-700 uppercase">Negotiation Strategy</p>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed">{result.negotiationStrategy}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
