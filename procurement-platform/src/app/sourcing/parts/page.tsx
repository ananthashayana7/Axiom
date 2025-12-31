
import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getParts, addPart } from "@/app/actions/parts";
import { Plus, Package } from "lucide-react";

export default async function PartsPage() {
    const partsList = await getParts();

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Parts Catalog</h1>
                    <p className="text-muted-foreground mt-1">Manage your inventory and SKUs.</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Part
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Part</DialogTitle>
                            <DialogDescription>
                                Define a new part in the catalog.
                            </DialogDescription>
                        </DialogHeader>
                        <form action={addPart} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Part Name</Label>
                                <Input id="name" name="name" placeholder="Steel Bolt M10" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input id="sku" name="sku" placeholder="BOLT-M10-STEEL" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Input id="category" name="category" placeholder="Fasteners" required />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="stock">Initial Stock</Label>
                                <Input id="stock" name="stock" type="number" min="0" defaultValue="0" />
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button type="submit">Save Part</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Inventory</CardTitle>
                    <CardDescription>Current stock levels and part details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">SKU</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Stock Level</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {partsList.map((part) => (
                                        <tr key={part.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-mono text-xs">{part.sku}</td>
                                            <td className="p-4 align-middle font-medium">{part.name}</td>
                                            <td className="p-4 align-middle text-muted-foreground">{part.category}</td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                    <span>{part.stockLevel}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {partsList.length === 0 && (
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <td colSpan={4} className="p-4 text-center text-muted-foreground">No parts found.</td>
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
