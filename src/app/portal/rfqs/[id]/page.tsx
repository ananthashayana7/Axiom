'use client'

import React, { useEffect, useState, useTransition } from "react";
import { getCurrentSupplierRFQInvitation, getRFQById, submitSupplierQuote } from "@/app/actions/rfqs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    ArrowLeft,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

type QuoteAnalysis = {
    deliveryWeeks?: number;
    terms?: string;
    notes?: string;
};

function parseQuoteAnalysis(value: string | null | undefined): QuoteAnalysis | null {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as QuoteAnalysis;
    } catch {
        return null;
    }
}

export default function SupplierRFQDetail() {
    const { id } = useParams();
    const [rfq, setRfq] = useState<any>(null);
    const [currentInvitation, setCurrentInvitation] = useState<any>(null);
    const [totalAmount, setTotalAmount] = useState("");
    const [leadTimeWeeks, setLeadTimeWeeks] = useState("2");
    const [paymentTerms, setPaymentTerms] = useState("Net 45 upon delivery");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            const [rfqData, invitation] = await Promise.all([
                getRFQById(id as string),
                getCurrentSupplierRFQInvitation(id as string),
            ]);
            const analysis = parseQuoteAnalysis(invitation?.aiAnalysis);

            setRfq(rfqData);
            setCurrentInvitation(invitation);
            setTotalAmount(invitation?.quoteAmount ? String(Number(invitation.quoteAmount)) : "");
            setLeadTimeWeeks(analysis?.deliveryWeeks ? String(analysis.deliveryWeeks) : "2");
            setPaymentTerms(analysis?.terms || "Net 45 upon delivery");
            setNotes(analysis?.notes || "");
            setLoading(false);
        }
        load();
    }, [id]);

    const handleQuoteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentInvitation) {
            toast.error("Supplier invitation not found");
            return;
        }

        startTransition(async () => {
            const result = await submitSupplierQuote({
                rfqSupplierId: currentInvitation.id,
                totalAmount: Number(totalAmount),
                leadTimeWeeks: Number(leadTimeWeeks),
                paymentTerms,
                notes,
            });

            if (result.success) {
                setCurrentInvitation((prev: any) => prev ? { ...prev, status: 'quoted', quoteAmount: totalAmount } : prev);
                toast.success(currentInvitation.status === 'quoted' ? "Quote updated" : "Quote submitted", {
                    description: "Procurement can now compare your offer in the sourcing workspace."
                });
            } else {
                toast.error(result.error || "Failed to submit quotation");
            }
        });
    };

    if (loading) return <div className="p-8">Loading invitation...</div>;
    if (!rfq || !currentInvitation) return <div className="p-8 text-red-500">RFQ not found or access denied.</div>;

    const quoteLocked = rfq.status === 'closed' || rfq.status === 'cancelled';
    const invitationBadgeClass = currentInvitation.status === 'quoted'
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-blue-50 text-blue-700 border-blue-200";

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <Link href="/portal/rfqs" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
                <ArrowLeft className="h-4 w-4" /> Back to RFQs
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{rfq.title}</h1>
                    <p className="text-muted-foreground mt-1">RFQ ID: {rfq.id.split('-')[0].toUpperCase()}</p>
                </div>
                <Badge variant="outline" className={`px-3 py-1 uppercase font-bold ${invitationBadgeClass}`}>
                    {currentInvitation.status === 'quoted' ? 'Quote Submitted' : 'Invitation Active'}
                </Badge>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Requested Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs uppercase bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3">Part Name / SKU</th>
                                            <th className="px-6 py-3">Quantity</th>
                                            <th className="px-6 py-3 text-right">Reference</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {rfq.items.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold">{item.part.name}</div>
                                                    <div className="text-xs text-muted-foreground">{item.part.sku}</div>
                                                </td>
                                                <td className="px-6 py-4 font-medium">{item.quantity} units</td>
                                                <td className="px-6 py-4 text-right text-muted-foreground italic">Benchmark review in progress</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-background to-blue-50/20">
                        <CardHeader>
                            <CardTitle className="text-lg">Special Instructions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">
                                &quot;{rfq.description || "Quote for standard delivery and quality specifications."}&quot;
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quoting Form */}
                <Card className="shadow-lg border-2 border-primary/10">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-xl">Submit Your Proposal</CardTitle>
                        <CardDescription>Your best price, lead time, and payment terms.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleQuoteSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="totalAmount">Total Quote Amount (INR)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">₹</span>
                                    <Input id="totalAmount" name="totalAmount" type="number" step="0.01" className="pl-10 bg-background" placeholder="0.00" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} required disabled={quoteLocked || isPending} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="leadTime">Lead Time (Weeks)</Label>
                                <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Input id="leadTime" name="leadTime" type="number" className="bg-background" value={leadTimeWeeks} onChange={(event) => setLeadTimeWeeks(event.target.value)} required disabled={quoteLocked || isPending} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="paymentTerms">Payment Terms</Label>
                                <Input id="paymentTerms" name="paymentTerms" className="bg-background" value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} disabled={quoteLocked || isPending} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Technical Proposal / Notes</Label>
                                <Textarea id="notes" name="notes" placeholder="Specify logistics details, tooling assumptions, or tiered pricing." className="min-h-[120px] bg-background" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={quoteLocked || isPending} />
                            </div>

                            <div className="p-4 bg-muted rounded-xl flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    {quoteLocked
                                        ? "This RFQ is locked. Quotes can no longer be changed because procurement has closed or cancelled the event."
                                        : "Procurement will compare this quote directly against competing bids and benchmark data."}
                                </p>
                            </div>

                            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending || quoteLocked}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-5 w-5" />
                                        {currentInvitation.status === 'quoted' ? 'Update Quote' : 'Post Official Quote'}
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
