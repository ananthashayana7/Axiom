'use client'

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, CheckCircle2, FileUp } from "lucide-react";
import { processQuotationFile } from "@/app/actions/rfqs";
import { toast } from "sonner";

interface AnalyzeQuoteButtonProps {
    rfqSupplierId: string;
    hasAnalysis: boolean;
}

export function AnalyzeQuoteButton({ rfqSupplierId, hasAnalysis }: AnalyzeQuoteButtonProps) {
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            toast.error("Please upload a PDF or image (JPEG/PNG)");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];

            startTransition(async () => {
                const result = await processQuotationFile(rfqSupplierId, base64, file.name);
                if (result.success) {
                    toast.success("Quotation parsed and analyzed by AI!");
                } else {
                    toast.error(result.error || "Quotation analysis failed");
                }
            });
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
            />
            <Button
                size="sm"
                variant={hasAnalysis ? "outline" : "default"}
                className={!hasAnalysis ? "bg-primary text-primary-foreground group" : "text-primary border-primary/20"}
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
            >
                {isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : hasAnalysis ? (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                ) : (
                    <FileUp className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                )}
                {hasAnalysis ? "Update Analysis" : "AI Analyze Quote"}
            </Button>
        </>
    );
}
