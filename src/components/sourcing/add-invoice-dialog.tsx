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
import { Receipt, Loader2 } from "lucide-react"
import { addInvoice } from "@/app/actions/orders"
import { toast } from "sonner"

export function AddInvoiceDialog({
    orderId,
    supplierId,
    poAmount,
    trigger
}: {
    orderId: string,
    supplierId: string,
    poAmount?: number,
    trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const invoiceNumber = formData.get("invoiceNumber") as string
        const amount = parseFloat(formData.get("amount") as string)

        const res = await addInvoice({
            orderId,
            supplierId,
            invoiceNumber,
            amount
        })

        if (res.success) {
            toast.success("Invoice recorded successfully")
            setOpen(false)
        } else {
            toast.error(res.error || "Failed to add invoice")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Receipt className="h-4 w-4" />
                        Add Invoice
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        Log Supplier Invoice
                    </DialogTitle>
                    <DialogDescription>
                        Enter the financial details from the supplier's invoice for Three-Way Matching.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="invoiceNumber">Invoice Number</Label>
                        <Input
                            id="invoiceNumber"
                            name="invoiceNumber"
                            placeholder="INV-2024-001"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Invoice Amount (₹)</Label>
                        <Input
                            id="amount"
                            name="amount"
                            type="number"
                            step="0.01"
                            defaultValue={poAmount}
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Record Invoice
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
