import { getContracts } from "@/app/actions/contracts";
import { getSuppliers } from "@/app/actions/suppliers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Calendar, TrendingUp, ShieldCheck, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);

function getDaysUntilExpiry(validTo: Date | null | undefined): number | null {
    if (!validTo) return null;
    return Math.ceil((new Date(validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

import { CreateContractDialog } from "@/components/sourcing/create-contract-dialog";
import { ContractActions } from "@/components/sourcing/contract-actions";

export const dynamic = 'force-dynamic';

export default async function ContractsPage() {
    const contracts = await getContracts();
    const suppliers = await getSuppliers();

    const activeCount = contracts.filter((c: any) => c.status === 'active').length;
    const expiringCount = contracts.filter((c: any) => {
        const days = getDaysUntilExpiry(c.validTo);
        return days !== null && days <= 60 && days > 0 && c.status === 'active';
    }).length;
    const expiredCount = contracts.filter((c: any) => c.status === 'expired').length;
    const totalValue = contracts.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-10 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contract Management</h1>
                    <p className="text-muted-foreground mt-1">Monitor compliance, renewals, and framework agreements.</p>
                </div>
                <CreateContractDialog suppliers={suppliers} />
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Active Contracts</p>
                        <p className="text-3xl font-black text-emerald-600">{activeCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Currently in force</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Expiring (60 days)</p>
                        <p className="text-3xl font-black text-amber-600">{expiringCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Requires renewal action</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Expired</p>
                        <p className="text-3xl font-black text-red-600">{expiredCount}</p>
                        <p className="text-xs text-muted-foreground mt-1">Needs renewal or closing</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-5 pb-4">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Total Contract Value</p>
                        <p className="text-2xl font-black text-blue-600">{totalValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Across all contracts</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {contracts.map((contract: any) => {
                    const daysLeft = getDaysUntilExpiry(contract.validTo);
                    const isExpiringSoon = daysLeft !== null && daysLeft <= 60 && daysLeft > 0;
                    const isExpired = contract.status === 'expired' || (daysLeft !== null && daysLeft < 0);
                    return (
                    <Card key={contract.id} className={cn("group relative overflow-hidden transition-all hover:shadow-xl",
                        isExpired && "border-red-200 bg-red-50/20",
                        isExpiringSoon && !isExpired && "border-amber-200 bg-amber-50/10",
                    )}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant={
                                    contract.status === 'active' ? 'default' :
                                        contract.status === 'expired' ? 'destructive' : 'secondary'
                                }>
                                    {contract.status?.toUpperCase()}
                                </Badge>
                                <span className="text-xs font-medium text-muted-foreground">
                                    Val: {Number(contract.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <CardTitle className="text-xl group-hover:text-primary transition-colors flex items-center justify-between">
                                {contract.title}
                                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-tighter self-start mt-1">
                                    {contract.type?.replace('_', ' ')}
                                </span>
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                                <ShieldCheck className="h-3 w-3" />
                                {Array.isArray(contract.supplier) ? contract.supplier[0]?.name : (contract.supplier as any)?.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span>Ends: {contract.validTo ? formatDate(new Date(contract.validTo)) : 'N/A'}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {daysLeft !== null && (
                                        <span className={cn("text-[10px] font-bold",
                                            isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-emerald-600"
                                        )}>
                                            {isExpired ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 text-primary">
                                        <TrendingUp className="h-4 w-4" />
                                        <span className="font-semibold text-xs">{contract.renewalStatus === 'auto_renew' ? 'Auto-renew' : 'Manual renew'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <ContractActions contractId={contract.id} status={contract.status || 'draft'} />
                            </div>
                        </CardContent>

                        {/* Decorative background element */}
                        <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                    </Card>
                    );
                })}

                {contracts.length === 0 && (
                    <Card className="col-span-full py-12 border-dashed flex flex-col items-center justify-center text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium">No contracts found</h3>
                        <p className="text-muted-foreground max-w-xs mx-auto">
                            Get started by creating your first framework agreement or NDA with a supplier.
                        </p>
                    </Card>
                )}
            </div>
        </div>
    );
}
