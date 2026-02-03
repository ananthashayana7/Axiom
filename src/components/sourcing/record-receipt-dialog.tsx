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
import { Truck, Loader2 } from "lucide-react"
import { recordGoodsReceipt } from "@/app/actions/orders"
import { toast } from "sonner"

export function RecordReceiptDialog({ orderId, trigger }: { orderId: string, trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const notes = formData.get("notes") as string
        const visualInspectionPassed = formData.get("visualInspection") === "on"
        const quantityVerified = formData.get("quantityVerified") === "on"
        const documentMatch = formData.get("documentMatch") === "on"

        const res = await recordGoodsReceipt(orderId, {
            notes,
            visualInspectionPassed,
            quantityVerified,
            documentMatch
        })
        if (res.success) {
            toast.success("Goods receipt recorded successfully")
            setOpen(false)
        } else {
            toast.error(res.error || "Failed to record receipt")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Truck className="h-4 w-4" />
                        Record Receipt
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" />
                        Record Delivery Receipt
                    </DialogTitle>
                    <DialogDescription>
                        Log physical arrival of goods at the warehouse for this order.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 gap-4 bg-muted/30 p-4 rounded-xl border border-dashed mb-2">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Quality Control Checklist</p>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="visualInspection" name="visualInspection" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                            <Label htmlFor="visualInspection" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Visual Inspection Passed (No damage)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="quantityVerified" name="quantityVerified" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                            <Label htmlFor="quantityVerified" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Quantity Verified (Matches PO)
                            </Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="documentMatch" name="documentMatch" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" defaultChecked />
                            <Label htmlFor="documentMatch" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Documents Match (Invoice/ASN)
                            </Label>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Receiving & QC Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            placeholder="e.g. 5 boxes received, no external damage, verified against packing list."
                            className="h-24"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Delivery & QC
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
