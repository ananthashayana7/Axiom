"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteAllParts } from "@/app/actions/parts"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

export function ClearInventoryButton() {
    const [open, setOpen] = useState(false)
    const [confirmationText, setConfirmationText] = useState("")
    const [loading, setLoading] = useState(false)

    const canDelete = useMemo(() => confirmationText.trim().toUpperCase() === "DELETE", [confirmationText])

    const handleDelete = async () => {
        if (!canDelete) {
            toast.error('Type "DELETE" to confirm the inventory purge.')
            return
        }

        setLoading(true)
        try {
            const result = await deleteAllParts(confirmationText.trim().toUpperCase())
            if (!result.success) {
                toast.error(result.error || "Failed to clear inventory")
                return
            }

            const clearedCount = 'partCount' in result ? (result.partCount ?? 0) : 0
            toast.success(`Cleared ${clearedCount} parts and linked inventory records.`)
            setOpen(false)
            setConfirmationText("")
            window.location.reload()
        } catch (_error) {
            toast.error("An unexpected error occurred while clearing inventory.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) {
                setConfirmationText("")
            }
        }}>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 size={16} />
                    Clear Inventory Only
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-500/20 shadow-2xl">
                <AlertDialogHeader>
                    <div className="mb-2 flex items-center gap-3 text-red-600">
                        <AlertTriangle className="h-8 w-8" />
                        <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">
                            Inventory Purge Guardrail
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="space-y-4 text-sm font-medium leading-relaxed">
                        <span className="block">
                            This removes the entire parts catalog and linked demand planning records. It is intentionally hidden from the live inventory screen to avoid accidental loss during operations.
                        </span>
                        <span className="block font-bold text-red-600 uppercase">
                            Type DELETE to confirm this admin-only action.
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-2">
                    <label htmlFor="inventory-delete-confirmation" className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Confirmation Phrase
                    </label>
                    <Input
                        id="inventory-delete-confirmation"
                        value={confirmationText}
                        onChange={(event) => setConfirmationText(event.target.value)}
                        placeholder='Type "DELETE"'
                        autoComplete="off"
                    />
                </div>

                <AlertDialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleDelete}
                        className="bg-red-600 font-bold text-white hover:bg-red-700"
                        disabled={!canDelete || loading}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete Inventory
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
