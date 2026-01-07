'use client'

import React, { useEffect, useState, useTransition } from "react";
import { getRFQById } from "@/app/actions/rfqs";
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

export default function SupplierRFQDetail() {
    const { id } = useParams();
    const [rfq, setRfq] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function load() {
            const data = await getRFQById(id as string);
            setRfq(data);
            setLoading(false);
        }
        load();
    }, [id]);

    const handleQuoteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            // Simulate quote submission
            await new Promise(r => setTimeout(r, 1500));
            toast.success("Quotation Submitted", {
                description: "The procurement team has been notified of your proposal."
            });
        });
    };

    if (loading) return <div className="p-8">Loading invitation...</div>;
    if (!rfq) return <div className="p-8 text-red-500">RFQ not found or access denied.</div>;

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-6">
            <Link href="/portal" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit">
                <ArrowLeft className="h-4 w-4" /> Back to Portal
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{rfq.title}</h1>
                    <p className="text-muted-foreground mt-1">RFQ ID: {rfq.id.split('-')[0].toUpperCase()}</p>
                </div>
                <Badge variant="outline" className="px-3 py-1 uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
                    Invitation Active
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
                                            <th className="px-6 py-3 text-right">Target (Ref)</th>
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
                                                <td className="px-6 py-4 text-right text-muted-foreground italic">Market Benchmark</td>
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
                                "{rfq.description || "Quote for standard delivery and quality specifications."}"
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quoting Form */}
                <Card className="shadow-lg border-2 border-primary/10">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-xl">Submit Your Proposal</CardTitle>
                        <CardDescription>Your best price and delivery commitment.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleQuoteSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="totalAmount">Total Quote Amount (INR)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">₹</span>
                                    <Input id="totalAmount" name="totalAmount" type="number" step="0.01" className="pl-8 bg-background" placeholder="0.00" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="leadTime">Lead Time (Weeks)</Label>
                                <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <Input id="leadTime" name="leadTime" type="number" className="bg-background" defaultValue="2" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Technical Proposal / Notes</Label>
                                <Textarea id="notes" name="notes" placeholder="Specify logistics details, tiered pricing, etc." className="min-h-[120px] bg-background" />
                            </div>

                            <div className="p-4 bg-muted rounded-xl flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    By submitting, you agree to these payment terms: <span className="font-bold text-foreground">Net 45 upon delivery.</span>
                                </p>
                            </div>

                            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-5 w-5" />
                                        Post Official Quote
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
