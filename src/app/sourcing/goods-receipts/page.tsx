import Link from "next/link";
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    Clock,
    Package,
    ShieldCheck,
    Truck,
    UserCircle2,
    XCircle,
} from "lucide-react";

import { getGoodsReceipts } from "@/app/actions/goods-receipts";
import { getOrders } from "@/app/actions/orders";
import { GlobalRecordReceipt } from "@/components/sourcing/global-record-receipt";
import { ReceiptActions } from "@/components/sourcing/receipt-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

const inspectionBadge = (status: string | null) => {
    switch (status) {
        case 'passed':
            return <Badge className="w-fit border-emerald-200 bg-emerald-100 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Passed</Badge>;
        case 'failed':
            return <Badge className="w-fit border-red-200 bg-red-100 text-[10px] font-bold text-red-700"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
        case 'conditional':
            return <Badge className="w-fit border-amber-200 bg-amber-100 text-[10px] font-bold text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />Conditional</Badge>;
        default:
            return <Badge className="w-fit border-stone-200 bg-stone-100 text-[10px] font-bold text-stone-600"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
};

export default async function GoodsReceiptsPage() {
    const receiptsList = await getGoodsReceipts();
    const orders = await getOrders();
    const ordersById = new Map(orders.map((order) => [order.id, order]));

    const passedCount = receiptsList.filter((receipt) => receipt.inspectionStatus === 'passed').length;
    const failedCount = receiptsList.filter((receipt) => receipt.inspectionStatus === 'failed').length;
    const pendingCount = receiptsList.filter((receipt) => !receipt.inspectionStatus || receipt.inspectionStatus === 'pending').length;
    const conditionalCount = receiptsList.filter((receipt) => receipt.inspectionStatus === 'conditional').length;

    return (
        <div className="flex min-h-full flex-col space-y-6 bg-muted/40 p-4 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Goods Receiving Log</h1>
                    <p className="mt-1 text-muted-foreground">
                        Warehouse intake, QC inspection, and three-way match readiness in one place.
                    </p>
                </div>
                <div className="w-full lg:w-auto">
                    <GlobalRecordReceipt orders={orders} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Receipts</p>
                        <p className="text-3xl font-black text-blue-600">{receiptsList.length}</p>
                        <p className="mt-1 text-xs text-muted-foreground">All receiving events logged</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">QC Passed</p>
                        <p className="text-3xl font-black text-emerald-600">{passedCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ready for downstream matching</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pending Review</p>
                        <p className="text-3xl font-black text-amber-600">{pendingCount + conditionalCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Awaiting warehouse or QC follow-up</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pb-4 pt-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">QC Failed</p>
                        <p className="text-3xl font-black text-red-600">{failedCount}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Requires return, rework, or escalation</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-blue-200/50 bg-blue-50/20 xl:hidden">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <Truck className="h-4 w-4 text-blue-600" />
                        Warehouse Light View
                    </CardTitle>
                    <CardDescription>
                        Compact cards keep receiving usable on smaller laptop widths and on-the-floor screens.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card className="border-accent/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Inbound Ledger
                    </CardTitle>
                    <CardDescription>
                        Verified log of deliveries received with inspection outcomes and PO traceability.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 xl:hidden">
                        {receiptsList.map((receipt) => {
                            const order = ordersById.get(receipt.orderId);
                            const supplierName = order?.supplier?.name || "Unknown supplier";

                            return (
                                <div
                                    key={receipt.id}
                                    className={cn(
                                        "rounded-2xl border bg-background p-4 shadow-sm",
                                        receipt.inspectionStatus === 'failed' && "border-red-200 bg-red-50/20",
                                        receipt.inspectionStatus === 'passed' && "border-emerald-200 bg-emerald-50/10",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Purchase Order</p>
                                            <Link href={`/sourcing/orders/${receipt.orderId}`} className="mt-1 inline-flex text-sm font-semibold text-primary hover:underline">
                                                PO#{receipt.orderId.replace(/-/g, '').slice(0, 6).toUpperCase()}
                                            </Link>
                                            <p className="mt-2 text-sm text-foreground">{supplierName}</p>
                                        </div>
                                        <ReceiptActions receiptId={receipt.id} orderId={receipt.orderId} inspectionStatus={receipt.inspectionStatus} />
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {inspectionBadge(receipt.inspectionStatus)}
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Received By</p>
                                            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                                <UserCircle2 className="h-4 w-4 text-primary/70" />
                                                {receipt.receivedById.slice(0, 8)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border bg-muted/20 p-3">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Timestamp</p>
                                            <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {new Date(receipt.receivedAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Warehouse Notes</p>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {receipt.notes || "Receipt verified at warehouse."}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {receiptsList.length === 0 ? (
                            <div className="rounded-2xl border border-dashed bg-background px-6 py-12 text-center">
                                <Package className="mx-auto h-12 w-12 opacity-10" />
                                <p className="mt-4 text-sm font-medium text-foreground">Zero receiving events logged for this period.</p>
                                <p className="mt-1 text-xs text-muted-foreground">Use "Record New Delivery" to log incoming stock and kick off QC.</p>
                            </div>
                        ) : null}
                    </div>

                    <div className="hidden rounded-md border bg-card xl:block">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="bg-muted/30 [&_tr]:border-b">
                                    <tr className="border-b transition-colors">
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reference</th>
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Supplier</th>
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Received By</th>
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Timestamp</th>
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inspection</th>
                                        <th className="h-12 px-6 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</th>
                                        <th className="h-12 px-6 text-right align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {receiptsList.map((receipt) => {
                                        const order = ordersById.get(receipt.orderId);

                                        return (
                                            <tr
                                                key={receipt.id}
                                                className={cn(
                                                    "border-b transition-colors hover:bg-muted/20",
                                                    receipt.inspectionStatus === 'failed' && "bg-red-50/30",
                                                    receipt.inspectionStatus === 'passed' && "bg-emerald-50/10",
                                                )}
                                            >
                                                <td className="p-6 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold leading-none text-slate-900">Order Ref</span>
                                                        <Link
                                                            href={`/sourcing/orders/${receipt.orderId}`}
                                                            className="mt-1 text-[10px] font-bold uppercase tracking-tighter text-primary hover:underline"
                                                        >
                                                            {receipt.orderId.slice(0, 8)}...
                                                        </Link>
                                                    </div>
                                                </td>
                                                <td className="p-6 align-middle text-sm font-medium text-foreground">
                                                    {order?.supplier?.name || "Unknown supplier"}
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
                                                    <p className="max-w-[260px] truncate text-xs italic text-muted-foreground">
                                                        {receipt.notes || "Receipt verified at warehouse."}
                                                    </p>
                                                </td>
                                                <td className="p-6 text-right align-middle">
                                                    <ReceiptActions receiptId={receipt.id} orderId={receipt.orderId} inspectionStatus={receipt.inspectionStatus} />
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {receiptsList.length === 0 ? (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={7} className="p-12 text-center italic text-muted-foreground">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="h-12 w-12 opacity-10" />
                                                    <p className="text-sm font-medium">Zero receiving events logged for this period.</p>
                                                    <p className="text-xs">Use "Record New Delivery" to log incoming deliveries.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-blue-200/50 bg-blue-50/20">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Receiving Workflow
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 text-xs text-muted-foreground md:grid-cols-4">
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">1. Receive Goods</p>
                            <p>Log the incoming delivery and connect it to the purchase order the warehouse is unloading.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">2. QC Inspection</p>
                            <p>Warehouse or QA marks the intake as passed, failed, or conditional with notes that procurement can see instantly.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">3. Match Readiness</p>
                            <p>The system validates PO, receipt, and invoice alignment so finance is not guessing later.</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">4. Payment Release</p>
                            <p>Only a clean receiving trail should move into matched status and payment release.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
