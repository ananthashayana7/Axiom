'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { escalateInvoiceToHumanReview, requestInvoiceOverride, rerunInvoiceMatch, updateInvoiceStatus } from "@/app/actions/invoices";
import { toast } from "sonner";
import { Loader2, Lock, RotateCcw, ShieldAlert } from "lucide-react";
import { getThreeWayMatchReasonLabel } from "@/lib/utils/three-way-match";
import { useSession } from "next-auth/react";
import { canEscalateInvoiceReview, canMarkInvoicePaid, canRunInvoiceRules } from "@/lib/rbac";

export function InvoiceActions({
    invoiceId,
    status,
    releaseHold,
    reversedAt,
    pendingOverrideRequestType,
    onChanged,
}: {
    invoiceId: string;
    status: string;
    releaseHold?: boolean | null;
    reversedAt?: Date | string | null;
    pendingOverrideRequestType?: string | null;
    onChanged?: () => Promise<void> | void;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const { data } = useSession();
    const currentUser = data?.user;
    const canRunRules = canRunInvoiceRules(currentUser);
    const canEscalate = canEscalateInvoiceReview(currentUser);
    const canMarkPaid = canMarkInvoicePaid(currentUser);
    const isReversed = Boolean(reversedAt);
    const hasPendingOverride = Boolean(pendingOverrideRequestType);

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

    const handleOverrideRequest = async (requestType: 'place_hold' | 'clear_hold' | 'payment_reversal') => {
        const actionLabel = requestType === 'place_hold'
            ? 'place a release hold'
            : requestType === 'clear_hold'
                ? 'clear the release hold'
                : 'reverse the payment';
        const reason = window.prompt(`Record the reason to ${actionLabel} for this invoice.`);
        if (!reason) return;

        setIsLoading(true);
        try {
            const res = await requestInvoiceOverride({
                invoiceId,
                requestType,
                reason,
            });
            if (res.success) {
                await onChanged?.();
                toast.success("Dual approval request submitted", {
                    description: "A different finance approver must now approve or reject this request.",
                });
            } else {
                toast.error(res.error || "Failed to route override request");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'paid' && !isReversed) {
        return (
            <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    <Lock className="h-3 w-3" />
                    Archived
                </div>
                {hasPendingOverride ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                        <ShieldAlert className="h-3 w-3" />
                        Dual Approval Pending
                    </div>
                ) : canMarkPaid ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] font-bold uppercase tracking-tighter border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleOverrideRequest('payment_reversal')}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                        Request Reversal
                    </Button>
                ) : null}
            </div>
        );
    }

    if (isReversed) {
        return (
            <div className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700">
                <RotateCcw className="h-3 w-3" />
                Reversed
            </div>
        );
    }

    return (
        <div className="flex justify-end gap-2 flex-wrap">
            {canRunRules ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={handleRerun}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run Rules"}
                </Button>
            ) : null}
            {canEscalate ? (
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
            ) : null}
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
                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                        <Lock className="h-3 w-3" />
                        {releaseHold ? 'Hold Active' : 'Compliance Locked'}
                    </div>
                    {hasPendingOverride ? (
                        <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                            <ShieldAlert className="h-3 w-3" />
                            Dual Approval Pending
                        </div>
                    ) : canRunRules ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-bold uppercase tracking-tighter border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => handleOverrideRequest(releaseHold ? 'clear_hold' : 'place_hold')}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="mr-1 h-3 w-3" />}
                            {releaseHold ? 'Request Hold Release' : 'Request Hold'}
                        </Button>
                    ) : null}
                    {canMarkPaid ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[10px] font-bold uppercase tracking-tighter border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => handleAction('paid')}
                            disabled={isLoading || Boolean(releaseHold) || hasPendingOverride}
                        >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Paid"}
                        </Button>
                    ) : null}
                </>
            )}
            {status === 'disputed' && (
                <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    Dispute Hold
                </div>
            )}
        </div>
    );
}
