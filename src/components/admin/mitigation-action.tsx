'use client'

import React, { useTransition } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react"
import { mitigateRisk, MitigationPlanType } from "@/app/actions/risk"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface MitigationActionProps {
    supplierId: string
    supplierName: string
    currentRisk: number
    type?: 'card' | 'link'
}

export function MitigationAction({ supplierId, supplierName, currentRisk, type = 'link' }: MitigationActionProps) {
    const [open, setOpen] = React.useState(false)
    const [isPending, startTransition] = useTransition()
    const [reason, setReason] = React.useState("")

    const handleMitigation = (plan: MitigationPlanType) => {
        if (!reason && plan !== 'audit_request') {
            toast.error("Please provide a reason for this mitigation plan.")
            return
        }

        startTransition(async () => {
            const result = await mitigateRisk(supplierId, plan, reason || "Routine risk-based audit trigger")
            if (result.success) {
                toast.success(result.message)
                setOpen(false)
                setReason("")
            } else {
                toast.error(result.error)
            }
        })
    }

    const Trigger = () => {
        if (type === 'card') {
            return (
                <Button variant="outline" className="w-full mt-4 border-primary/20 hover:bg-primary/5 text-primary gap-2">
                    Action Mitigation Plan <ShieldAlert size={14} />
                </Button>
            )
        }
        return (
            <button className="inline-flex items-center gap-1 text-xs text-primary font-bold mt-4 hover:underline">
                Action Mitigation Plan <ArrowUpRight size={14} />
            </button>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <span><Trigger /></span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-red-100 text-red-600">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl">Risk Mitigation: {supplierName}</DialogTitle>
                            <DialogDescription>
                                High-priority supply chain protection for current risk score: <strong>{currentRisk}/100</strong>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Risk Observations / Reason</Label>
                        <Textarea
                            id="reason"
                            placeholder="e.g., Geopolitical tension in region, reported financial instability, or ESG audit failure..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="h-24 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <Label>Select Defense Playbook</Label>

                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 border-l-4 border-l-blue-500 hover:bg-blue-50/30"
                            onClick={() => handleMitigation('secondary_source')}
                            disabled={isPending}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Secondary Sourcing</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Strategy: Redundancy</span>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 border-l-4 border-l-purple-500 hover:bg-purple-50/30"
                            onClick={() => handleMitigation('audit_request')}
                            disabled={isPending}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Urgent Risk Audit</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Strategy: Investigation</span>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 border-l-4 border-l-orange-500 hover:bg-orange-50/30"
                            onClick={() => handleMitigation('stockpile')}
                            disabled={isPending}
                        >
                            <div className="text-left">
                                <span className="block font-bold">Increase Safety Buffer</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Strategy: Inventory Hedge</span>
                            </div>
                        </Button>

                        <Button
                            variant="destructive"
                            className="justify-start h-auto py-3 px-4"
                            onClick={() => handleMitigation('suspend')}
                            disabled={isPending}
                        >
                            <div className="text-left">
                                <span className="block font-bold text-white">Temporary Suspension</span>
                                <span className="text-[10px] text-red-100 uppercase tracking-tight">Strategy: Isolation</span>
                            </div>
                        </Button>
                    </div>
                </div>

                <DialogFooter className="sm:justify-start">
                    {isPending && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Activating immutable mitigation plan...
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
