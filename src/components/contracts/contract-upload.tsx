"use client"

import { useState, useCallback } from "react"
// Removed react-dropzone to avoid build errors
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { FileText, Upload, Check, AlertCircle, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { parseContractDocument } from "@/app/actions/ai-agents"

interface ExtractedData {
    effectiveDate?: string | null;
    expirationDate?: string | null;
    noticePeriodDays?: number | null;
    liabilityCapAmount?: number | null;
    priceLockDurationMonths?: number | null;
    autoRenewal?: boolean | null;
    summary?: string | null;
}

interface ContractUploadProps {
    onDataExtracted: (data: ExtractedData, file: File) => void;
}

export function ContractUpload({ onDataExtracted }: ContractUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);

    const handleFile = useCallback(async (selectedFile: File) => {
        if (!selectedFile) return;

        if (selectedFile.size > 10 * 1024 * 1024) {
            toast.error("File size too large. Max 10MB allowed.");
            return;
        }

        setFile(selectedFile);

        // Simulate extraction process
        setUploading(true);
        setProgress(10);

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(selectedFile);

            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                setProgress(40);

                toast.info("AI is analyzing legal terms...");

                const result = await parseContractDocument(base64Data, selectedFile.name);
                setProgress(90);

                if (result.success && result.data) {
                    setExtractedData(result.data);
                    setProgress(100);
                    toast.success("Contract data extracted successfully!");
                } else {
                    toast.error("AI parsing failed to extract meaningful data.");
                    setUploading(false);
                    setProgress(0);
                }
            };
        } catch (error) {
            console.error(error);
            toast.error("Failed to read file.");
            setUploading(false);
            setProgress(0);
        }
    }, [onDataExtracted]);

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
    }, []);

    const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    }, [handleFile]);

    const handleApply = () => {
        if (extractedData && file) {
            onDataExtracted(extractedData, file);
        }
    };

    const reset = () => {
        setFile(null);
        setExtractedData(null);
        setUploading(false);
        setProgress(0);
    };

    return (
        <div className="w-full space-y-6">
            {!extractedData ? (
                <div
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={() => document.getElementById('contract-upload-input')?.click()}
                    className={`
                        border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300
                        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}
                        ${uploading ? 'pointer-events-none opacity-50' : ''}
                    `}
                >
                    <input
                        id="contract-upload-input"
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={onFileInput}
                    />
                    <div className="flex flex-col items-center gap-4">
                        <div className={`p-4 rounded-full bg-muted transition-all ${isDragActive ? 'scale-110 bg-primary/10' : ''}`}>
                            {uploading ? (
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            ) : (
                                <Upload className="h-8 w-8 text-muted-foreground" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-lg max-w-xs mx-auto">
                                {uploading ? "Analyzing Contract..." : "Drop your contract here"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {uploading ? "Gemini is reading the fine print for you." : "PDF, JPG, or PNG (Max 10MB)"}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <Card className="border-emerald-100 bg-emerald-50/10 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                        <div className="space-y-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                                AI Extracted Intelligence
                            </CardTitle>
                            <CardDescription>
                                Verify the extracted data below.
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={reset}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-6 grid gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Expiry Date</span>
                                <div className="text-sm font-medium">{extractedData.expirationDate || "Not found"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Notice Period</span>
                                <div className="text-sm font-medium">{extractedData.noticePeriodDays ? `${extractedData.noticePeriodDays} Days` : "Not specific"}</div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Liability Cap</span>
                                <div className="text-sm font-medium font-mono">
                                    {extractedData.liabilityCapAmount
                                        ? `₹${extractedData.liabilityCapAmount.toLocaleString()}`
                                        : <Badge variant="outline" className="text-amber-600 bg-amber-50">Unknown Risk</Badge>
                                    }
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Auto-Renewal</span>
                                <div>
                                    {extractedData.autoRenewal ? (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="h-3 w-3" /> Yes
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-emerald-600 bg-emerald-50 gap-1">
                                            <Check className="h-3 w-3" /> No
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {extractedData.summary && (
                            <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider block mb-1">Contract Summary</span>
                                <p className="text-sm text-foreground/90 italic">"{extractedData.summary}"</p>
                            </div>
                        )}

                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApply}>
                            <Check className="mr-2 h-4 w-4" />
                            Apply Extracted Data
                        </Button>
                    </CardContent>
                </Card>
            )}

            {uploading && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Parsing legal text...</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            )}
        </div>
    );
}
