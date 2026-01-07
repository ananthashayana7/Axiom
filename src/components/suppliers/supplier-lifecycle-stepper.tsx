'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateSupplier } from "@/app/actions/suppliers";
import { Check, ClipboardList, UserPlus, AlertTriangle, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LifecycleStatus = 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';

interface SupplierLifecycleStepperProps {
    supplierId: string;
    currentStatus: LifecycleStatus;
    isAdmin: boolean;
}

const steps: { status: LifecycleStatus; label: string; icon: any }[] = [
    { status: 'prospect', label: 'Prospect', icon: UserPlus },
    { status: 'onboarding', label: 'Onboarding', icon: ClipboardList },
    { status: 'active', label: 'Active', icon: Check },
];

export function SupplierLifecycleStepper({ supplierId, currentStatus, isAdmin }: SupplierLifecycleStepperProps) {
    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = (newStatus: LifecycleStatus) => {
        if (!isAdmin) return;

        startTransition(async () => {
            const result = await updateSupplier(supplierId, { lifecycleStatus: newStatus });
            if (result.success) {
                toast.success(`Supplier progressed to ${newStatus.toUpperCase()}`);
            } else {
                toast.error("Failed to update lifecycle status");
            }
        });
    };

    if (currentStatus === 'terminated') {
        return (
            <div className="flex items-center gap-2 text-destructive font-semibold bg-destructive/10 px-4 py-2 rounded-lg border border-destructive/20">
                <XOctagon size={20} />
                Relationship Terminated
            </div>
        );
    }

    if (currentStatus === 'suspended') {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-warning font-semibold bg-warning/10 px-4 py-2 rounded-lg border border-warning/20">
                    <AlertTriangle size={20} />
                    Supplier Suspended
                </div>
                {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => handleStatusUpdate('active')}>
                        Reactivate Supplier
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between w-full relative pt-2">
                {/* Connecting Lines */}
                <div className="absolute top-7 left-0 w-full h-0.5 bg-muted -z-10" />
                <div
                    className="absolute top-7 left-0 h-0.5 bg-primary transition-all duration-500 -z-10"
                    style={{
                        width: currentStatus === 'prospect' ? '0%' : currentStatus === 'onboarding' ? '50%' : '100%'
                    }}
                />

                {steps.map((step, idx) => {
                    const isCompleted = steps.findIndex(s => s.status === currentStatus) >= idx;
                    const isActive = step.status === currentStatus;
                    const Icon = step.icon;

                    return (
                        <div key={step.status} className="flex flex-col items-center gap-2">
                            <div
                                className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center transition-all border-2 cursor-pointer",
                                    isCompleted ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-background border-muted text-muted-foreground",
                                    !isCompleted && isAdmin && "hover:border-primary/50"
                                )}
                                onClick={() => isAdmin && !isCompleted && handleStatusUpdate(step.status)}
                            >
                                <Icon size={18} />
                            </div>
                            <span className={cn(
                                "text-xs font-semibold uppercase tracking-wider",
                                isCompleted ? "text-foreground font-bold" : "text-muted-foreground"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {isAdmin && currentStatus !== 'active' && (
                <div className="flex gap-2 justify-end">
                    {currentStatus === 'prospect' && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleStatusUpdate('onboarding')}
                            disabled={isPending}
                        >
                            Start Onboarding
                        </Button>
                    )}
                    {currentStatus === 'onboarding' && (
                        <Button
                            size="sm"
                            onClick={() => handleStatusUpdate('active')}
                            disabled={isPending}
                        >
                            Approve Supplier
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleStatusUpdate('terminated')}
                        disabled={isPending}
                    >
                        Decline/Terminate
                    </Button>
                </div>
            )}
        </div>
    );
}
