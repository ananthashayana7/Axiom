import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupplierById, getSupplierOrders, updateSupplier, getSupplierPerformanceMetrics } from "@/app/actions/suppliers";
import { getAuditLogs, getComments } from "@/app/actions/activity";
import { CommentsSection } from "@/components/shared/comments";
import { AuditLogList } from "@/components/shared/audit-log";
import { auth } from "@/auth";
import { ArrowLeft, Building2, Mail, AlertTriangle, Calendar, Star, Trophy, Target, Activity } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

import { SupplierLifecycleStepper } from "@/components/suppliers/supplier-lifecycle-stepper";
import { SupplierScorecard } from "@/components/suppliers/supplier-scorecard";
import { RecordPerformanceModal } from "@/components/suppliers/record-performance-modal";
import { getDocuments } from "@/app/actions/documents";
import { DocumentList } from "@/components/shared/document-list";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const supplier = await getSupplierById(id);
    const orders = await getSupplierOrders(id);
    const docs = await getDocuments('supplier', id);
    const initialComments = await getComments('supplier', id);
    const auditLogs = isAdmin ? await getAuditLogs('supplier', id) : [];

    const performanceData = await getSupplierPerformanceMetrics(id);

    if (!supplier) {
        return <div className="p-8">Supplier not found.</div>;
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="mb-6 flex items-center justify-between">
                <Link href="/suppliers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Suppliers
                </Link>
                {isAdmin && <RecordPerformanceModal supplierId={id} />}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
                <div className="flex items-start gap-5">
                    <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">
                            {supplier.name}
                        </h1>
                        <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                            <a href={`mailto:${supplier.contactEmail}`} className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors">
                                <Mail className="h-4 w-4" />
                                {supplier.contactEmail}
                            </a>
                            <Badge variant={supplier.status === 'active' ? 'default' : 'destructive'}>
                                {supplier.status?.toUpperCase()}
                            </Badge>
                        </div>
                    </div>
                </div>

                <Card className="w-full lg:w-[450px] p-6 bg-background shadow-sm border-accent/50">
                    <SupplierLifecycleStepper
                        supplierId={id}
                        currentStatus={supplier.lifecycleStatus as any}
                        isAdmin={isAdmin}
                    />
                </Card>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 mb-10">
                <div className="lg:col-span-2">
                    <SupplierScorecard metrics={performanceData as any} />
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Spend</CardTitle>
                            <Target className="h-5 w-5 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                ₹{orders.reduce((sum: number, o: any) => sum + parseFloat(o.totalAmount || '0'), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 italic">Across {orders.length} orders</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Operational Risk</CardTitle>
                            <AlertTriangle className={`h-5 w-5 ${supplier.riskScore! > 50 ? 'text-red-500' : 'text-yellow-500'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                <div className="text-3xl font-bold">{supplier.riskScore}%</div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${supplier.riskScore! > 50 ? 'bg-red-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${supplier.riskScore}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">System-wide weighted score</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">ESG Rating</CardTitle>
                            <Activity className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{supplier.esgScore || 0}%</div>
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-2">
                                <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${supplier.esgScore || 0}%` }}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order History</CardTitle>
                    <CardDescription>All orders placed with {supplier.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order ID</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {orders.map((order: any) => (
                                        <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-mono text-xs">{order.id.slice(0, 8)}...</td>
                                            <td className="p-4 align-middle font-medium">₹{parseFloat(order.totalAmount || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="p-4 align-middle capitalize">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset
                                                    ${order.status === 'fulfilled' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                        order.status === 'draft' ? 'bg-gray-50 text-gray-600 ring-gray-500/10' :
                                                            'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground">
                                                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                    {orders.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-muted-foreground">No orders found for this supplier.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <DocumentList
                    supplierId={id}
                    documents={docs as any}
                    isAdmin={isAdmin}
                />
                <CommentsSection
                    entityType="supplier"
                    entityId={id}
                    initialComments={initialComments}
                />
                {isAdmin && <AuditLogList logs={auditLogs} />}
            </div>
        </div>
    );
}
