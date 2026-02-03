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
import { Globe, Loader2 } from "lucide-react"
import { updateOrderLogistics } from "@/app/actions/orders"
import { toast } from "sonner"

export function UpdateLogisticsDialog({
    orderId,
    initialData,
    trigger
}: {
    orderId: string,
    initialData: { carrier?: string | null, trackingNumber?: string | null, estimatedArrival?: string | null },
    trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Convert Date to string for input[type="date"]
    const formattedDate = initialData.estimatedArrival
        ? new Date(initialData.estimatedArrival).toISOString().split('T')[0]
        : ""

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)

        const res = await updateOrderLogistics(orderId, {
            carrier: formData.get("carrier") as string,
            trackingNumber: formData.get("trackingNumber") as string,
            estimatedArrival: formData.get("estimatedArrival") as string
        })

        if (res.success) {
            toast.success("Logistics information updated")
            setOpen(false)
        } else {
            toast.error(res.error || "Failed to update logistics")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Globe className="h-4 w-4" />
                        Update Tracking
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Manage Shipment Tracking
                    </DialogTitle>
                    <DialogDescription>
                        Update carrier details and estimated arrival for this order.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="carrier">Carrier</Label>
                        <Input
                            id="carrier"
                            name="carrier"
                            placeholder="e.g. FedEx, DHL, BlueDart"
                            defaultValue={initialData.carrier || ""}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="trackingNumber">Tracking Number</Label>
                        <Input
                            id="trackingNumber"
                            name="trackingNumber"
                            placeholder="e.g. TRK123456789"
                            defaultValue={initialData.trackingNumber || ""}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="estimatedArrival">Estimated Arrival</Label>
                        <Input
                            id="estimatedArrival"
                            name="estimatedArrival"
                            type="date"
                            defaultValue={formattedDate}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Logistics
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
