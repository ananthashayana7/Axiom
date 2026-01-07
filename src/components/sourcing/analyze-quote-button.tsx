'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { processQuotation } from "@/app/actions/rfqs";
import { toast } from "sonner";

interface AnalyzeQuoteButtonProps {
    rfqSupplierId: string;
    hasAnalysis: boolean;
}

export function AnalyzeQuoteButton({ rfqSupplierId, hasAnalysis }: AnalyzeQuoteButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleAnalyze = () => {
        const mockText = "Quotation for Q1 Parts. Total: ₹4,80,000. Delivery in 4 weeks. Terms: Net 30. All parts are ROHS compliant.";

        startTransition(async () => {
            const result = await processQuotation(rfqSupplierId, mockText);
            if (result.success) {
                toast.success("Quotation parsed and analyzed by AI!");
            } else {
                toast.error("Quotation analysis failed");
            }
        });
    };

    return (
        <Button
            size="sm"
            variant={hasAnalysis ? "outline" : "default"}
            className={!hasAnalysis ? "bg-primary text-primary-foreground group" : "text-primary border-primary/20"}
            onClick={handleAnalyze}
            disabled={isPending}
        >
            {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : hasAnalysis ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            ) : (
                <Sparkles className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
            )}
            {hasAnalysis ? "Update Analysis" : "AI Analyze Quote"}
        </Button>
    );
}
