"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Truck, Loader2, Search } from "lucide-react"
import { recordGoodsReceipt } from "@/app/actions/orders"
import { toast } from "sonner"

export function GlobalRecordReceipt({ orders }: { orders: any[] }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!selectedOrderId) {
            toast.error("Please select an order")
            return
        }
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const notes = formData.get("notes") as string

        const res = await recordGoodsReceipt(selectedOrderId, notes)
        if (res.success) {
            toast.success("Goods receipt recorded successfully")
            setOpen(false)
            setSelectedOrderId("")
        } else {
            toast.error(res.error || "Failed to record receipt")
        }
        setLoading(false)
    }

    // Filter for non-fulfilled orders
    const activeOrders = orders.filter(o => o.status !== 'fulfilled' && o.status !== 'cancelled' && o.status !== 'rejected')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
                    <Truck className="h-4 w-4" />
                    Record New Delivery
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black text-xl uppercase tracking-tighter">
                        <Truck className="h-6 w-6 text-primary" />
                        Inbound Intake
                    </DialogTitle>
                    <DialogDescription className="font-medium">
                        Log a new delivery arrival and update inventory status.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="order" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Target Purchase Order</Label>
                        <select
                            id="order"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedOrderId}
                            onChange={(e) => setSelectedOrderId(e.target.value)}
                            required
                        >
                            <option value="">Select an active order...</option>
                            {activeOrders.map(order => (
                                <option key={order.id} value={order.id}>
                                    {order.supplier.name} — PO#{order.id.slice(0, 8).toUpperCase()} (₹{Number(order.totalAmount).toLocaleString()})
                                </option>
                            ))}
                        </select>
                        {activeOrders.length === 0 && (
                            <p className="text-[10px] text-amber-600 font-bold italic">No active 'Sent' or 'Approved' orders found.</p>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Warehouse Log Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            placeholder="Describe condition, box counts, or discrepancies..."
                            className="h-24 resize-none border-accent/20 focus:border-primary/50"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading || !selectedOrderId} className="w-full h-12 text-md font-bold">
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Truck className="mr-2 h-5 w-5" />}
                            Mark as Fulfilled
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
