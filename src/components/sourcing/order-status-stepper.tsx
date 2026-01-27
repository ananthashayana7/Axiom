'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "@/app/actions/orders";
import { Check, Send, Package, XCircle, Loader } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OrderStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'fulfilled' | 'cancelled';

interface OrderStatusStepperProps {
    orderId: string;
    currentStatus: OrderStatus;
    isAdmin: boolean;
}

const steps: { status: OrderStatus; label: string; icon: any }[] = [
    { status: 'draft', label: 'Draft', icon: Loader },
    { status: 'sent', label: 'Sent', icon: Send },
    { status: 'fulfilled', label: 'Fulfilled', icon: Check },
];

export function OrderStatusStepper({ orderId, currentStatus, isAdmin }: OrderStatusStepperProps) {
    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = (newStatus: OrderStatus) => {
        // if (!isAdmin) return; // Removed this check as users can submit for approval

        startTransition(async () => {
            const result = await updateOrderStatus(orderId, newStatus);
            if (result.success) {
                toast.success(`Order status updated to ${newStatus.toUpperCase().replace('_', ' ')}`);
            } else {
                toast.error(result.error || "Failed to update order status");
            }
        });
    };

    if (currentStatus === 'cancelled') {
        return (
            <div className="flex items-center gap-2 text-destructive font-semibold bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
                <XCircle size={20} />
                Order Cancelled
            </div>
        );
    }

    if (currentStatus === 'rejected') {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-destructive font-semibold bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
                    <XCircle size={20} />
                    Order Rejected
                </div>
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate('draft')}
                        disabled={isPending}
                    >
                        Re-open as Draft
                    </Button>
                </div>
            </div>
        );
    }

    const extendedSteps: { status: OrderStatus; label: string; icon: any }[] = [
        { status: 'draft', label: 'Draft', icon: Loader },
        { status: 'pending_approval', label: 'Pending', icon: Package },
        { status: 'approved', label: 'Approved', icon: Check },
        { status: 'sent', label: 'Sent', icon: Send },
        { status: 'fulfilled', label: 'Fulfilled', icon: Check },
    ];

    // Calculate progress width
    const currentStepIndex = extendedSteps.findIndex(s => s.status === currentStatus);
    const progressWidth = currentStepIndex === -1 ? 0 : (currentStepIndex / (extendedSteps.length - 1)) * 100;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between w-full relative">
                {/* Connecting Lines */}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-10" />
                <div
                    className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-10"
                    style={{
                        width: `${progressWidth}%`
                    }}
                />

                {extendedSteps.map((step, idx) => {
                    const isCompleted = extendedSteps.findIndex(s => s.status === currentStatus) >= idx;
                    const isActive = step.status === currentStatus;
                    const Icon = step.icon;

                    return (
                        <div key={step.status} className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center transition-all border-2 bg-background z-10",
                                isCompleted ? "border-primary text-primary shadow-md" : "border-muted text-muted-foreground",
                                isActive && "bg-primary text-primary-foreground border-primary"
                            )}>
                                <Icon size={16} className={cn(isActive && step.status === 'draft' && "animate-spin")} />
                            </div>
                            <span className={cn(
                                "text-[10px] uppercase font-bold tracking-wider",
                                isCompleted ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
                {currentStatus === 'draft' && (
                    <Button
                        size="sm"
                        onClick={() => handleStatusUpdate('pending_approval')}
                        disabled={isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Submit for Approval
                    </Button>
                )}

                {currentStatus === 'pending_approval' && isAdmin && (
                    <>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStatusUpdate('rejected')}
                            disabled={isPending}
                        >
                            Reject
                        </Button>
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleStatusUpdate('approved')}
                            disabled={isPending}
                        >
                            Approve Order
                        </Button>
                    </>
                )}

                {currentStatus === 'approved' && (
                    <Button
                        size="sm"
                        onClick={() => handleStatusUpdate('sent')}
                        disabled={isPending}
                    >
                        Send to Supplier
                    </Button>
                )}

                {currentStatus === 'sent' && (
                    <Button
                        size="sm"
                        onClick={() => handleStatusUpdate('fulfilled')}
                        disabled={isPending}
                    >
                        Mark as Fulfilled
                    </Button>
                )}

                {/* Always show cancel unless completed */}
                {currentStatus !== 'fulfilled' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleStatusUpdate('cancelled')}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
}
