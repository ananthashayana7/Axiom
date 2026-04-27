"use client"

import { useState } from "react"
import { Database, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { loadDemoWorkspace } from "@/app/actions/system"
import { Button } from "@/components/ui/button"
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

export function SeedDemoDataButton() {
    const [loading, setLoading] = useState(false)

    const handleSeed = async () => {
        setLoading(true)
        try {
            const response = await loadDemoWorkspace()
            if (!response.success) {
                toast.error(response.error || "Failed to load demo workspace")
                return
            }

            toast.success(response.message || "Demo workspace loaded.")
            window.location.reload()
        } catch (_error) {
            toast.error("An unexpected error occurred while preparing the demo workspace.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button className="w-full gap-2 bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700">
                    <Sparkles size={16} />
                    Load Demo Workspace
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="shadow-2xl">
                <AlertDialogHeader>
                    <div className="mb-2 flex items-center gap-3 text-emerald-700">
                        <Database className="h-8 w-8" />
                        <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">
                            Rebuild Demo Data
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                        This will replace the current workspace records with a stable demo dataset across suppliers, sourcing, invoices, savings, risk, compliance, support, and AI dashboards.
                        Admin access and secure platform settings will be preserved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6">
                    <AlertDialogCancel className="border-stone-200 font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleSeed}
                        className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "YES, LOAD DEMO DATA"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
