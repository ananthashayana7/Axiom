'use client'

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, FileCheck, Receipt, Truck, Info } from "lucide-react";
import { getOrderFinanceDetails } from "@/app/actions/orders";
import { RecordReceiptDialog } from "./record-receipt-dialog";
import { AddInvoiceDialog } from "./add-invoice-dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

interface ThreeWayMatchProps {
    orderId: string;
    poAmount: number;
    supplierId: string;
}

export function ThreeWayMatch({ orderId, poAmount, supplierId }: ThreeWayMatchProps) {
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            const data = await getOrderFinanceDetails(orderId);
            setDetails(data);
            setLoading(false);
        };
        fetchDetails();
    }, [orderId]);

    if (loading) return <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading financial compliance data...</div>;

    const hasReceipt = details?.receipts?.length > 0;
    const hasInvoice = details?.invoices?.length > 0;
    const totalInvoiced = details?.invoices?.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount), 0) || 0;
    const isPriceMatched = Math.abs(totalInvoiced - poAmount) < 0.01;
    const isFullyMatched = details?.isMatched;

    return (
        <Card className="border-accent/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-primary" />
                            Three-Way Compliance Match
                        </CardTitle>
                        <CardDescription>Verification across PO, Receipt, and Invoice.</CardDescription>
                    </div>
                    {isFullyMatched ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1 capitalize">
                            <CheckCircle2 size={12} /> Compliant
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 gap-1 capitalize">
                            <Info size={12} /> Verification Pending
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b">
                    {/* Step 1: Purchase Order */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                            <div className="p-1 rounded bg-amber-100 text-amber-700 font-black">1</div>
                            Purchase Order
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-2xl font-black">₹{poAmount.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground">Original Authorized Amount</p>
                            </div>
                            <CheckCircle2 size={16} className="text-green-500 mb-1" />
                        </div>
                    </div>

                    {/* Step 2: Goods Receipt */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                            <div className="p-1 rounded bg-amber-100 text-amber-700 font-black">2</div>
                            Goods Receipt
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                {hasReceipt ? (
                                    <>
                                        <p className="text-lg font-bold">Received</p>
                                        <p className="text-[10px] text-muted-foreground">Verified at warehouse</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-bold text-muted-foreground italic">Pending</p>
                                        <p className="text-[10px] text-muted-foreground">Awaiting delivery verification</p>
                                    </>
                                )}
                            </div>
                            {hasReceipt ? (
                                <Truck size={18} className="text-green-500 mb-1" />
                            ) : (
                                <RecordReceiptDialog
                                    orderId={orderId}
                                    trigger={
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50 font-bold border border-amber-200">
                                            Log Receipt
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {/* Step 3: Invoice */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                            <div className="p-1 rounded bg-amber-100 text-amber-700 font-black">3</div>
                            Supplier Invoice
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                {hasInvoice ? (
                                    <>
                                        <p className={`text-lg font-bold ${isPriceMatched ? 'text-foreground' : 'text-red-600'}`}>
                                            ₹{totalInvoiced.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {isPriceMatched ? 'Price Match Verified' : 'Price Discrepancy Detected'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-bold text-muted-foreground italic">Missing</p>
                                        <p className="text-[10px] text-muted-foreground">No invoice recorded</p>
                                    </>
                                )}
                            </div>
                            {hasInvoice ? (
                                <Receipt size={18} className={isPriceMatched ? "text-green-500 mb-1" : "text-red-500 mb-1"} />
                            ) : (
                                <AddInvoiceDialog
                                    orderId={orderId}
                                    supplierId={supplierId}
                                    poAmount={poAmount}
                                    trigger={
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100/50 font-bold border border-amber-200">
                                            Add Invoice
                                        </Button>
                                    }
                                />
                            )}
                        </div>
                    </div>
                </div>

                {!isFullyMatched && (
                    <div className="p-4 bg-amber-50/50 border-t">
                        <div className="flex gap-3">
                            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed text-amber-800">
                                <p className="font-bold mb-1 underline decoration-amber-300">Compliance Warning</p>
                                {!hasReceipt && <p>• Physical goods receipt has not been logged in Axiom.</p>}
                                {!hasInvoice && <p>• Financial invoice from supplier is missing.</p>}
                                {hasInvoice && !isPriceMatched && <p>• Invoiced amount (₹{totalInvoiced.toLocaleString()}) does not match PO (₹{poAmount.toLocaleString()}).</p>}
                                <div className="mt-3 flex gap-2">
                                    {!hasReceipt && <RecordReceiptDialog orderId={orderId} />}
                                    {!hasInvoice && <AddInvoiceDialog orderId={orderId} supplierId={supplierId} poAmount={poAmount} />}
                                </div>
                                <p className="mt-2 text-[10px] opacity-80">SOX compliance requires all three nodes to match before payment release.</p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
