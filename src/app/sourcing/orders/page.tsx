import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreateOrderDialog } from "@/components/sourcing/create-order-dialog";
import { getParts } from "@/app/actions/parts";
import { getOrders } from "@/app/actions/orders";
import { getSuppliers } from "@/app/actions/suppliers";
import Link from "next/link";

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
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order ID</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Supplier</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {ordersList.map((order: any) => (
                                        <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-mono text-xs">
                                                <Link href={`/sourcing/orders/${order.id}`} className="hover:text-primary hover:underline transition-colors">
                                                    {order.id.slice(0, 8)}...
                                                </Link>
                                            </td>
                                            <td className="p-4 align-middle font-medium">{order.supplier.name}</td>
                                            <td className="p-4 align-middle capitalize">
                                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                ₹{order.totalAmount}
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
