'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { escalateInvoiceToHumanReview, rerunInvoiceMatch, updateInvoiceStatus } from "@/app/actions/invoices";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { getThreeWayMatchReasonLabel } from "@/lib/utils/three-way-match";

export function InvoiceActions({
    invoiceId,
    status,
    onChanged,
}: {
    invoiceId: string;
    status: string;
    onChanged?: () => Promise<void> | void;
}) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAction = async (newStatus: 'pending' | 'disputed' | 'paid') => {
        setIsLoading(true);
        try {
            const res = await updateInvoiceStatus(invoiceId, newStatus);
            if (res.success) {
                await onChanged?.();
                toast.success(
                    newStatus === "pending"
                        ? "Invoice moved back to review"
                        : newStatus === "paid"
                            ? "Invoice marked as paid"
                            : `Invoice marked as ${newStatus}`,
                );
            } else {
                toast.error(res.error || "Failed to update invoice");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRerun = async () => {
        setIsLoading(true);
        try {
            const res = await rerunInvoiceMatch(invoiceId);
            if (res.success) {
                await onChanged?.();
                toast.success(
                    res.status === "MATCHED"
                        ? "Deterministic match passed"
                        : "Deterministic match rerun complete",
                    {
                        description: res.reason
                            ? getThreeWayMatchReasonLabel(res.reason)
                            : "Invoice status refreshed from the rule engine.",
                    },
                );
            } else {
                toast.error(res.error || "Failed to rerun invoice matching");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEscalate = async () => {
        setIsLoading(true);
        try {
            const res = await escalateInvoiceToHumanReview(invoiceId);
            if (res.success) {
                await onChanged?.();
                toast.success(
                    res.reused ? "Review task refreshed" : "Escalated for review",
                    {
                        description: res.reused
                            ? "An open review task was raised back to the operator queue."
                            : "A manual validation task was created before any payment status update can continue.",
                    },
                );
            } else {
                toast.error(res.error || "Failed to escalate invoice");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'paid') return null;

    return (
        <div className="flex justify-end gap-2 flex-wrap">
            <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-tighter border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={handleRerun}
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run Rules"}
            </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={handleEscalate}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
                Escalate
            </Button>
            {status === 'pending' && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => handleAction('disputed')}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Move to Dispute"}
                </Button>
            )}
            {status === 'matched' && (
                <>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleAction('pending')}
                    disabled={isLoading}
                >
                    Undo to Review
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handleAction('paid')}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Paid"}
                </Button>
                </>
            )}
            {status === 'disputed' && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleAction('pending')}
                    disabled={isLoading}
                >
                    Undo to Review
                </Button>
            )}
        </div>
    );
}
