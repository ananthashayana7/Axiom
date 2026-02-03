'use client'

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Sparkles, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { analyzeSupplierRisk } from "@/app/actions/ai-agents";
import { toast } from "sonner";

import { MitigationAction } from "@/components/admin/mitigation-action";

interface RiskResult {
    overallRiskLevel: "low" | "medium" | "high" | "critical";
    riskScore: number;
    mitigationStrategy: string;
    keyAlerts: string[];
}

export function RiskIntelligenceView({ supplier }: { supplier: any }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<RiskResult | null>(null);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const response = await analyzeSupplierRisk(supplier);

            if (response.success) {
                setResult(response.data);
                toast.success(`Risk intelligence analysis complete for ${supplier.name}.`);
            } else {
                toast.error("Failed to analyze risk profile");
            }
        } catch (error) {
            toast.error("An error occurred during risk analysis");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-red-600 text-white';
            case 'high': return 'bg-red-500 text-white';
            case 'medium': return 'bg-amber-500 text-white';
            case 'low': return 'bg-green-500 text-white';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <div className="p-4 rounded-xl border bg-background/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-primary border-primary/20 uppercase text-[10px]">AI Assessment</Badge>
                {!result && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] font-bold text-primary gap-1.5"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Run Risk Deep-Dive
                    </Button>
                )}
            </div>

            <Link href={`/suppliers/${supplier.id}`}>
                <h4 className="font-bold mb-1 hover:text-primary transition-colors">{supplier.name}</h4>
            </Link>
            <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-muted-foreground">
                    Current Risk Score: <strong>{supplier.riskScore || 0}</strong>
                </p>
                <MitigationAction
                    supplierId={supplier.id}
                    supplierName={supplier.name}
                    currentRisk={supplier.riskScore}
                    type="link"
                />
            </div>

            {result ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-2">
                        <Badge className={`${getRiskColor(result.overallRiskLevel)} border-none text-[10px] font-black uppercase px-2`}>
                            {result.overallRiskLevel} Risk
                        </Badge>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${result.riskScore > 70 ? 'bg-red-500' : result.riskScore > 40 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${result.riskScore}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold">{result.riskScore}%</span>
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Key Alerts</p>
                        {result.keyAlerts.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] leading-tight">
                                <AlertCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                <span>{a}</span>
                            </div>
                        ))}
                    </div>

                    <div className="p-2.5 rounded bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            <p className="text-[10px] font-bold text-primary uppercase">Mitigation Strategy</p>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed italic">{result.mitigationStrategy}</p>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground line-clamp-2">
                    Run the AI deep-dive to analyze performance data, ESG compliance, and financial stability signals.
                </p>
            )}
        </div>
    );
}

