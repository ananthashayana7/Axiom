"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { resetDatabase } from "@/app/actions/system"
import { toast } from "sonner"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ResetDatabaseButton() {
    const [loading, setLoading] = useState(false)

    const handleReset = async () => {
        setLoading(true)
        try {
            const res = await resetDatabase()
            if (res.success) {
                toast.success("Database has been reset to its pristine state.")
                window.location.reload()
            } else {
                toast.error(res.error || "Reset failed")
            }
        } catch (err) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2 font-bold uppercase tracking-tighter shadow-lg shadow-red-100">
                    <Trash2 size={16} />
                    Reset Entire Workspace
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-red-500/20 shadow-2xl">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 text-red-600 mb-2">
                        <AlertTriangle className="h-8 w-8" />
                        <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">Danger Zone: Irreversible Action</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                        This will permanently delete **ALL** enterprise data, including Suppliers, Purchase Orders, Contracts, and RFQs.
                        Your admin user and system settings will be preserved, but everything else will be wiped.
                        <br /><br />
                        <span className="font-bold text-red-600 uppercase">This action cannot be undone.</span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6">
                    <AlertDialogCancel className="font-bold border-stone-200">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleReset}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "YES, DELETE EVERYTHING"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
