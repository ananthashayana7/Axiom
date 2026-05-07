'use client'

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateSupplier } from "@/app/actions/suppliers";
import { approveSupplierOnboarding, type SupplierPortalAccessSummary } from "@/app/actions/enterprise-readiness";
import { Check, ClipboardList, UserPlus, AlertTriangle, XOctagon } from "lucide-react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LifecycleStatus = 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';

interface SupplierLifecycleStepperProps {
    supplierId: string;
    currentStatus: LifecycleStatus;
    isAdmin: boolean;
    approvalReadiness?: {
        canApprove: boolean;
        blockers: string[];
        score: number;
    };
    portalAccess?: SupplierPortalAccessSummary | null;
}

const steps: { status: LifecycleStatus; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
    { status: 'prospect', label: 'Prospect', icon: UserPlus },
    { status: 'onboarding', label: 'Onboarding', icon: ClipboardList },
    { status: 'active', label: 'Active', icon: Check },
];

export function SupplierLifecycleStepper({
    supplierId,
    currentStatus,
    isAdmin,
    approvalReadiness,
    portalAccess,
}: SupplierLifecycleStepperProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const canApprove = approvalReadiness?.canApprove ?? true;
    const nextStepGuidance: Record<LifecycleStatus, string> = {
        prospect: "Capture contact, compliance, and location details before moving the supplier into onboarding.",
        onboarding: "Validate certifications, performance baselines, and supporting documents before approval and portal activation.",
        active: "Monitor performance and compliance regularly; suspend only if risk or performance deteriorates.",
        suspended: "Resolve the compliance or performance issue, then reactivate the supplier when controls pass.",
        terminated: "Relationship closed. Create a new supplier record if the vendor is re-engaged in the future.",
    };

    const handleStatusUpdate = (newStatus: LifecycleStatus) => {
        if (!isAdmin) return;

        startTransition(async () => {
            const result = await updateSupplier(supplierId, { lifecycleStatus: newStatus });
            if (result.success) {
                toast.success(`Supplier progressed to ${newStatus.toUpperCase()}`);
                router.refresh();
            } else {
                toast.error("Failed to update lifecycle status");
            }
        });
    };

    const handleApproval = () => {
        if (!isAdmin) return;

        startTransition(async () => {
            const result = await approveSupplierOnboarding(supplierId);
            if (!result.success) {
                toast.error(result.error || "Failed to approve supplier");
                return;
            }

            toast.success("Supplier approved and portal access issued", {
                description: result.emailSent
                    ? `${result.portalUserEmail} can now sign in, complete 2FA setup, and use the supplier portal.`
                    : `SMTP was unavailable. Credentials were created for ${result.portalUserEmail}, and manual handoff is required.`,
            });

            if (!result.emailSent && result.temporaryPassword) {
                window.alert(`SMTP is not configured. Portal credentials for ${result.portalUserEmail} were created with temporary password: ${result.temporaryPassword}`);
            }

            router.refresh();
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
                    const StepIcon = step.icon;

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
                                <StepIcon size={18} />
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

            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Next step:</span> {nextStepGuidance[currentStatus]}
            </div>

            {portalAccess ? (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">Portal access</span>
                        <span className={cn(
                            "font-semibold uppercase tracking-wide",
                            portalAccess.state === 'issued' ? "text-emerald-700" : portalAccess.state === 'ready_to_issue' ? "text-blue-700" : portalAccess.state === 'locked' ? "text-amber-700" : "text-muted-foreground",
                        )}>
                            {portalAccess.statusLabel}
                        </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">{portalAccess.detail}</p>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                        Contact: {portalAccess.portalUserEmail || portalAccess.contactEmail}
                        {portalAccess.provisionedAt ? ` | Provisioned ${new Date(portalAccess.provisionedAt).toLocaleDateString()}` : ''}
                    </div>
                </div>
            ) : null}

            {currentStatus === 'onboarding' && approvalReadiness && !approvalReadiness.canApprove && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    <span className="font-semibold">Approval locked:</span> readiness is {approvalReadiness.score}%.
                    {approvalReadiness.blockers.length > 0 ? ` ${approvalReadiness.blockers.slice(0, 2).join(' ')}` : ''}
                </div>
            )}

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
                            onClick={handleApproval}
                            disabled={isPending || !canApprove}
                        >
                            Approve + Issue Portal Access
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
