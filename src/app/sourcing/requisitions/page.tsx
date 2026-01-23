import { db } from "@/db";
import { requisitions, users } from "@/db/schema";
import { auth } from "@/auth";
import { desc, eq } from "drizzle-orm";
import { getRequisitions } from "@/app/actions/requisitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { RequisitionDialog } from "./requisition-dialog";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

import { getSuppliers } from "@/app/actions/suppliers";
import { RequisitionActions } from "./requisition-actions";

export default async function RequisitionsPage() {
    const session = await auth();
    const reqs = await getRequisitions();
    const suppliers = await getSuppliers();
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'admin';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'pending_approval': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            case 'converted_to_po': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle2 className="h-3 w-3 mr-1" />;
            case 'pending_approval': return <Clock className="h-3 w-3 mr-1" />;
            case 'rejected': return <XCircle className="h-3 w-3 mr-1" />;
            default: return null;
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Internal Requisitions</h1>
                    <p className="text-muted-foreground mt-1">
                        P2P Workflow: Manage internal purchase requests and approvals.
                    </p>
                </div>
                <RequisitionDialog />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ShoppingCart size={64} className="text-primary" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Requests</CardTitle>
                        <CardTitle className="text-4xl font-bold">{reqs.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Across all departments</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-white to-amber-50 border-amber-200 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock size={64} className="text-amber-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Approval</CardTitle>
                        <CardTitle className="text-4xl font-bold text-amber-600">
                            {reqs.filter(r => r.status === 'pending_approval').length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Awaiting budget verification</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-white to-green-50 border-green-200 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle2 size={64} className="text-green-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Approved Volume</CardTitle>
                        <CardTitle className="text-4xl font-bold text-green-600">
                            ₹{reqs.filter(r => r.status === 'approved').reduce((acc, r) => acc + Number(r.estimatedAmount), 0).toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">Ready for conversion to PO</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Requisition Ledger</CardTitle>
                    <CardDescription>Comprehensive audit trail of internal procurement requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-muted-foreground font-medium">
                                    <th className="h-12 px-4 text-left align-middle">ID</th>
                                    <th className="h-12 px-4 text-left align-middle">Title / Department</th>
                                    <th className="h-12 px-4 text-left align-middle">Est. Amount</th>
                                    <th className="h-12 px-4 text-left align-middle">Status</th>
                                    <th className="h-12 px-4 text-left align-middle">Requested On</th>
                                    <th className="h-12 px-4 text-right align-middle">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {reqs.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 align-middle font-mono text-xs text-muted-foreground">
                                            {req.id.split('-')[0].toUpperCase()}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{req.title}</span>
                                                <span className="text-xs text-muted-foreground uppercase">{req.department || 'Unassigned'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle font-bold text-slate-700">
                                            ₹{Number(req.estimatedAmount).toLocaleString()}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px]", getStatusColor(req.status || ''))}>
                                                {getStatusIcon(req.status || '')}
                                                {req.status?.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground whitespace-nowrap">
                                            {req.createdAt ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(req.createdAt)) : 'N/A'}
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <RequisitionActions
                                                requisitionId={req.id}
                                                status={req.status || 'draft'}
                                                isAdmin={isAdmin}
                                                suppliers={suppliers}
                                                purchaseOrderId={req.purchaseOrderId}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {reqs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                            No requisitions found. Start by creating an internal request.
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
