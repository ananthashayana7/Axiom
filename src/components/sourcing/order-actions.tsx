"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateOrderStatus, deleteOrder } from "@/app/actions/orders"
import { toast } from "sonner"
import { MoreHorizontal, Trash, CheckCircle, XCircle, Send, FileText, ExternalLink, Truck, Receipt } from "lucide-react"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RecordReceiptDialog } from "./record-receipt-dialog"
import { AddInvoiceDialog } from "./add-invoice-dialog"

export function OrderActions({
    orderId,
    status,
    supplierId,
    totalAmount
}: {
    orderId: string,
    status: string,
    supplierId: string,
    totalAmount: number
}) {
    const [loading, setLoading] = useState(false)

    const handleUpdate = async (newStatus: any) => {
        setLoading(true)
        const res = await updateOrderStatus(orderId, newStatus)
        if (res.success) {
            toast.success(`Order status: ${newStatus}`)
        } else {
            toast.error(res.error || "Failed to update")
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        if (!confirm("Caution: Deleting an order is permanent and removes all associated items. Continue?")) return
        setLoading(true)
        const res = await deleteOrder(orderId)
        if (res.success) {
            toast.success("Order deleted")
        } else {
            toast.error(res.error || "Failed to delete")
        }
        setLoading(false)
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" disabled={loading}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-accent/20">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3 px-4">Order Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <Link href={`/sourcing/orders/${orderId}`}>
                    <DropdownMenuItem className="cursor-pointer py-3 px-4">
                        <FileText className="h-4 w-4 mr-3 text-primary" />
                        <span className="font-semibold text-sm">View Details</span>
                        <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
                    </DropdownMenuItem>
                </Link>

                {status === 'draft' && (
                    <DropdownMenuItem onClick={() => handleUpdate('pending_approval')} className="cursor-pointer py-3 px-4">
                        <Send className="h-4 w-4 mr-3 text-sky-500" />
                        <span className="font-semibold text-sm">Submit for Approval</span>
                    </DropdownMenuItem>
                )}

                {status === 'approved' && (
                    <DropdownMenuItem onClick={() => handleUpdate('sent')} className="cursor-pointer py-3 px-4">
                        <Send className="h-4 w-4 mr-3 text-emerald-500" />
                        <span className="font-semibold text-sm">Send to Supplier</span>
                    </DropdownMenuItem>
                )}

                {status !== 'fulfilled' && status !== 'cancelled' && (
                    <DropdownMenuItem onClick={() => handleUpdate('cancelled')} className="cursor-pointer py-3 px-4">
                        <XCircle className="h-4 w-4 mr-3 text-amber-500" />
                        <span className="font-semibold text-sm">Cancel Order</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <RecordReceiptDialog
                    orderId={orderId}
                    trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer py-3 px-4">
                            <Truck className="h-4 w-4 mr-3 text-indigo-500" />
                            <span className="font-semibold text-sm">Record Receipt</span>
                        </DropdownMenuItem>
                    }
                />

                <AddInvoiceDialog
                    orderId={orderId}
                    supplierId={supplierId}
                    poAmount={totalAmount}
                    trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer py-3 px-4">
                            <Receipt className="h-4 w-4 mr-3 text-purple-500" />
                            <span className="font-semibold text-sm">Add Invoice</span>
                        </DropdownMenuItem>
                    }
                />

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-700 focus:bg-red-50 py-3 px-4 cursor-pointer">
                    <Trash className="h-4 w-4 mr-3" />
                    <span className="font-semibold text-sm">Delete Order</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
