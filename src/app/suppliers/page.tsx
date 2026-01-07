'use client'

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSuppliers, addSupplier } from "@/app/actions/suppliers";
import { Plus, Search, Loader, Globe, Wallet, Activity, ShieldAlert, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export default function SuppliersPage() {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    // Load suppliers on mount
    React.useEffect(() => {
        startTransition(async () => {
            const suppliersList = await getSuppliers();
            setSuppliers(suppliersList);
        });
    }, []);

    const handleAddSupplier = async (formData: FormData) => {
        startTransition(async () => {
            const result = await addSupplier(formData);
            if (result.success) {
                setOpen(false);
                // Refresh suppliers list
                const suppliersList = await getSuppliers();
                setSuppliers(suppliersList);
            } else {
                alert(result.error || "Failed to add supplier");
            }
        });
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground mt-1">Manage your vendor relationships and risk.</p>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Supplier
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Supplier</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new supplier to track in the system.
                            </DialogDescription>
                        </DialogHeader>
                        <form action={handleAddSupplier} className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Company Name</Label>
                                    <Input id="name" name="name" placeholder="Acme Corp" required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Contact Email</Label>
                                    <Input id="email" name="email" type="email" placeholder="contact@acme.com" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="risk" className="flex items-center gap-1.5"><ShieldAlert size={14} /> Risk Score (0-100)</Label>
                                    <Input id="risk" name="risk" type="number" min="0" max="100" defaultValue="15" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="performance" className="flex items-center gap-1.5"><Activity size={14} /> Performance (0-100)</Label>
                                    <Input id="performance" name="performance" type="number" min="0" max="100" defaultValue="85" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="esg" className="flex items-center gap-1.5"><Globe size={14} /> ESG Score (0-100)</Label>
                                    <Input id="esg" name="esg" type="number" min="0" max="100" defaultValue="70" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="financial" className="flex items-center gap-1.5"><Wallet size={14} /> Financial Health (0-100)</Label>
                                    <Input id="financial" name="financial" type="number" min="0" max="100" defaultValue="75" />
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                    Onboard Supplier
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Suppliers</CardTitle>
                    <CardDescription>Vendor relationships and risk assessments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Supplier</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Operational Risk</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Financial Health</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ESG Score</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {suppliers.map((supplier) => (
                                        <tr key={supplier.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground text-base">{supplier.name}</span>
                                                    <span className="text-xs text-muted-foreground">{supplier.contactEmail}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset
                                                    ${supplier.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                        supplier.status === 'inactive' ? 'bg-gray-50 text-gray-700 ring-gray-600/20' :
                                                            'bg-red-50 text-red-700 ring-red-600/20'}`}>
                                                    {supplier.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="space-y-1.5 w-[140px]">
                                                    <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                                        <span>Risk Level</span>
                                                        <span className={supplier.riskScore > 60 ? 'text-red-600' : 'text-primary'}>{supplier.riskScore}%</span>
                                                    </div>
                                                    <Progress value={supplier.riskScore} className="h-1.5" />
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-md ${supplier.financialScore > 70 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        <Wallet size={14} />
                                                    </div>
                                                    <span className="font-bold">{supplier.financialScore || 0}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-md bg-blue-100 text-blue-700">
                                                        <Globe size={14} />
                                                    </div>
                                                    <span className="font-bold">{supplier.esgScore || 0}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <Link href={`/suppliers/${supplier.id}`}>
                                                    <Button variant="outline" size="sm" className="h-8">Details</Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {suppliers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No suppliers found in network.</td>
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
