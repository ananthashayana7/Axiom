"use client"

import { useMemo, useRef, useState } from "react"
import { Plus, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createOrder } from "@/app/actions/orders"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupplierCreationBlockReason, getSupplierReleaseBlockReason } from "@/lib/sourcing-guardrails"

interface Part {
    id: string;
    name: string;
    sku: string;
    stockLevel: number;
}

interface Supplier {
    id: string;
    name: string;
    countryCode?: string | null;
    riskScore?: number | null;
    status?: string | null;
    lifecycleStatus?: string | null;
}

interface OrderItem {
    partId: string;
    quantity: number;
    unitPrice: number;
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
    const submitLockRef = useRef(false)

    const addItem = () => {
        if (parts.length === 0) return
        setItems([...items, { partId: parts[0].id, quantity: 1, unitPrice: 0 }])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, itemIndex) => itemIndex !== index))
    }

    const updateItem = (index: number, field: keyof OrderItem, value: number | string) => {
        const nextItems = [...items]
        nextItems[index] = { ...nextItems[index], [field]: value }
        setItems(nextItems)
    }

    const totalAmount = useMemo(
        () => items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
        [items],
    )

    const selectedSupplier = useMemo(
        () => suppliers.find((supplier) => supplier.id === supplierId) || null,
        [supplierId, suppliers],
    )

    const creationBlockReason = useMemo(
        () => selectedSupplier ? getSupplierCreationBlockReason(selectedSupplier) : null,
        [selectedSupplier],
    )

    const releaseBlockReason = useMemo(
        () => selectedSupplier ? getSupplierReleaseBlockReason(selectedSupplier) : null,
        [selectedSupplier],
    )

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!supplierId || items.length === 0 || submitLockRef.current || creationBlockReason) return

        submitLockRef.current = true
        setIsSubmitting(true)

        try {
            const result = await createOrder({
                supplierId,
                totalAmount,
                items,
                incoterms,
                asnNumber,
            })

            if (!result.success) {
                toast.error("error" in result ? result.error : "Failed to create order")
                return
            }

            if ("warning" in result && result.warning) {
                toast.warning(result.warning, {
                    description: "The draft stays visible in Exception Management until risk review clears release.",
                })
            } else {
                toast.success("Order created")
            }

            setOpen(false)
            setSupplierId("")
            setItems([])
            setIncoterms("")
            setAsnNumber("")
        } catch (error) {
            console.error("Failed to create order", error)
            toast.error("Failed to create order")
        } finally {
            submitLockRef.current = false
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2" suppressHydrationWarning>
                    <Plus className="h-4 w-4" />
                    Create Order
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Order</DialogTitle>
                    <DialogDescription>
                        Build a procurement draft with supplier controls visible before release.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="supplier">Select Supplier</Label>
                        <select
                            id="supplier"
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={supplierId}
                            onChange={(event) => setSupplierId(event.target.value)}
                            required
                        >
                            <option value="">Select a supplier...</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </select>

                        {selectedSupplier ? (
                            <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedSupplier.countryCode ? (
                                        <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {selectedSupplier.countryCode}
                                        </span>
                                    ) : null}
                                    <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Risk {Number(selectedSupplier.riskScore || 0)}
                                    </span>
                                    {selectedSupplier.lifecycleStatus ? (
                                        <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {selectedSupplier.lifecycleStatus.replace(/_/g, " ")}
                                        </span>
                                    ) : null}
                                </div>
                                {creationBlockReason ? (
                                    <p className="mt-3 text-sm font-medium text-red-700">{creationBlockReason}</p>
                                ) : releaseBlockReason ? (
                                    <p className="mt-3 text-sm font-medium text-amber-700">{releaseBlockReason}</p>
                                ) : (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        Supplier is currently clear for draft creation and release routing.
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="incoterms">Incoterms</Label>
                            <Input
                                id="incoterms"
                                placeholder="e.g. FOB, DAP"
                                value={incoterms}
                                onChange={(event) => setIncoterms(event.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="asn">ASN Number (Optional)</Label>
                            <Input
                                id="asn"
                                placeholder="Advance Shipping Notice"
                                value={asnNumber}
                                onChange={(event) => setAsnNumber(event.target.value)}
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

                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 p-8 text-muted-foreground">
                                <ShoppingCart className="mb-2 h-8 w-8 opacity-50" />
                                <p>No items added yet.</p>
                            </div>
                        ) : null}

                        <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                            {items.map((item, index) => (
                                <div key={index} className="flex items-end gap-3 rounded-md border bg-card p-3">
                                    <div className="grid flex-1 gap-1.5">
                                        <Label className="text-xs">Part</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                            value={item.partId}
                                            onChange={(event) => updateItem(index, "partId", event.target.value)}
                                            required
                                        >
                                            {parts.map((part) => (
                                                <option key={part.id} value={part.id}>
                                                    {part.name} ({part.sku})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid w-24 gap-1.5">
                                        <Label className="text-xs">Qty</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            className="h-9"
                                            value={item.quantity}
                                            onChange={(event) => updateItem(index, "quantity", parseInt(event.target.value, 10) || 0)}
                                            required
                                        />
                                    </div>
                                    <div className="grid w-28 gap-1.5">
                                        <Label className="text-xs">Est. Unit Price</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="h-9"
                                            value={item.unitPrice}
                                            onChange={(event) => updateItem(index, "unitPrice", parseFloat(event.target.value) || 0)}
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                            <p className="text-sm text-muted-foreground">Estimated Order Value</p>
                            <p className="text-2xl font-bold">
                                {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !supplierId || items.length === 0 || Boolean(creationBlockReason)}>
                                {isSubmitting ? "Creating..." : "Create Order"}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
