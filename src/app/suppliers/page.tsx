
import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSuppliers, addSupplier } from "@/app/actions/suppliers";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

export default async function SuppliersPage() {
    const suppliersList = await getSuppliers();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground mt-1">Manage your vendor relationships and risk.</p>
                </div>

                <Dialog>
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
                        <form action={addSupplier} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Company Name</Label>
                                <Input id="name" name="name" placeholder="Acme Corp" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Contact Email</Label>
                                <Input id="email" name="email" type="email" placeholder="contact@acme.com" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="risk">Initial Risk Score (0-100)</Label>
                                <Input id="risk" name="risk" type="number" min="0" max="100" defaultValue="0" />
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit">Save Supplier</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Suppliers</CardTitle>
                    <CardDescription>A list of all your registered suppliers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Contact</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Risk Score</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {suppliersList.map((supplier) => (
                                        <tr key={supplier.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium">
                                                <Link href={`/suppliers/${supplier.id}`} className="text-primary hover:underline">
                                                    {supplier.name}
                                                </Link>
                                            </td>
                                            <td className="p-4 align-middle">{supplier.contactEmail}</td>
                                            <td className="p-4 align-middle capitalize">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${supplier.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                    supplier.status === 'blacklisted' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-gray-50 text-gray-600 ring-gray-500/10'
                                                    }`}>
                                                    {supplier.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-full max-w-[60px] rounded-full bg-slate-100">
                                                        <div className={`h-2 rounded-full ${supplier.riskScore! > 50 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${supplier.riskScore}%` }}></div>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{supplier.riskScore}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {suppliersList.length === 0 && (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={4} className="p-4 text-center text-muted-foreground">No suppliers found.</td>
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
