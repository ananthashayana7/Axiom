"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SavingsWidgetProps {
    totalSpend: number;
    realizedSavings: number;
    savingsRate: number;
}

export function SavingsWidget({ totalSpend, realizedSavings, savingsRate }: SavingsWidgetProps) {
    return (
        <Card className="col-span-2 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2 text-emerald-900">
                            <PiggyBank className="h-5 w-5 text-emerald-600" />
                            Cost Avoidance & Savings
                        </CardTitle>
                        <CardDescription>Realized savings through negotiation and strategic sourcing.</CardDescription>
                    </div>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700">Year to Date</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-6 mb-6">
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Spend</span>
                        <div className="text-2xl font-bold text-slate-700">₹{totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Realized Savings</span>
                        <div className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
                            ₹{realizedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <div className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                +{savingsRate}%
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target vs Actual</span>
                        <div className="flex items-end gap-2">
                            <div className="text-lg font-bold text-slate-700">92%</div>
                            <span className="text-xs text-muted-foreground mb-1">of annual target</span>
                        </div>
                        <Progress value={92} className="h-1.5 bg-emerald-100 [&>div]:bg-emerald-500" />
                    </div>
                </div>

                <div className="bg-white/50 rounded-xl border border-emerald-100/50 p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-emerald-500" />
                        Top Savings Opportunities
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Logistics Rate Negotiation</span>
                            <div className="flex items-center gap-4">
                                <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">In Progress</Badge>
                                <span className="font-mono font-medium">Est. ₹4.2L</span>
                            </div>
                        </div>
                        <div className="separator border-b border-dashed border-emerald-100"></div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Bulk IT Hardware Procurement</span>
                            <div className="flex items-center gap-4">
                                <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">Negotiating</Badge>
                                <span className="font-mono font-medium">Est. ₹12.5L</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
