import { db } from "@/db";
import { procurementOrders, suppliers, contracts, orderItems, parts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getComments, getAuditLogs } from "@/app/actions/activity";
import { CommentsSection } from "@/components/shared/comments";
import { AuditLogList } from "@/components/shared/audit-log";
import { auth } from "@/auth";
import { ArrowLeft, ShoppingCart, Package, Building2, Calendar, FileText, Repeat } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

import { OrderStatusStepper } from "@/components/sourcing/order-status-stepper";
import { ThreeWayMatch } from "@/components/sourcing/three-way-match";
import { UpdateLogisticsDialog } from "@/components/sourcing/update-logistics-dialog";
import { Truck, Globe } from "lucide-react";

import { getDocuments } from "@/app/actions/documents";
import { DocumentList } from "@/components/shared/document-list";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    // 1. Fetch Order with Supplier and Contract (Minimal Fields)
    const [orderBase] = await db
        .select({
            id: procurementOrders.id,
            supplierId: procurementOrders.supplierId,
            contractId: procurementOrders.contractId,
            requisitionId: procurementOrders.requisitionId,
            status: procurementOrders.status,
            totalAmount: procurementOrders.totalAmount,
            incoterms: procurementOrders.incoterms,
            carrier: procurementOrders.carrier,
            trackingNumber: procurementOrders.trackingNumber,
            estimatedArrival: procurementOrders.estimatedArrival,
            createdAt: procurementOrders.createdAt,
            supplierName: suppliers.name,
            supplierEmail: suppliers.contactEmail,
            contractTitle: contracts.title,
        })
        .from(procurementOrders)
        .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
        .leftJoin(contracts, eq(procurementOrders.contractId, contracts.id))
        .where(eq(procurementOrders.id, id))
        .limit(1);

    if (!orderBase) {
        notFound();
    }

    // 2. Fetch Order Items with Parts (Minimal Fields)
    const itemsRaw = await db
        .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            partId: orderItems.partId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            partName: parts.name,
            partSku: parts.sku,
        })
        .from(orderItems)
        .leftJoin(parts, eq(orderItems.partId, parts.id))
        .where(eq(orderItems.orderId, id));

    // Remap for component compatibility
    const order = {
        ...orderBase,
        supplier: {
            name: orderBase.supplierName,
            contactEmail: orderBase.supplierEmail,
        },
        contract: orderBase.contractTitle ? { title: orderBase.contractTitle } : null,
        items: itemsRaw.map(i => ({
            ...i,
            part: { name: i.partName, sku: i.partSku }
        }))
    };

    if (!order) {
        notFound();
    }

    const docs = await getDocuments('order', id);
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

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <ShoppingCart className="h-8 w-8 text-primary" />
                        Order Details
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-muted-foreground font-mono text-sm leading-none">
                            ID: {order.id}
                        </p>
                        {order.incoterms && (
                            <Badge variant="outline" className="text-[10px] font-black h-5 uppercase border-primary/20 text-primary">
                                {order.incoterms}
                            </Badge>
                        )}
                    </div>
                </div>

                <Card className="w-full md:w-[400px] p-6 bg-background shadow-sm border-accent/50">
                    <OrderStatusStepper
                        orderId={id}
                        currentStatus={order.status as any}
                        isAdmin={isAdmin}
                    />
                </Card>
            </div>

            <div className="mb-8">
                <ThreeWayMatch
                    orderId={id}
                    poAmount={parseFloat(order.totalAmount || "0")}
                    supplierId={order.supplierId}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
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
                            {order.contract && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Framework Agreement</p>
                                    <Link href="/sourcing/contracts" className="text-sm text-primary font-medium hover:underline flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" />
                                        {order.contract.title}
                                    </Link>
                                </div>
                            )}
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
                                {order.requisitionId && (
                                    <div className="mt-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Source</p>
                                        <Link href="/sourcing/requisitions" className="text-xs text-primary hover:underline flex items-center gap-1">
                                            <Repeat size={10} />
                                            Requisition #{order.requisitionId.split('-')[0].toUpperCase()}
                                        </Link>
                                    </div>
                                )}
                                <div className="mt-2">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Standard</p>
                                    <p className="text-xs">Global Procurement Standard Compliant</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total Amount</p>
                                <p className="text-2xl font-bold text-primary">₹{parseFloat(order.totalAmount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            Logistics & Tracking
                        </CardTitle>
                        <UpdateLogisticsDialog
                            orderId={id}
                            initialData={{
                                carrier: order.carrier,
                                trackingNumber: order.trackingNumber,
                                estimatedArrival: order.estimatedArrival ? order.estimatedArrival.toISOString() : null
                            }}
                        />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {order.trackingNumber ? (
                                <>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Carrier:</span>
                                        <span className="font-bold">{order.carrier}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Tracking:</span>
                                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">{order.trackingNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pt-2 border-t border-dashed">
                                        <span className="text-muted-foreground">Estimated Arrival:</span>
                                        <span className="font-bold text-blue-600">
                                            {order.estimatedArrival ? new Date(order.estimatedArrival).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground italic">No tracking information provided.</p>
                                </div>
                            )}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <DocumentList
                    supplierId={order.supplierId}
                    orderId={id}
                    documents={docs as any}
                    isAdmin={isAdmin}
                />
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