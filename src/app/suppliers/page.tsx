'use client'

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
                                    <Label htmlFor="risk" className="flex items-center gap-1.5"><ShieldAlert size={14} /> Risk Score (0-100)</Label>
                                    <Input id="risk" name="risk" type="number" min="0" max="100" defaultValue={selectedSupplier?.riskScore ?? 15} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="performance" className="flex items-center gap-1.5"><Activity size={14} /> Performance (0-100)</Label>
                                    <Input id="performance" name="performance" type="number" min="0" max="100" defaultValue={selectedSupplier?.performanceScore ?? 85} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="esg" className="flex items-center gap-1.5"><Globe size={14} /> ESG Score (0-100)</Label>
                                    <Input id="esg" name="esg" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgScore ?? 70} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="financial" className="flex items-center gap-1.5"><Wallet size={14} /> Financial Health (0-100)</Label>
                                    <Input id="financial" name="financial" type="number" min="0" max="100" defaultValue={selectedSupplier?.financialScore ?? 75} />
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
                                                    <a href={`mailto:${supplier.contactEmail}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                                                        {supplier.contactEmail}
                                                    </a>
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
