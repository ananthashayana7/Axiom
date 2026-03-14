import { getSupplierOrders } from "@/app/actions/portal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export const dynamic = 'force-dynamic';

const statusClasses: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600 border-stone-200',
    pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    sent: 'bg-blue-100 text-blue-700 border-blue-200',
    fulfilled: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default async function SupplierOrdersPage() {
    const orders = await getSupplierOrders();

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <ShoppingCart className="h-8 w-8 text-primary" /> Supplier Orders
                </h1>
                <p className="text-muted-foreground mt-1 font-medium">All orders raised for your supplier profile.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order Ledger</CardTitle>
                    <CardDescription>{orders.length} order(s) available</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Order</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Status</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Amount</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Created</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Items</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order: any) => (
                                    <tr key={order.id} className="border-b hover:bg-muted/40 transition-colors align-top">
                                        <td className="p-4 font-mono text-xs text-primary font-bold">{order.id?.slice(0, 8)}</td>
                                        <td className="p-4">
                                            <Badge className={statusClasses[order.status] || 'bg-stone-100 text-stone-600 border-stone-200'}>
                                                {String(order.status || 'unknown').replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="p-4 font-semibold">{formatCurrency(order.totalAmount || 0)}</td>
                                        <td className="p-4 text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</td>
                                        <td className="p-4 min-w-[260px]">
                                            <div className="space-y-1 text-xs">
                                                {(order.items || []).length === 0 ? (
                                                    <span className="text-muted-foreground italic">No items</span>
                                                ) : (
                                                    (order.items || []).map((item: any) => (
                                                        <div key={item.id} className="flex items-center justify-between gap-2">
                                                            <span className="font-medium">{item.part?.name || 'Unknown Part'} ({item.part?.sku || 'N/A'})</span>
                                                            <span className="text-muted-foreground">Qty {item.quantity}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-muted-foreground italic">
                                            No orders available for your supplier account.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
