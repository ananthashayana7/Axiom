import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CreateOrderDialog } from "@/components/sourcing/create-order-dialog";
import { getParts } from "@/app/actions/parts";
import { getOrders } from "@/app/actions/orders";
import { getSuppliers } from "@/app/actions/suppliers";
import Link from "next/link";
import { OrderActions } from "@/components/sourcing/order-actions";

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
    const ordersList = await getOrders();
    const suppliers = await getSuppliers();
    const parts = await getParts();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Procurement Orders</h1>
                    <p className="text-muted-foreground mt-1">Manage purchase orders and RFQs.</p>
                </div>

                <CreateOrderDialog suppliers={suppliers} parts={parts} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Orders</CardTitle>
                    <CardDescription>Track the status of your procurement requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Order ID</th>
                                        <th className="h-12 px-4 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Supplier</th>
                                        <th className="h-12 px-4 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Amount</th>
                                        <th className="h-12 px-4 text-right align-middle font-black text-muted-foreground uppercase tracking-widest text-[10px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {ordersList.map((order: any) => (
                                        <tr key={order.id} className="border-b transition-colors hover:bg-muted/30">
                                            <td className="p-4 align-middle font-mono text-xs">
                                                <Link href={`/sourcing/orders/${order.id}`} className="font-bold text-primary hover:underline transition-colors">
                                                    {order.id.slice(0, 8)}...
                                                </Link>
                                            </td>
                                            <td className="p-4 align-middle font-bold text-slate-700">{order.supplier?.name || "Unknown Supplier"}</td>
                                            <td className="p-4 align-middle capitalize">
                                                <Badge variant="outline" className={cn(
                                                    "font-black text-[10px] uppercase tracking-widest px-2 py-0.5",
                                                    order.status === 'fulfilled' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                        order.status === 'sent' ? "bg-sky-50 text-sky-700 border-sky-100" :
                                                            order.status === 'pending_approval' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                                "bg-slate-50 text-slate-600 border-slate-100"
                                                )}>
                                                    {order.status?.replace('_', ' ') || "N/A"}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle font-bold">
                                                ₹{Number(order.totalAmount).toLocaleString()}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <OrderActions
                                                    orderId={order.id}
                                                    status={order.status}
                                                    supplierId={order.supplierId}
                                                    totalAmount={Number(order.totalAmount)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {ordersList.length === 0 && (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={4} className="p-4 text-center text-muted-foreground">No orders found.</td>
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
