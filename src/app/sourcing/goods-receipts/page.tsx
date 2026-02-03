import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getGoodsReceipts } from "@/app/actions/goods-receipts";
import { getOrders } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, UserCircle2, Calendar } from "lucide-react";
import Link from "next/link";
import { ReceiptActions } from "@/components/sourcing/receipt-actions";
import { GlobalRecordReceipt } from "@/components/sourcing/global-record-receipt";

export const dynamic = 'force-dynamic'

export default async function GoodsReceiptsPage() {
    const receiptsList = await getGoodsReceipts();
    const orders = await getOrders();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Goods Receiving Log</h1>
                    <p className="text-muted-foreground mt-1">Track physical intake and warehouse fulfillment.</p>
                </div>
                <GlobalRecordReceipt orders={orders} />
            </div>

            <Card className="border-accent/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Inbound Ledger
                    </CardTitle>
                    <CardDescription>Verified log of all deliveries received at national distribution centers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border bg-card">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b bg-muted/30">
                                    <tr className="border-b transition-colors">
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Reference</th>
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Received By</th>
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Timestamp</th>
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Notes</th>
                                        <th className="h-12 px-6 text-right align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {receiptsList.map((receipt: any) => (
                                        <tr key={receipt.id} className="border-b transition-colors hover:bg-muted/20">
                                            <td className="p-6 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 leading-none">Order Ref</span>
                                                    <Link
                                                        href={`/sourcing/orders/${receipt.orderId}`}
                                                        className="text-[10px] font-mono text-primary font-bold mt-1 uppercase tracking-tighter hover:underline"
                                                    >
                                                        {receipt.orderId.slice(0, 8)}...
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle font-medium">
                                                <div className="flex items-center gap-2">
                                                    <UserCircle2 className="h-4 w-4 text-primary/60" />
                                                    Warehouse ID: {receipt.receivedById.slice(0, 5)}
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle font-medium text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    {new Date(receipt.receivedAt).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle">
                                                <p className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                                                    {receipt.notes || "Receipt verified at warehouse."}
                                                </p>
                                            </td>
                                            <td className="p-6 align-middle text-right">
                                                <ReceiptActions receiptId={receipt.id} orderId={receipt.orderId} />
                                            </td>
                                        </tr>
                                    ))}
                                    {receiptsList.length === 0 && (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="h-12 w-12 opacity-10" />
                                                    <p className="text-sm font-medium">Zero receiving events logged for this period.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
