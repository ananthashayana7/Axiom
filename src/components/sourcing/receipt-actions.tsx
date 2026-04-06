"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { deleteGoodsReceipt, updateGoodsReceiptInspection } from "@/app/actions/goods-receipts"
import { toast } from "sonner"
import { MoreHorizontal, Trash, FileText, ExternalLink, CheckCircle2, AlertTriangle, Clock3, XCircle } from "lucide-react"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ReceiptActions({ receiptId, orderId, inspectionStatus }: { receiptId: string, orderId: string, inspectionStatus?: string | null }) {
    const [loading, setLoading] = useState(false)

    const handleInspectionUpdate = async (status: 'pending' | 'passed' | 'failed' | 'conditional') => {
        setLoading(true)
        const res = await updateGoodsReceiptInspection({ receiptId, status })
        if (res.success) {
            toast.success(`Inspection marked ${status}`)
        } else {
            toast.error(res.error || "Failed to update inspection")
        }
        setLoading(false)
    }

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
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-2">Inspection Status</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleInspectionUpdate('passed')} disabled={loading || inspectionStatus === 'passed'} className="cursor-pointer py-3">
                    <CheckCircle2 className="h-4 w-4 mr-3 text-emerald-600" />
                    <span className="font-semibold">Mark Passed</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInspectionUpdate('conditional')} disabled={loading || inspectionStatus === 'conditional'} className="cursor-pointer py-3">
                    <AlertTriangle className="h-4 w-4 mr-3 text-amber-600" />
                    <span className="font-semibold">Mark Conditional</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInspectionUpdate('failed')} disabled={loading || inspectionStatus === 'failed'} className="cursor-pointer py-3">
                    <XCircle className="h-4 w-4 mr-3 text-red-600" />
                    <span className="font-semibold">Mark Failed</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInspectionUpdate('pending')} disabled={loading || inspectionStatus === 'pending'} className="cursor-pointer py-3">
                    <Clock3 className="h-4 w-4 mr-3 text-stone-500" />
                    <span className="font-semibold">Reset to Pending</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-700 focus:bg-red-50 py-3 cursor-pointer">
                    <Trash className="h-4 w-4 mr-3" />
                    <span className="font-semibold">Remove Record</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
