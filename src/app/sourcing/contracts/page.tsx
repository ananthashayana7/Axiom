'use server'

import { getContracts } from "@/app/actions/contracts";
import { getSuppliers } from "@/app/actions/suppliers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Calendar, TrendingUp, ShieldCheck } from "lucide-react";
// Native date formatting replaces date-fns
const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);

import { CreateContractDialog } from "@/components/sourcing/create-contract-dialog";

export default async function ContractsPage() {
    const contracts = await getContracts();
    const suppliers = await getSuppliers();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contract Management</h1>
                    <p className="text-muted-foreground mt-1">Monitor compliance, renewals, and framework agreements.</p>
                </div>
                <CreateContractDialog suppliers={suppliers} />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {contracts.map((contract) => (
                    <Card key={contract.id} className="group relative overflow-hidden transition-all hover:shadow-xl">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between mb-2">
                                <Badge variant={
                                    contract.status === 'active' ? 'default' :
                                        contract.status === 'expired' ? 'destructive' : 'secondary'
                                }>
                                    {contract.status?.toUpperCase()}
                                </Badge>
                                <span className="text-xs font-medium text-muted-foreground">
                                    Val: ₹{Number(contract.value).toLocaleString()}
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
                                    <Badge variant="outline" className="text-[10px] h-5 bg-background font-black border-primary/20">
                                        {contract.incoterms || 'N/A'}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-primary">
                                        <TrendingUp className="h-4 w-4" />
                                        <span className="font-semibold text-xs">{contract.renewalStatus === 'auto_renew' ? 'Auto' : 'Manual'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-2">
                                <Button variant="outline" size="sm" className="w-full gap-2">
                                    <FileText className="h-4 w-4" />
                                    View PDF
                                </Button>
                                <Button variant="secondary" size="sm" className="w-full">
                                    Manage
                                </Button>
                            </div>
                        </CardContent>

                        {/* Decorative background element */}
                        <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                    </Card>
                ))}

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
