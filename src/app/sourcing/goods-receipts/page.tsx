import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getGoodsReceipts } from "@/app/actions/goods-receipts";
import { getOrders } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, UserCircle2, Calendar, CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ReceiptActions } from "@/components/sourcing/receipt-actions";
import { GlobalRecordReceipt } from "@/components/sourcing/global-record-receipt";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic'

const inspectionBadge = (status: string | null) => {
    switch (status) {
        case 'passed':
            return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" /> Passed</Badge>;
        case 'failed':
            return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle className="h-3 w-3" /> Failed</Badge>;
        case 'conditional':
            return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold flex items-center gap-1 w-fit"><AlertTriangle className="h-3 w-3" /> Conditional</Badge>;
        default:
            return <Badge className="bg-stone-100 text-stone-600 border-stone-200 text-[10px] font-bold flex items-center gap-1 w-fit"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
};

export default async function GoodsReceiptsPage() {
    const receiptsList = await getGoodsReceipts();
    const orders = await getOrders();

    const passedCount = receiptsList.filter((r: any) => r.inspectionStatus === 'passed').length;
    const failedCount = receiptsList.filter((r: any) => r.inspectionStatus === 'failed').length;
    const pendingCount = receiptsList.filter((r: any) => !r.inspectionStatus || r.inspectionStatus === 'pending').length;
    const conditionalCount = receiptsList.filter((r: any) => r.inspectionStatus === 'conditional').length;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Goods Receiving Log</h1>
                    <p className="text-muted-foreground mt-1">Track physical intake, QC inspection status, and warehouse fulfillment.</p>
                </div>
                <GlobalRecordReceipt orders={orders} />
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Receipts</p>
                        <p className="text-3xl font-black text-blue-600">{receiptsList.length}</p>
                        <p className="text-xs text-muted-foreground mt-1">All received deliveries</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">QC Passed</p>
                        <p className="text-3xl font-black text-emerald-600">{passedCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Cleared for 3-way match</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Pending Inspection</p>
                        <p className="text-3xl font-black text-amber-600">{pendingCount + conditionalCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting QC review</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">QC Failed</p>
                        <p className="text-3xl font-black text-red-600">{failedCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Requires return / rework</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-accent/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Inbound Ledger
                    </CardTitle>
                    <CardDescription>Verified log of all deliveries received — includes QC inspection status for 3-way match workflow.</CardDescription>
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
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Inspection</th>
                                        <th className="h-12 px-6 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Notes</th>
                                        <th className="h-12 px-6 text-right align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {receiptsList.map((receipt: any) => (
                                        <tr key={receipt.id} className={cn("border-b transition-colors hover:bg-muted/20",
                                            receipt.inspectionStatus === 'failed' && "bg-red-50/30",
                                            receipt.inspectionStatus === 'passed' && "bg-emerald-50/10",
                                        )}>
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
                                                    <span className="text-xs">ID: {receipt.receivedById.slice(0, 8)}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle font-medium text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs">{new Date(receipt.receivedAt).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 align-middle">
                                                {inspectionBadge(receipt.inspectionStatus)}
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
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="h-12 w-12 opacity-10" />
                                                    <p className="text-sm font-medium">Zero receiving events logged for this period.</p>
                                                    <p className="text-xs">Use the &ldquo;Record Receipt&rdquo; button to log incoming deliveries.</p>
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

            {/* 3-Way Match Workflow Info */}
            <Card className="border-blue-200/50 bg-blue-50/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600" /> Receiving Workflow
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                        <div className="space-y-1">
                            <p className="font-bold text-foreground text-[11px] uppercase tracking-wide">1. Receive Goods</p>
                            <p>Log incoming delivery by clicking &ldquo;Record Receipt&rdquo; and linking to the purchase order.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-foreground text-[11px] uppercase tracking-wide">2. QC Inspection</p>
                            <p>Warehouse team inspects quality — status updates to Passed, Failed, or Conditional.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-foreground text-[11px] uppercase tracking-wide">3. 3-Way Match</p>
                            <p>System auto-validates PO vs receipt vs invoice. Passed receipts unlock invoice matching.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-foreground text-[11px] uppercase tracking-wide">4. Payment Release</p>
                            <p>Matched invoices proceed to Financial Matching for admin approval and payment.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
