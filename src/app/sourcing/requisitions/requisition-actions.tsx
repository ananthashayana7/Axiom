'use client'

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveRequisition, rejectRequisition, convertToPO } from "@/app/actions/requisitions";
import { toast } from "sonner";
import { Loader, Check, X, Repeat, ExternalLink } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

interface RequisitionActionsProps {
    requisitionId: string;
    status: string;
    isAdmin: boolean;
    suppliers: any[];
    purchaseOrderId?: string | null;
}

export function RequisitionActions({ requisitionId, status, isAdmin, suppliers, purchaseOrderId }: RequisitionActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [convertOpen, setConvertOpen] = React.useState(false);
    const [selectedSupplier, setSelectedSupplier] = React.useState<string>("");

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveRequisition(requisitionId);
            if (result.success) {
                toast.success("Requisition approved");
            } else {
                toast.error(result.error || "Approval failed");
            }
        });
    };

    const handleReject = () => {
        const reason = window.prompt("Reason for rejection:");
        if (!reason) return;

        startTransition(async () => {
            const result = await rejectRequisition(requisitionId, reason);
            if (result.success) {
                toast.success("Requisition rejected");
            } else {
                toast.error(result.error || "Rejection failed");
            }
        });
    };

    const handleConvert = () => {
        if (!selectedSupplier) {
            toast.error("Please select a supplier");
            return;
        }

        startTransition(async () => {
            const result = await convertToPO(requisitionId, selectedSupplier);
            if (result.success) {
                toast.success("Converted to Purchase Order");
                setConvertOpen(false);
            } else {
                toast.error(result.error || "Conversion failed");
            }
        });
    };

    if (status === 'converted_to_po' && purchaseOrderId) {
        return (
            <Link href={`/sourcing/orders/${purchaseOrderId}`}>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                    <ExternalLink size={12} />
                    View PO
                </Button>
            </Link>
        );
    }

    if (!isAdmin) {
        return <Button variant="ghost" size="sm" className="h-8">Details</Button>
    }

    return (
        <div className="flex justify-end items-center gap-2">
            {status === 'pending_approval' && (
                <>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleReject}
                        disabled={isPending}
                    >
                        <X size={16} />
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                        onClick={handleApprove}
                        disabled={isPending}
                    >
                        {isPending ? <Loader className="h-3 w-3 animate-spin" /> : <Check size={14} />}
                        Approve
                    </Button>
                </>
            )}

            {status === 'approved' && (
                <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-1 border-primary/30 text-primary hover:bg-primary/5">
                            <Repeat size={14} />
                            Convert to PO
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Convert Requisition to PO</DialogTitle>
                            <DialogDescription>
                                Select a vendor to fulfill this internal request. This will generate a Purchase Order automatically.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="supplier">Primary Supplier</Label>
                                <Select onValueChange={setSelectedSupplier}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a strategic partner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name} (Tier {s.tierLevel === 'tier_1' ? '1' : s.tierLevel === 'tier_2' ? '2' : '3'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
                            <Button onClick={handleConvert} disabled={isPending || !selectedSupplier}>
                                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                Generate PO & Send
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {(status === 'rejected' || status === 'draft') && (
                <Button variant="ghost" size="sm" className="h-8 italic text-muted-foreground" disabled>
                    {status === 'rejected' ? 'Rejected' : 'Draft'}
                </Button>
            )}
        </div>
    );
}
