'use client';

import { ExternalLink, FileSearch, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type InvoiceReviewDialogProps = {
    invoice: {
        invoiceNumber: string;
        supplierName?: string | null;
        amount: number | string | null;
        currency?: string | null;
        status: string;
        country?: string | null;
        region?: string | null;
        createdAt?: Date | string | null;
        documentUrl?: string | null;
        lineItems?: string | null;
        reviewConfidenceScore?: number;
        confidenceLabel?: string;
        requiresHumanReview?: boolean;
        openFraudAlerts?: number;
        openReviewTasks?: number;
        reviewSignals?: string[];
    };
};

const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN',
    EUR: 'de-DE',
    USD: 'en-US',
    GBP: 'en-GB',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    KRW: 'ko-KR',
    AUD: 'en-AU',
    CAD: 'en-CA',
    BRL: 'pt-BR',
    SGD: 'en-SG',
    CHF: 'de-CH',
    SEK: 'sv-SE',
    MYR: 'ms-MY',
    THB: 'th-TH',
    AED: 'en-AE',
};

function formatAmount(amount: number, currencyCode: string) {
    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currencyCode} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

function parseLineItems(raw: string | null | undefined) {
    if (!raw?.trim()) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as Array<{
            description?: string;
            quantity?: number;
            unitPrice?: number;
            totalPrice?: number;
        }>;
        return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
    } catch {
        return [];
    }
}

export function InvoiceReviewDialog({ invoice }: InvoiceReviewDialogProps) {
    const currency = invoice.currency || 'INR';
    const amount = Number(invoice.amount || 0);
    const lineItems = parseLineItems(invoice.lineItems);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tight border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                    <FileSearch className="mr-1 h-3 w-3" />
                    Review Original
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSearch className="h-5 w-5 text-primary" />
                        Invoice review for {invoice.invoiceNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Side-by-side review keeps the source document visible before finance release, dispute resolution, or payment approval.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 overflow-hidden lg:grid-cols-[0.95fr_1.35fr]">
                    <div className="space-y-4 overflow-y-auto pr-1">
                        <div className="rounded-2xl border bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                                    {invoice.status.toUpperCase()}
                                </Badge>
                                {invoice.confidenceLabel ? (
                                    <Badge
                                        variant="outline"
                                        className={invoice.requiresHumanReview
                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                            : "border-emerald-200 bg-emerald-50 text-emerald-700"}
                                    >
                                        {invoice.confidenceLabel}
                                    </Badge>
                                ) : null}
                                {typeof invoice.reviewConfidenceScore === "number" ? (
                                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                                        Confidence {invoice.reviewConfidenceScore}%
                                    </Badge>
                                ) : null}
                            </div>

                            <div className="mt-4 grid gap-3 text-sm">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Supplier</p>
                                    <p className="mt-1 font-semibold text-foreground">{invoice.supplierName || "Unknown supplier"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Invoice amount</p>
                                    <p className="mt-1 font-semibold text-foreground">{formatAmount(amount, currency)}</p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Country</p>
                                        <p className="mt-1 text-foreground">{invoice.country || "Unspecified"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Region</p>
                                        <p className="mt-1 text-foreground">{invoice.region || "Unspecified"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recorded at</p>
                                    <p className="mt-1 text-foreground">
                                        {invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : "Unknown"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-white p-4">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-amber-600" />
                                <p className="text-sm font-bold text-foreground">Review posture</p>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border bg-slate-50/70 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Fraud alerts</p>
                                    <p className="mt-2 text-2xl font-black text-foreground">{invoice.openFraudAlerts || 0}</p>
                                </div>
                                <div className="rounded-xl border bg-slate-50/70 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Human tasks</p>
                                    <p className="mt-2 text-2xl font-black text-foreground">{invoice.openReviewTasks || 0}</p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Current review signals</p>
                                {invoice.reviewSignals && invoice.reviewSignals.length > 0 ? (
                                    <div className="space-y-2">
                                        {invoice.reviewSignals.map((signal) => (
                                            <div key={signal} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                {signal}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                        No active review blockers are attached to this invoice right now.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-white p-4">
                            <p className="text-sm font-bold text-foreground">Line items</p>
                            {lineItems.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                    {lineItems.map((item, index) => (
                                        <div key={`${item.description || 'line'}-${index}`} className="rounded-xl border bg-slate-50/70 px-3 py-2 text-sm">
                                            <p className="font-semibold text-foreground">{item.description || `Line ${index + 1}`}</p>
                                            <p className="mt-1 text-muted-foreground">
                                                Qty {item.quantity ?? 0} · Unit {formatAmount(Number(item.unitPrice || 0), currency)} · Total {formatAmount(Number(item.totalPrice || 0), currency)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Structured line items are not attached to this invoice yet.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border bg-slate-50/60">
                        <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                            <div>
                                <p className="text-sm font-bold text-foreground">Original document</p>
                                <p className="text-xs text-muted-foreground">Always review the source before releasing payment or clearing a dispute.</p>
                            </div>
                            {invoice.documentUrl ? (
                                <a href={invoice.documentUrl} target="_blank" rel="noreferrer">
                                    <Button variant="outline" size="sm" className="gap-2">
                                        Open raw file
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                </a>
                            ) : null}
                        </div>

                        {invoice.documentUrl ? (
                            <iframe
                                title={`Original document for ${invoice.invoiceNumber}`}
                                src={invoice.documentUrl}
                                className="h-[62vh] w-full bg-white"
                            />
                        ) : (
                            <div className="flex h-[62vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                                No original document is attached yet. Upload or link the supplier source file before using this invoice for downstream release decisions.
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
