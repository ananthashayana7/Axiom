"use client"

import { useState } from "react"
import { Loader2, Truck } from "lucide-react"
import { toast } from "sonner"

import { recordGoodsReceipt } from "@/app/actions/orders"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function GlobalRecordReceipt({ orders }: { orders: any[] }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState("")

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!selectedOrderId) {
            toast.error("Please select an order")
            return
        }

        setLoading(true)
        const formData = new FormData(event.currentTarget)
        const notes = formData.get("notes") as string

        const result = await recordGoodsReceipt(selectedOrderId, {
            notes,
            visualInspectionPassed: true,
            quantityVerified: true,
            documentMatch: true,
        })

        if (result.success) {
            toast.success("Goods receipt recorded successfully")
            setOpen(false)
            setSelectedOrderId("")
        } else {
            toast.error('error' in result ? result.error : "Failed to record receipt")
        }

        setLoading(false)
    }

    const activeOrders = orders.filter((order) => !['fulfilled', 'cancelled', 'rejected'].includes(order.status))

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full gap-2 bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto">
                    <Truck className="h-4 w-4" />
                    Record New Delivery
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter">
                        <Truck className="h-6 w-6 text-primary" />
                        Inbound Intake
                    </DialogTitle>
                    <DialogDescription className="font-medium">
                        Log a delivery arrival, attach it to the purchase order, and keep the warehouse trail visible for finance and sourcing.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="order" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Target Purchase Order
                        </Label>
                        <select
                            id="order"
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedOrderId}
                            onChange={(event) => setSelectedOrderId(event.target.value)}
                            required
                        >
                            <option value="">Select an active order...</option>
                            {activeOrders.map((order) => (
                                <option key={order.id} value={order.id}>
                                    {order.supplier.name} - PO#{order.id.replace(/-/g, '').slice(0, 6).toUpperCase()} (INR {Number(order.totalAmount).toLocaleString()})
                                </option>
                            ))}
                        </select>
                        {activeOrders.length === 0 ? (
                            <p className="text-[10px] font-bold italic text-amber-600">
                                No active sent or approved orders are available for receiving.
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Warehouse Log Notes
                        </Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            placeholder="Describe pallet count, package condition, shortages, or other receiving notes..."
                            className="h-28 resize-none border-accent/20 focus:border-primary/50"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading || !selectedOrderId} className="h-12 w-full text-base font-bold">
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Truck className="mr-2 h-5 w-5" />}
                            Mark as Fulfilled
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
