'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Sparkles, Loader2 } from "lucide-react";
import { analyzeCompliance } from "@/app/actions/ai-agents";
import { toast } from "sonner";

interface ComplianceResult {
    status: "compliant" | "partial" | "non-compliant";
    findings: { type: "mismatch" | "missing" | "risk", description: string, severity: "low" | "medium" | "high" }[];
    recommendation: string;
}

export function ComplianceStatus({ rfqId, rfqRequirements, initialDocuments }: { rfqId: string, rfqRequirements: string, initialDocuments: any[] }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<ComplianceResult | null>(null);

    const handleAnalyze = async () => {
        if (!initialDocuments.length) {
            toast.warning("No documents found to analyze compliance.");
            return;
        }

        setIsAnalyzing(true);
        try {
            // In a real app we'd fetch the document contents, here we'll simulate document text for analysis
            const docs = initialDocuments.map(d => ({ name: d.name, content: `Document content for ${d.name}` }));
            const response = await analyzeCompliance(docs, rfqRequirements);

            if (response.success) {
                setResult(response.data);
                toast.success("Compliance intelligence analysis complete.");
            } else {
                toast.error("Failed to analyze compliance");
            }
        } catch (error) {
            toast.error("An error occurred during compliance analysis");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'compliant': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'partial': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'non-compliant': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-muted-foreground';
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'high': return <XCircle className="h-3 w-3 text-red-500" />;
            case 'medium': return <AlertTriangle className="h-3 w-3 text-amber-500" />;
            default: return <AlertTriangle className="h-3 w-3 text-blue-500" />;
        }
    };

    return (
        <div className="p-4 rounded-lg bg-muted/30 border border-muted flex flex-col gap-4">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <ShieldCheck className={`h-5 w-5 mt-0.5 ${result ? (result.status === 'compliant' ? 'text-green-500' : 'text-amber-500') : 'text-muted-foreground'}`} />
                    <div>
                        <p className="text-sm font-bold">Compliance & Risk Status</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {result
                                ? `AI evaluated ${initialDocuments.length} documents against sourcing requirements.`
                                : "Automated IQ check for certification, technical specs, and contract clauses."
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
                        Run Check
                    </Button>
                )}
            </div>

            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className={`p-2 rounded border text-[10px] font-bold uppercase text-center ${getStatusColor(result.status)}`}>
                        {result.status.replace('-', ' ')}
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Findings</p>
                        {result.findings.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded bg-background border border-border/50">
                                {getSeverityIcon(f.severity)}
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{f.type}</p>
                                    <p className="text-[11px] leading-tight mt-0.5">{f.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 rounded bg-primary/5 border border-primary/20">
                        <p className="text-[10px] font-bold text-primary uppercase mb-1">Recommendation</p>
                        <p className="text-[11px] font-medium leading-relaxed italic">{result.recommendation}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
