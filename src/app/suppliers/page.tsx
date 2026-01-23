'use client'

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { Plus, Search, Loader, Globe, Wallet, Activity, ShieldAlert, FileText, BarChart3, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function SuppliersPage() {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<any | null>(null);

    // Load suppliers on mount
    React.useEffect(() => {
        startTransition(async () => {
            const suppliersList = await getSuppliers();
            setSuppliers(suppliersList);
        });
    }, []);

    const handleSaveSupplier = async (formData: FormData) => {
        startTransition(async () => {
            let result;
            if (selectedSupplier) {
                // Formatting data for update
                const data = {
                    name: formData.get("name") as string,
                    contactEmail: formData.get("email") as string,
                    riskScore: parseInt(formData.get("risk") as string) || 0,
                    performanceScore: parseInt(formData.get("performance") as string) || 0,
                    esgScore: parseInt(formData.get("esg") as string) || 0,
                    financialScore: parseInt(formData.get("financial") as string) || 0,
                    tierLevel: formData.get("tier") as any,
                    isoCertifications: formData.getAll("iso") as string[],
                    modernSlaveryStatement: formData.get("modern_slavery") === "on" ? "yes" : "no",
                    esgEnvironmentScore: parseInt(formData.get("esg_env") as string) || 0,
                    esgSocialScore: parseInt(formData.get("esg_soc") as string) || 0,
                    esgGovernanceScore: parseInt(formData.get("esg_gov") as string) || 0,
                };
                result = await updateSupplier(selectedSupplier.id, data);
            } else {
                result = await addSupplier(formData);
            }

            if (result.success) {
                setOpen(false);
                setSelectedSupplier(null);
                const suppliersList = await getSuppliers();
                setSuppliers(suppliersList);
                toast.success(selectedSupplier ? "Supplier updated" : "Supplier added");
            } else {
                toast.error(result.error || "Operation failed");
            }
        });
    };

    const confirmDelete = async () => {
        if (!supplierToDelete) return;

        startTransition(async () => {
            const result = await deleteSupplier(supplierToDelete.id);
            if (result.success) {
                const suppliersList = await getSuppliers();
                setSuppliers(suppliersList);
                toast.success("Supplier deleted successfully");
                setDeleteOpen(false);
            } else {
                toast.error(result.error || "Failed to delete supplier");
                setDeleteOpen(false); // Close dialog even on error to let user read toast
            }
        });
    };

    const openEdit = (supplier: any) => {
        setSelectedSupplier(supplier);
        setOpen(true);
    };

    const openDelete = (supplier: any) => {
        setSupplierToDelete(supplier);
        setDeleteOpen(true);
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground mt-1">Manage your vendor relationships and risk.</p>
                </div>

                <Dialog open={open} onOpenChange={(val) => {
                    if (!val) setSelectedSupplier(null); // Clear selection on close
                    setOpen(val);
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2" onClick={() => setSelectedSupplier(null)}>
                            <Plus className="h-4 w-4" />
                            Add Supplier
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                            <DialogDescription>
                                {selectedSupplier ? "Update supplier details and scores." : "Enter the details of the new supplier to track in the system."}
                            </DialogDescription>
                        </DialogHeader>
                        <form action={handleSaveSupplier} className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Company Name</Label>
                                    <Input id="name" name="name" placeholder="Acme Corp" defaultValue={selectedSupplier?.name} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Contact Email</Label>
                                    <Input id="email" name="email" type="email" placeholder="contact@acme.com" defaultValue={selectedSupplier?.contactEmail} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="risk" className="flex items-center gap-1.5"><ShieldAlert size={14} /> Risk (0-100)</Label>
                                    <Input id="risk" name="risk" type="number" min="0" max="100" defaultValue={selectedSupplier?.riskScore ?? 15} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tier">Supplier Tier</Label>
                                    <select id="tier" name="tier" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" defaultValue={selectedSupplier?.tierLevel ?? "tier_3"}>
                                        <option value="tier_1">Tier 1 (Strategic)</option>
                                        <option value="tier_2">Tier 2 (Core)</option>
                                        <option value="tier_3">Tier 3 (Transactional)</option>
                                        <option value="critical">Critical Supplier</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="esg_env" className="text-xs">ESG: Env</Label>
                                    <Input id="esg_env" name="esg_env" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgEnvironmentScore ?? 70} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="esg_soc" className="text-xs">ESG: Social</Label>
                                    <Input id="esg_soc" name="esg_soc" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgSocialScore ?? 70} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="esg_gov" className="text-xs">ESG: Gov</Label>
                                    <Input id="esg_gov" name="esg_gov" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgGovernanceScore ?? 70} />
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <Label className="text-sm font-semibold">Compliance & Certifications</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" name="iso" value="ISO 9001" className="rounded border-gray-300" defaultChecked={selectedSupplier?.isoCertifications?.includes("ISO 9001")} />
                                        ISO 9001 (Quality)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" name="iso" value="ISO 14001" className="rounded border-gray-300" defaultChecked={selectedSupplier?.isoCertifications?.includes("ISO 14001")} />
                                        ISO 14001 (Env)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" name="modern_slavery" className="rounded border-gray-300" defaultChecked={selectedSupplier?.modernSlaveryStatement === "yes"} />
                                        Modern Slavery Act
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" name="iso" value="ISO 44001" className="rounded border-gray-300" defaultChecked={selectedSupplier?.isoCertifications?.includes("ISO 44001")} />
                                        ISO 44001 (Collab)
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                    {selectedSupplier ? "Update Supplier" : "Onboard Supplier"}
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
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tier</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Operational Risk</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Financial Health</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ESG Score</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Compliance</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {suppliers.map((supplier) => (
                                        <tr key={supplier.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground text-base">{supplier.name}</span>
                                                    <a href={`mailto:${supplier.contactEmail}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                                        {supplier.contactEmail}
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex justify-center">
                                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all shadow-sm
                                                        ${supplier.tierLevel === 'tier_1' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                                                            supplier.tierLevel === 'tier_2' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                                                                supplier.tierLevel === 'critical' ? 'bg-red-100 border-red-300 text-red-700 animate-pulse' :
                                                                    'bg-slate-100 border-slate-300 text-slate-700'}`}>
                                                        {supplier.tierLevel === 'tier_1' ? '1' :
                                                            supplier.tierLevel === 'tier_2' ? '2' :
                                                                supplier.tierLevel === 'critical' ? 'C' : '3'}
                                                    </div>
                                                </div>
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
                                            <td className="p-4 align-middle text-center">
                                                <div className="flex flex-wrap gap-1.5 justify-center">
                                                    {supplier.isoCertifications?.map((iso: string) => (
                                                        <Badge key={iso} variant="outline" className="text-[9px] px-1 py-0 h-4 bg-white font-black border-slate-200 text-slate-600 uppercase">
                                                            {iso.split(' ')[1] || 'ISO'}
                                                        </Badge>
                                                    ))}
                                                    {supplier.modernSlaveryStatement === 'yes' && (
                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 font-black border-green-200 text-green-700">
                                                            MSA
                                                        </Badge>
                                                    )}
                                                    {(!supplier.isoCertifications?.length && supplier.modernSlaveryStatement !== 'yes') && (
                                                        <span className="text-[10px] text-muted-foreground italic">None</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Link href={`/suppliers/${supplier.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8">Details</Button>
                                                    </Link>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(supplier)}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10" onClick={() => openDelete(supplier)}>
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
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


            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-background shadow-sm border-accent/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Tier Definitions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-purple-100 border border-purple-300 text-purple-700 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</div>
                            <div>
                                <p className="text-xs font-bold">Strategic Partners</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">High spend, high importance. Critical to long-term innovation and company growth.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-blue-100 border border-blue-300 text-blue-700 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</div>
                            <div>
                                <p className="text-xs font-bold">Core Suppliers</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">Essential operational items. Regular interactions and stable long-term agreements.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</div>
                            <div>
                                <p className="text-xs font-bold">Transactional Suppliers</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">Ad-hoc or low-value purchases. Easily replaceable or commoditized services.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-full bg-red-100 border border-red-300 text-red-700 text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5 anim-pulse">C</div>
                            <div>
                                <p className="text-xs font-bold text-red-700">Critical Risks</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">High risk score (&gt;75) or critical failure point in the supply chain. Immediate focus.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-background shadow-sm border-accent/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Compliance Criteria
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-white font-black border-slate-200 text-slate-600 uppercase">9001</Badge>
                            <span className="text-xs text-muted-foreground">ISO 9001: Quality Management Standards</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-white font-black border-slate-200 text-slate-600 uppercase">14001</Badge>
                            <span className="text-xs text-muted-foreground">ISO 14001: Environmental Management</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-white font-black border-slate-200 text-slate-600 uppercase">44001</Badge>
                            <span className="text-xs text-muted-foreground">ISO 44001: Collaborative Relationships</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-50 font-black border-green-200 text-green-700">MSA</Badge>
                            <span className="text-xs text-muted-foreground">Modern Slavery Act Statement Compliance</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 shadow-none border-primary/20 border-dashed">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Network Resilience
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Axiom uses <strong>MCDA</strong> (Multi-Criteria Decision Analysis) to calculate your supplier scores. Every onboarding requires active validation of ISO certificates to appear in the "Compliance" channel.
                        </p>
                        <Button variant="link" size="sm" className="p-0 h-auto text-[11px] mt-4 text-primary font-bold">
                            Review Axiom Compliance Playbook →
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {supplierToDelete?.name}.
                            Checking for active orders and RFQs before deletion.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isPending ? <Loader className="animate-spin h-4 w-4" /> : "Delete Supplier"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
