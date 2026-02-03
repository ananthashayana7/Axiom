"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteGoodsReceipt } from "@/app/actions/goods-receipts"
import { toast } from "sonner"
import { MoreHorizontal, Trash, FileText, ExternalLink } from "lucide-react"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ReceiptActions({ receiptId, orderId }: { receiptId: string, orderId: string }) {
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this receiving record? This will not affect the Order status but will remove the delivery log.")) return
        setLoading(true)
        const res = await deleteGoodsReceipt(receiptId)
        if (res.success) {
            toast.success("Receiving record removed")
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
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-3">Receipt Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`/sourcing/orders/${orderId}`}>
                    <DropdownMenuItem className="cursor-pointer py-3">
                        <FileText className="h-4 w-4 mr-3 text-primary" />
                        <span className="font-semibold">View Source PO</span>
                        <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-700 focus:bg-red-50 py-3 cursor-pointer">
                    <Trash className="h-4 w-4 mr-3" />
                    <span className="font-semibold">Remove Record</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
