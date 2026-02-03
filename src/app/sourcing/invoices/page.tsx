import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getInvoices } from "@/app/actions/invoices";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, FileText, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
    const invoicesList = await getInvoices();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Enterprise Invoices</h1>
                    <p className="text-muted-foreground mt-1">Audit and process supplier payment requests.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoicesList.filter(i => i.status === 'pending').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Matched & Verified</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{invoicesList.filter(i => i.status === 'matched').length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Payable</CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{invoicesList.reduce((acc, curr) => acc + parseFloat(curr.amount || "0"), 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Ledger</CardTitle>
                    <CardDescription>Real-time synchronization with supplier-submitted documents.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Invoice #</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order Ref</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount</th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {invoicesList.map((invoice: any) => (
                                        <tr key={invoice.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-bold tracking-tight">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    {invoice.invoiceNumber}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle font-mono text-xs text-muted-foreground">
                                                {invoice.orderId.slice(0, 8)}...
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge variant={
                                                    invoice.status === 'paid' ? 'default' :
                                                        invoice.status === 'matched' ? 'secondary' :
                                                            'outline'
                                                } className={cn(
                                                    "uppercase text-[10px] font-black",
                                                    invoice.status === 'paid' && "bg-green-500 hover:bg-green-600 text-white border-none"
                                                )}>
                                                    {invoice.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground">
                                                {new Date(invoice.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 align-middle font-black">
                                                ₹{Number(invoice.amount).toLocaleString()}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
                                            </td>
                                        </tr>
                                    ))}
                                    {invoicesList.length === 0 && (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                                                No enterprise data found in this category.
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
