'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Sparkles, Loader2, TrendingUp, TrendingDown, Target, Zap } from "lucide-react";
import { analyzeSpend } from "@/app/actions/ai-agents";
import { toast } from "sonner";

interface SpendOpportunity {
    type: "consolidation" | "contract" | "arbitrage";
    description: string;
    estimatedSavings: number;
}

interface SpendResult {
    totalSavingPotential: number;
    opportunities: SpendOpportunity[];
    actionPlan: string;
}

export function SpendAnalysisView({ orders, suppliers }: { orders: any[], suppliers: any[] }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<SpendResult | null>(null);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const response = await analyzeSpend(orders, suppliers);

            if (response.success) {
                setResult(response.data);
                toast.success("Spend intelligence analysis complete.");
            } else {
                toast.error("Failed to analyze spend patterns");
            }
        } catch (error) {
            toast.error("An error occurred during spend analysis");
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
        <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-primary" />
                        Axiom Spend Intelligence
                    </CardTitle>
                    <CardDescription>AI scanning for consolidation and contract optimization opportunities.</CardDescription>
                </div>
                {!result && (
                    <Button
                        size="sm"
                        variant="default"
                        className="bg-primary hover:bg-primary/90 gap-2"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isAnalyzing ? "Processing..." : "Run Global Spend Audit"}
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {result ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="p-6 bg-background rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center">
                                <Target className="h-8 w-8 text-primary mb-3" />
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Unfiltered Opportunity</p>
                                <p className="text-3xl font-black text-primary">{formatCurrency(result.totalSavingPotential)}</p>
                                <p className="text-[10px] text-muted-foreground mt-2 italic">Based on past 12 months volume.</p>
                            </div>

                            <div className="md:col-span-2 space-y-4">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Saving Levers Identified</p>
                                <div className="grid gap-3">
                                    {result.opportunities.map((o, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-background hover:border-primary/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <Zap className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <Badge variant="secondary" className="text-[10px] uppercase mb-1">{o.type}</Badge>
                                                    <p className="text-sm font-semibold leading-tight">{o.description}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="text-sm font-black text-green-600">+{formatCurrency(o.estimatedSavings)}</p>
                                                <p className="text-[10px] text-muted-foreground">Est. Annual Gain</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-5 w-5 text-primary" />
                                <h4 className="font-bold text-primary">AI Action Plan</h4>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/80 font-medium">{result.actionPlan}</p>
                        </div>
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-6 rounded-full bg-primary/5 border border-dashed border-primary/30">
                            <Wallet className="h-12 w-12 text-primary/30" />
                        </div>
                        <div className="max-w-md">
                            <p className="font-bold text-lg">No audit data currently visible</p>
                            <p className="text-sm text-muted-foreground">
                                Click the button above to have Axiom AI scan your purchase orders, RFQs, and supplier contracts for hidden efficiencies.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
