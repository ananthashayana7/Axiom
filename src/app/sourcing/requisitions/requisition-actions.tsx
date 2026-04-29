'use client';

import Link from "next/link";
import React, { useState, useTransition } from "react";
import { Check, ExternalLink, Loader2, Repeat, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { approveRequisition, convertToPO, rejectRequisition } from "@/app/actions/requisitions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils/currency";

interface RequisitionActionsProps {
    requisitionId: string;
    title: string;
    estimatedAmount: number;
    status: string;
    isAdmin: boolean;
    suppliers: any[];
    purchaseOrderId?: string | null;
}

export function RequisitionActions({
    requisitionId,
    title,
    estimatedAmount,
    status,
    isAdmin,
    suppliers,
    purchaseOrderId,
}: RequisitionActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [convertOpen, setConvertOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<string>("");
    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    const highValue = estimatedAmount >= 500000;

    const handleApprove = () => {
        startTransition(async () => {
            const result = await approveRequisition(requisitionId);
            if (result.success) {
                toast.success("Requisition approved");
                setApproveOpen(false);
            } else {
                toast.error(result.error || "Approval failed");
            }
        });
    };

    const handleReject = () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a rejection reason");
            return;
        }

        startTransition(async () => {
            const result = await rejectRequisition(requisitionId, rejectReason.trim());
            if (result.success) {
                toast.success("Requisition rejected");
                setRejectOpen(false);
                setRejectReason("");
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
                <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                    <ExternalLink size={12} />
                    View PO
                </Button>
            </Link>
        );
    }

    if (!isAdmin) {
        return (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" disabled>
                Awaiting approval
            </Button>
        );
    }

    return (
        <div className="flex items-center justify-end gap-2">
            {status === 'pending_approval' && (
                <>
                    <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                        <DialogTrigger asChild>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                disabled={isPending}
                            >
                                <X size={14} />
                                Reject
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reject Requisition</DialogTitle>
                                <DialogDescription>
                                    Add an auditable reason before this request is sent back to the requester.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3 py-2">
                                <Label htmlFor={`reject-reason-${requisitionId}`}>Reason</Label>
                                <Textarea
                                    id={`reject-reason-${requisitionId}`}
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    placeholder="Budget mismatch, missing justification, compliance gap..."
                                    className="min-h-[120px]"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                                <Button
                                    onClick={handleReject}
                                    disabled={isPending || !rejectReason.trim()}
                                    className="bg-red-600 text-white hover:bg-red-700"
                                >
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                                    Reject Requisition
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                        <Button
                            size="sm"
                            className={`h-10 gap-2 ${highValue ? 'bg-emerald-700 px-4 shadow-lg hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            onClick={() => setApproveOpen(true)}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={14} />}
                            {highValue ? 'Approve Spend' : 'Approve'}
                        </Button>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Approve this requisition?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    <span className="block font-medium text-foreground">{title}</span>
                                    <span className="mt-2 block">
                                        This approval will move {formatCurrency(estimatedAmount)} into the sourcing workflow and release it for PO conversion.
                                    </span>
                                    {highValue && (
                                        <span className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                                            <ShieldCheck className="h-4 w-4" />
                                            High-value approval. Please confirm budget, supplier strategy, and audit readiness.
                                        </span>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Review Again</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleApprove}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    Confirm Approval
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}

            {status === 'approved' && (
                <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-9 gap-1 border-primary/30 text-primary hover:bg-primary/5">
                            <Repeat size={14} />
                            Convert to PO
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Convert Requisition to PO</DialogTitle>
                            <DialogDescription>
                                Select the supplier that should fulfill this approved request. A purchase order will be generated and issued immediately.
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
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name} (Tier {supplier.tierLevel === 'tier_1' ? '1' : supplier.tierLevel === 'tier_2' ? '2' : '3'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
                            <Button onClick={handleConvert} disabled={isPending || !selectedSupplier}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generate PO and Send
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {(status === 'rejected' || status === 'draft') && (
                <Button variant="ghost" size="sm" className="h-9 italic text-muted-foreground" disabled>
                    {status === 'rejected' ? 'Rejected' : 'Draft'}
                </Button>
            )}
        </div>
    );
}
