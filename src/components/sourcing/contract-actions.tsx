"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateContractStatus, deleteContract } from "@/app/actions/contracts"
import { toast } from "sonner"
import { MoreHorizontal, Trash, CheckCircle, XCircle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ContractActions({ contractId, status }: { contractId: string, status: string }) {
    const [loading, setLoading] = useState(false)

    const handleUpdate = async (newStatus: 'active' | 'expired' | 'terminated') => {
        setLoading(true)
        const res = await updateContractStatus(contractId, newStatus)
        if (res.success) {
            toast.success(`Contract is now ${newStatus}`)
        } else {
            toast.error(res.error || "Failed to update")
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to permanently delete this contract?")) return
        setLoading(true)
        const res = await deleteContract(contractId)
        if (res.success) {
            toast.success("Contract deleted")
        } else {
            toast.error(res.error || "Failed to delete")
        }
        setLoading(false)
    }

    return (
        <div className="flex gap-2 w-full mt-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="w-full" disabled={loading}>
                        <MoreHorizontal className="h-4 w-4 mr-2" />
                        Manage
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Contract Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {status !== 'active' && (
                        <DropdownMenuItem onClick={() => handleUpdate('active')}>
                            <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
                            Activate
                        </DropdownMenuItem>
                    )}
                    {status === 'active' && (
                        <DropdownMenuItem onClick={() => handleUpdate('terminated')}>
                            <XCircle className="h-4 w-4 mr-2 text-red-500" />
                            Terminate
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Permanently
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
