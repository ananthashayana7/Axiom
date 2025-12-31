import { db } from "@/db";
import { procurementOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getComments, getAuditLogs } from "@/app/actions/activity";
import { CommentsSection } from "@/components/shared/comments";
import { AuditLogList } from "@/components/shared/audit-log";
import { auth } from "@/auth";
import { ArrowLeft, ShoppingCart, Package, Building2, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const order = await db.query.procurementOrders.findFirst({
        where: eq(procurementOrders.id, id),
        with: {
            supplier: true,
            items: {
                with: {
                    part: true
                }
            }
        }
    });

    if (!order) {
        notFound();
    }

    const initialComments = await getComments('order', id);
    const auditLogs = isAdmin ? await getAuditLogs('order', id) : [];

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="mb-6">
                <Link href="/sourcing/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Orders
                </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <ShoppingCart className="h-8 w-8 text-primary" />
                        Order Details
                    </h1>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">
                        ID: {order.id}
                    </p>
                </div>
                <Badge variant={order.status === 'fulfilled' ? 'default' : 'secondary'} className="text-sm px-4 py-1">
                    {order.status?.toUpperCase()}
                </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Supplier Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                            <p className="font-semibold text-lg">{order.supplier.name}</p>
                            <p className="text-sm text-muted-foreground">{order.supplier.contactEmail}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Order Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Placed On</p>
                                <p className="font-semibold">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Amount</p>
                                <p className="text-2xl font-bold text-primary">₹{parseFloat(order.totalAmount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Items Ordered
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="h-10 px-4 text-left font-medium">Part Name</th>
                                    <th className="h-10 px-4 text-left font-medium">SKU</th>
                                    <th className="h-10 px-4 text-right font-medium">Quantity</th>
                                    <th className="h-10 px-4 text-right font-medium">Unit Price</th>
                                    <th className="h-10 px-4 text-right font-medium">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => (
                                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="p-4">{item.part.name}</td>
                                        <td className="p-4 font-mono text-xs text-muted-foreground">{item.part.sku}</td>
                                        <td className="p-4 text-right">{item.quantity}</td>
                                        <td className="p-4 text-right">₹{parseFloat(item.unitPrice).toLocaleString()}</td>
                                        <td className="p-4 text-right font-medium text-primary">
                                            ₹{(item.quantity * parseFloat(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CommentsSection
                    entityType="order"
                    entityId={id}
                    initialComments={initialComments}
                />
                {isAdmin && <AuditLogList logs={auditLogs} />}
            </div>
        </div>
    );
}
