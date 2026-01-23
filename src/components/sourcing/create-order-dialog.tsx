"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, ShoppingCart } from "lucide-react"
import { createOrder } from "@/app/actions/orders"

interface Part {
    id: string;
    name: string;
    sku: string;
    stockLevel: number;
}

interface Supplier {
    id: string;
    name: string;
}

interface OrderItem {
    partId: string;
    quantity: number;
    unitPrice: number; // In a real app, this might come from a price list. For now we mock or input.
}

interface CreateOrderDialogProps {
    suppliers: Supplier[];
    parts: Part[];
}

export function CreateOrderDialog({ suppliers, parts }: CreateOrderDialogProps) {
    const [open, setOpen] = useState(false)
    const [supplierId, setSupplierId] = useState("")
    const [items, setItems] = useState<OrderItem[]>([])
    const [incoterms, setIncoterms] = useState("")
    const [asnNumber, setAsnNumber] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Helper to add an empty item row
    const addItem = () => {
        if (parts.length === 0) return;
        setItems([...items, { partId: parts[0].id, quantity: 1, unitPrice: 0 }])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        setItems(newItems)
    }

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    }, [items])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!supplierId || items.length === 0) return

        setIsSubmitting(true)
        try {
            await createOrder({
                supplierId,
                totalAmount,
                items,
                incoterms,
                asnNumber
            })
            setOpen(false)
            // Reset form
            setSupplierId("")
            setItems([])
            setIncoterms("")
            setAsnNumber("")
        } catch (error) {
            console.error("Failed to create order", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create RFQ
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Order (RFQ)</DialogTitle>
                    <DialogDescription>
                        Build a procurement order by adding parts and quantities.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="supplier">Select Supplier</Label>
                        <select
                            id="supplier"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            required
                        >
                            <option value="">Select a supplier...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="incoterms">Incoterms</Label>
                            <Input
                                id="incoterms"
                                placeholder="e.g. FOB, DAP"
                                value={incoterms}
                                onChange={(e) => setIncoterms(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asn">ASN Number (Optional)</Label>
                            <Input
                                id="asn"
                                placeholder="Advance Shipping Notice"
                                value={asnNumber}
                                onChange={(e) => setAsnNumber(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Order Items</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Item
                            </Button>
                        </div>

                        {items.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-8 border rounded-md border-dashed text-muted-foreground bg-muted/20">
                                <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                                <p>No items added yet.</p>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3 items-end p-3 border rounded-md bg-card">
                                    <div className="grid gap-1.5 flex-1">
                                        <Label className="text-xs">Part</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                            value={item.partId}
                                            onChange={(e) => updateItem(index, 'partId', e.target.value)}
                                            required
                                        >
                                            {parts.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid gap-1.5 w-24">
                                        <Label className="text-xs">Qty</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            className="h-9"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-1.5 w-28">
                                        <Label className="text-xs">Est. Unit Price</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="h-9"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => removeItem(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
                            <p className="text-2xl font-bold">₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting || !supplierId || items.length === 0}>
                                {isSubmitting ? "Creating..." : "Create RFQ"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
