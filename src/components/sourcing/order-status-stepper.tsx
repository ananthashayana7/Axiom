'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateOrderStatus } from "@/app/actions/orders";
import { Check, Send, Package, XCircle, Loader } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OrderStatus = 'draft' | 'sent' | 'fulfilled' | 'cancelled';

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
        if (!isAdmin) return;

        startTransition(async () => {
            const result = await updateOrderStatus(orderId, newStatus);
            if (result.success) {
                toast.success(`Order status updated to ${newStatus.toUpperCase()}`);
            } else {
                toast.error("Failed to update order status");
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

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between w-full relative">
                {/* Connecting Lines */}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-10" />
                <div
                    className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 -z-10"
                    style={{
                        width: currentStatus === 'draft' ? '0%' : currentStatus === 'sent' ? '50%' : '100%'
                    }}
                />

                {steps.map((step, idx) => {
                    const isCompleted = steps.findIndex(s => s.status === currentStatus) >= idx;
                    const isActive = step.status === currentStatus;
                    const Icon = step.icon;

                    return (
                        <div key={step.status} className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center transition-all border-2",
                                isCompleted ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-background border-muted text-muted-foreground"
                            )}>
                                <Icon size={18} className={cn(isActive && step.status === 'draft' && "animate-spin")} />
                            </div>
                            <span className={cn(
                                "text-xs font-medium",
                                isCompleted ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {isAdmin && currentStatus !== 'fulfilled' && (
                <div className="flex gap-2 justify-end mt-2">
                    {currentStatus === 'draft' && (
                        <Button
                            size="sm"
                            onClick={() => handleStatusUpdate('sent')}
                            disabled={isPending}
                        >
                            Mark as Sent
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
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleStatusUpdate('cancelled')}
                        disabled={isPending}
                    >
                        Cancel Order
                    </Button>
                </div>
            )}
        </div>
    );
}
