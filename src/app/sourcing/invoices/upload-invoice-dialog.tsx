'use client'

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { createInvoice } from "@/app/actions/invoices";
import { toast } from "sonner";

interface OCRData {
    invoiceNumber: string | null;
    amount: number | null;
    currency: string | null;
    supplierName: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    taxAmount: number | null;
    subtotal: number | null;
    lineItems: { description: string; quantity: number; unitPrice: number; totalPrice: number }[];
    paymentTerms: string | null;
    purchaseOrderRef: string | null;
}

interface OCRResponse {
    success: boolean;
    data?: OCRData;
    source?: string;
    warnings?: string[];
    requiresReview?: boolean;
    error?: string;
}

interface UploadInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    suppliers: { id: string; name: string }[];
}

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp']);

const EMPTY_OCR_DATA: OCRData = {
    invoiceNumber: null,
    amount: null,
    currency: 'INR',
    supplierName: null,
    invoiceDate: null,
    dueDate: null,
    taxAmount: null,
    subtotal: null,
    lineItems: [],
    paymentTerms: null,
    purchaseOrderRef: null,
};

function isSupportedInvoiceFile(file: File) {
    if (file.type.startsWith('image/') || file.type === 'application/pdf') return true;

    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension ? SUPPORTED_EXTENSIONS.has(extension) : false;
}

export function UploadInvoiceDialog({ open, onOpenChange, onSuccess, suppliers }: UploadInvoiceDialogProps) {
    const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload');
    const [uploading, setUploading] = useState(false);
    const [ocrData, setOcrData] = useState<OCRData | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [ocrSource, setOcrSource] = useState<string>('');
    const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
    const [supplierId, setSupplierId] = useState('');
    const [editableData, setEditableData] = useState<Record<string, string>>({});
    const fileRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setStep('upload');
        setUploading(false);
        setOcrData(null);
        setSelectedFile(null);
        setOcrSource('');
        setOcrWarnings([]);
        setSupplierId('');
        setEditableData({});
    };

    const formatLineNumber = (value: number | null | undefined) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

    const prepareReviewState = (data: OCRData, options?: { source?: string; warnings?: string[] }) => {
        setOcrData(data);
        setOcrSource(options?.source || 'Manual Review');
        setOcrWarnings(options?.warnings || []);
        setEditableData({
            invoiceNumber: data.invoiceNumber || '',
            amount: data.amount?.toString() || '',
            currency: data.currency || 'INR',
            invoiceDate: data.invoiceDate || '',
            dueDate: data.dueDate || '',
            taxAmount: data.taxAmount?.toString() || '',
            subtotal: data.subtotal?.toString() || '',
            paymentTerms: data.paymentTerms || '',
            purchaseOrderRef: data.purchaseOrderRef || '',
        });

        const matchedSupplierId = data.supplierName
            ? suppliers.find((supplier) =>
                supplier.name.toLowerCase().includes(data.supplierName!.toLowerCase()) ||
                data.supplierName!.toLowerCase().includes(supplier.name.toLowerCase())
            )?.id
            : '';

        setSupplierId(matchedSupplierId || '');
        setStep('review');
    };

    const startManualReview = (warning?: string) => {
        prepareReviewState(EMPTY_OCR_DATA, {
            source: 'Manual Review Workspace',
            warnings: warning ? [warning] : ['Automatic extraction was skipped. Fill the invoice fields below to continue.'],
        });
    };

    const handleFileSelect = async (file: File) => {
        if (!isSupportedInvoiceFile(file)) {
            toast.error("Only PDF and image files are supported");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File must be under 10MB");
            return;
        }

        setSelectedFile(file);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/invoices/ocr', { method: 'POST', body: formData });
            const json = await res.json().catch((): OCRResponse => ({
                success: false,
                error: "OCR service returned an unreadable response",
            }));

            if (!res.ok || !json.success) {
                startManualReview(json.error || "Automatic extraction could not complete. Review the invoice manually.");
                toast.warning(json.error || "OCR extraction needs manual review");
                setUploading(false);
                return;
            }

            const data = json.data || EMPTY_OCR_DATA;
            prepareReviewState(data, {
                source: json.source || 'Axiom OCR',
                warnings: json.warnings || [],
            });

            if (json.warnings?.length) {
                toast.warning("Invoice loaded with fields to review");
            } else {
                toast.success("Invoice extracted and ready for review");
            }
        } catch (error) {
            console.error("Invoice OCR upload failed:", error);
            startManualReview("The document could not be auto-extracted this time. Manual review mode is ready.");
            toast.warning("Document loaded in manual review mode");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!supplierId) {
            toast.error("Please select a supplier");
            return;
        }
        if (!editableData.invoiceNumber) {
            toast.error("Invoice number is required");
            return;
        }
        if (!editableData.amount || isNaN(Number(editableData.amount))) {
            toast.error("Valid amount is required");
            return;
        }

        setStep('saving');

        try {
            const result = await createInvoice({
                supplierId,
                invoiceNumber: editableData.invoiceNumber,
                amount: Number(editableData.amount),
                currency: editableData.currency || 'INR',
                invoiceDate: editableData.invoiceDate || undefined,
                dueDate: editableData.dueDate || undefined,
                taxAmount: editableData.taxAmount ? Number(editableData.taxAmount) : undefined,
                subtotal: editableData.subtotal ? Number(editableData.subtotal) : undefined,
                lineItems: ocrData?.lineItems || undefined,
                paymentTerms: editableData.paymentTerms || undefined,
                purchaseOrderRef: editableData.purchaseOrderRef || undefined,
            });

            if (result.success) {
                toast.success(`Invoice ${editableData.invoiceNumber} created successfully`);
                onSuccess();
                onOpenChange(false);
                reset();
            } else {
                toast.error(result.error || "Failed to create invoice");
                setStep('review');
            }
        } catch (error) {
            console.error("Invoice save failed:", error);
            toast.error("Failed to create invoice. Please review the fields and try again.");
            setStep('review');
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        {step === 'upload' ? 'Upload Invoice Document' : step === 'review' ? 'Review Extracted Data' : 'Saving...'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'upload'
                            ? 'Upload a PDF or image of an invoice. Axiom AI will extract the data automatically.'
                            : step === 'review'
                                ? 'Review and correct the extracted fields before saving.'
                                : 'Creating invoice record...'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'upload' && (
                    <div className="space-y-4">
                        <div
                            className="border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            onClick={() => { if (!uploading) fileRef.current?.click(); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (uploading) return;
                                const file = e.dataTransfer.files[0];
                                if (file) handleFileSelect(file);
                            }}
                        >
                            {uploading ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                    <p className="font-semibold">Processing with Axiom AI...</p>
                                    <p className="text-sm text-muted-foreground">Extracting invoice data from {selectedFile?.name}</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <FileText className="h-10 w-10 text-muted-foreground" />
                                    <p className="font-semibold">Drop invoice here or click to browse</p>
                                    <p className="text-sm text-muted-foreground">Supports PDF and image files (max 10MB)</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                            }}
                        />
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" onClick={() => startManualReview()}>
                                Enter Manually Instead
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'review' && ocrData && (
                    <div className="space-y-4">
                        {ocrWarnings.length > 0 ? (
                            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                                <CardContent className="space-y-2 px-4 py-3 text-sm">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold">
                                            Review needed for {selectedFile?.name || 'manual invoice entry'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-amber-700/90 dark:text-amber-200/90">
                                        Source: {ocrSource}
                                    </p>
                                    <div className="space-y-1 text-xs text-amber-700/90 dark:text-amber-200/90">
                                        {ocrWarnings.map((warning) => (
                                            <p key={warning}>{warning}</p>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                                <CardContent className="py-3 px-4 flex items-center gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                        Data prepared from {selectedFile?.name || 'manual invoice entry'} via {ocrSource || 'Axiom OCR'}
                                    </span>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Supplier *</Label>
                                <select
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="">Select supplier...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {ocrData.supplierName && !supplierId && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Detected: &quot;{ocrData.supplierName}&quot; - select matching supplier
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Invoice Number *</Label>
                                <Input
                                    value={editableData.invoiceNumber}
                                    onChange={(e) => setEditableData(d => ({ ...d, invoiceNumber: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Amount *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editableData.amount}
                                    onChange={(e) => setEditableData(d => ({ ...d, amount: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Currency</Label>
                                <Input
                                    value={editableData.currency}
                                    onChange={(e) => setEditableData(d => ({ ...d, currency: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Invoice Date</Label>
                                <Input
                                    type="date"
                                    value={editableData.invoiceDate}
                                    onChange={(e) => setEditableData(d => ({ ...d, invoiceDate: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Due Date</Label>
                                <Input
                                    type="date"
                                    value={editableData.dueDate}
                                    onChange={(e) => setEditableData(d => ({ ...d, dueDate: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Subtotal</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editableData.subtotal}
                                    onChange={(e) => setEditableData(d => ({ ...d, subtotal: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Tax Amount</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={editableData.taxAmount}
                                    onChange={(e) => setEditableData(d => ({ ...d, taxAmount: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Payment Terms</Label>
                                <Input
                                    value={editableData.paymentTerms}
                                    onChange={(e) => setEditableData(d => ({ ...d, paymentTerms: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">PO Reference</Label>
                                <Input
                                    value={editableData.purchaseOrderRef}
                                    onChange={(e) => setEditableData(d => ({ ...d, purchaseOrderRef: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {ocrData.lineItems && ocrData.lineItems.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Line Items ({ocrData.lineItems.length})</Label>
                                <div className="rounded-md border text-xs">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="px-3 py-2 text-left font-semibold">Description</th>
                                                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                                                <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                                                <th className="px-3 py-2 text-right font-semibold">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ocrData.lineItems.map((item, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="px-3 py-2">{item.description}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{formatLineNumber(item.unitPrice)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatLineNumber(item.totalPrice)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => { reset(); }}>Cancel</Button>
                            <Button onClick={handleSave} className="gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Save Invoice
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === 'saving' && (
                    <div className="flex flex-col items-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="font-medium">Creating invoice record...</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
