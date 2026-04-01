import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getComplianceObligations, getComplianceDashboard } from "@/app/actions/compliance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, FileX, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    expiring_soon: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    waived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    not_applicable: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

export default async function CompliancePage() {
    const session = await auth();
    if (!session?.user || !['admin', 'user'].includes(session.user.role)) {
        redirect('/');
    }

    let obligations: any[] = [];
    let dashboard = { expiringSoon: 0, expired: 0, missingEvidence: 0, byCategory: [] as any[], byPolicyPack: [] as any[] };

    try {
        obligations = await getComplianceObligations();
        dashboard = await getComplianceDashboard();
    } catch {
        // Tables may not exist yet
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    Compliance Intelligence
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Deadline-driven compliance obligations, evidence tracking, and supplier attestations
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Clock className="h-8 w-8 text-amber-500" />
                            <div>
                                <p className="text-2xl font-bold">{dashboard.expiringSoon}</p>
                                <p className="text-xs text-muted-foreground">Expiring Soon</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold">{dashboard.expired}</p>
                                <p className="text-xs text-muted-foreground">Expired</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <FileX className="h-8 w-8 text-orange-500" />
                            <div>
                                <p className="text-2xl font-bold">{dashboard.missingEvidence}</p>
                                <p className="text-xs text-muted-foreground">Missing Evidence</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Compliance Obligations</CardTitle>
                </CardHeader>
                <CardContent>
                    {obligations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No compliance obligations configured yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {obligations.map((ob) => (
                                <div key={ob.id} className="py-3 flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{ob.title}</span>
                                            <Badge variant="outline" className={`text-[10px] ${statusColors[ob.status] || ''}`}>
                                                {ob.status?.replace(/_/g, ' ')}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px]">{ob.category}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            {ob.supplierName && <span>Supplier: {ob.supplierName}</span>}
                                            {ob.ownerName && <span>Owner: {ob.ownerName}</span>}
                                            {ob.expiresAt && (
                                                <span className={new Date(ob.expiresAt) < new Date() ? 'text-red-600 font-medium' : ''}>
                                                    Expires: {new Date(ob.expiresAt).toLocaleDateString()}
                                                </span>
                                            )}
                                            {ob.documentRequired === 'yes' && !ob.documentUrl && (
                                                <span className="text-orange-600">⚠ Evidence missing</span>
                                            )}
                                            {ob.documentUrl && <span className="text-green-600">✓ Evidence submitted</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
