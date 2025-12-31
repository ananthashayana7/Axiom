import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupplierById, getSupplierOrders, updateSupplier } from "@/app/actions/suppliers";
import { getAuditLogs, getComments } from "@/app/actions/activity";
import { CommentsSection } from "@/components/shared/comments";
import { AuditLogList } from "@/components/shared/audit-log";
import { auth } from "@/auth";
import { ArrowLeft, Building2, Mail, AlertTriangle, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const supplier = await getSupplierById(id);
    const orders = await getSupplierOrders(id);
    const initialComments = await getComments('supplier', id);
    const auditLogs = isAdmin ? await getAuditLogs('supplier', id) : [];

    if (!supplier) {
        return <div className="p-8">Supplier not found.</div>;
    }

    const handleStatusChange = async (formData: FormData) => {
        'use server';
        const newStatus = formData.get('status') as 'active' | 'inactive' | 'blacklisted';
        await updateSupplier(id, { status: newStatus });
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="mb-6">
                <Link href="/suppliers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Suppliers
                </Link>
            </div>

            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Building2 className="h-8 w-8" />
                        {supplier.name}
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {supplier.contactEmail}
                    </p>
                </div>

                <form action={handleStatusChange}>
                    <div className="flex items-center gap-2">
                        <select
                            name="status"
                            defaultValue={supplier.status || 'active'}
                            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="blacklisted">Blacklisted</option>
                        </select>
                        <Button type="submit" variant="outline">Update Status</Button>
                    </div>
                </form>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${supplier.riskScore! > 50 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold">{supplier.riskScore}%</div>
                            <div className="flex-1 h-2 rounded-full bg-slate-100">
                                <div
                                    className={`h-2 rounded-full ${supplier.riskScore! > 50 ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${supplier.riskScore}%` }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orders.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ₹{orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </CardContent>
                </Card>
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
                                    {orders.map((order) => (
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
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
