'use client';

import { useState } from "react";
import { CheckCheck, Copy, Eye, EyeOff, Mail, ShieldCheck, UserCheck, UserPlus, AlertCircle, AlertTriangle, Lock, Unlock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { approveSupplierOnboarding } from "@/app/actions/enterprise-readiness";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Step = {
    id: string;
    title: string;
    icon: React.ElementType;
    description: string;
};

// Map database lifecycle status to stepper steps
const STATUS_MAP: Record<string, string> = {
    'prospect': 'registration',
    'onboarding': 'compliance',
    'active': 'active',
};

const STEPS: Step[] = [
    { id: 'registration', title: 'Registration', icon: UserPlus, description: 'Basic info and profile setup' },
    { id: 'compliance', title: 'Compliance', icon: ShieldCheck, description: 'Documents and safety audit' },
    { id: 'active', title: 'Active', icon: UserCheck, description: 'Live in procurement catalog' },
];

interface StepperProps {
    supplierId: string;
    currentStatus: string;
    isAdmin?: boolean;
    approvalReadiness?: {
        canApprove: boolean;
        blockers: string[];
        score: number;
    };
    portalAccess?: {
        state: 'not_issued' | 'ready_to_issue' | 'issued' | 'locked';
        statusLabel: string;
        detail: string;
        portalUserEmail: string | null;
    } | null;
    onStatusChange?: (status: string) => void;
}

export function SupplierLifecycleStepper({ 
    supplierId, 
    currentStatus: rawStatus, 
    isAdmin = false,
    approvalReadiness,
    portalAccess,
    onStatusChange 
}: StepperProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [credDialog, setCredDialog] = useState<{ email: string; password: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const currentStepId = STATUS_MAP[rawStatus] || 'registration';
    const currentIndex = STEPS.findIndex(s => s.id === currentStepId);
    
    const handlePromote = async () => {
        if (!isAdmin || isUpdating) return;

        // If in onboarding (mapped to compliance step), check readiness before approving
        if (rawStatus === 'onboarding' && approvalReadiness && !approvalReadiness.canApprove) {
            toast.error("Supplier is not ready for approval", {
                description: approvalReadiness.blockers[0] || "Requirements not met."
            });
            return;
        }

        setIsUpdating(true);
        
        try {
            if (rawStatus === 'onboarding') {
                const res = await approveSupplierOnboarding(supplierId);
                if (res.success) {
                    if (res.temporaryPassword) {
                        setShowPassword(false);
                        setCredDialog({ 
                            email: res.portalUserEmail, 
                            password: res.temporaryPassword 
                        });
                        toast.warning("SMTP delivery failed. Manual credential handoff required.");
                    } else {
                        toast.success("Supplier portal account provisioned and welcome email sent.");
                    }
                    onStatusChange?.('active');
                } else {
                    toast.error(res.error || "Failed to provision portal access");
                }
            } else {
                // For other transitions (e.g. prospect -> onboarding)
                // We'll assume a generic promotion for now or just trigger the change
                const nextStatusMap: Record<string, string> = {
                    'prospect': 'onboarding',
                    'onboarding': 'active',
                };
                const nextStatus = nextStatusMap[rawStatus];
                if (nextStatus) {
                    onStatusChange?.(nextStatus);
                    toast.success(`Promoted to ${nextStatus}`);
                }
            }
        } catch (error) {
            console.error("Stepper update error:", error);
            toast.error("An unexpected error occurred during status update");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCopy = () => {
        if (!credDialog) return;
        navigator.clipboard.writeText(credDialog.password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Password copied to clipboard");
    };

    if (rawStatus === 'suspended' || rawStatus === 'terminated') {
        const isTerminated = rawStatus === 'terminated';
        return (
            <div className={cn(
                "rounded-lg border p-4 flex items-center justify-between",
                isTerminated ? "bg-slate-50 border-slate-200" : "bg-destructive/5 border-destructive/20"
            )}>
                <div className="flex items-center gap-3">
                    <AlertCircle className={cn("h-5 w-5", isTerminated ? "text-slate-500" : "text-destructive")} />
                    <div>
                        <p className={cn("font-bold text-sm uppercase tracking-tight", isTerminated ? "text-slate-700" : "text-destructive")}>
                            Lifecycle {isTerminated ? 'Terminated' : 'Suspended'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isTerminated ? 'This supplier record is archived and cannot be promoted.' : 'This supplier is currently blocked from all procurement activities.'}
                        </p>
                    </div>
                </div>
                {onStatusChange && !isTerminated && isAdmin && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs font-bold uppercase"
                        onClick={() => onStatusChange('registration')}
                    >
                        Re-Activate
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Dialog open={!!credDialog} onOpenChange={(open) => {
                if (!open) {
                    setCredDialog(null);
                    setShowPassword(false);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-amber-700">SMTP Not Configured - Manual Handoff Required</DialogTitle>
                        <DialogDescription>
                            Email delivery failed. Securely deliver these credentials to <strong>{credDialog?.email}</strong>. Do not send via unsecured channels.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Portal Email</p>
                            <Input readOnly value={credDialog?.email || ''} className="font-mono text-sm" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Temporary Password</p>
                            <div className="flex gap-2">
                                <Input
                                    readOnly
                                    type={showPassword ? "text" : "password"}
                                    value={credDialog?.password || ''}
                                    className="font-mono text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label={showPassword ? "Hide temporary password" : "Reveal temporary password"}
                                    onClick={() => setShowPassword((value) => !value)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button type="button" variant="outline" size="icon" aria-label="Copy temporary password" onClick={handleCopy}>
                                    {copied ? <CheckCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-destructive font-medium">This dialog will not reappear. Copy the password now.</p>
                    </div>
                    <Button
                        className="w-full mt-2"
                        onClick={() => {
                            setCredDialog(null);
                            setShowPassword(false);
                        }}
                    >
                        I have copied the credentials
                    </Button>
                </DialogContent>
            </Dialog>

            <div className="flex items-center justify-between w-full relative pt-2">
                <div className="absolute top-7 left-0 w-full h-0.5 bg-muted -z-10" />
                <div 
                    className="absolute top-7 left-0 h-0.5 bg-primary transition-all duration-500 -z-10" 
                    style={{ width: currentIndex >= 0 ? `${(currentIndex / (STEPS.length - 1)) * 100}%` : '0%' }}
                />

                {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isCompleted = idx < currentIndex;
                    const isActive = idx === currentIndex;
                    
                    return (
                        <div key={step.id} className="flex flex-col items-center gap-2 relative">
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-background",
                                isCompleted ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                                isActive ? "border-primary text-primary ring-4 ring-primary/10" : 
                                "border-muted text-muted-foreground"
                            )}>
                                {isCompleted ? <CheckCheck className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <div className="text-center absolute top-12 whitespace-nowrap">
                                <p className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    isActive ? "text-primary" : "text-muted-foreground/60"
                                )}>
                                    {step.title}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-10 flex flex-col gap-4 border-t pt-6">
                {rawStatus === 'onboarding' && approvalReadiness && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold uppercase tracking-wide">Approval Readiness</span>
                            </div>
                            <Badge className={cn("text-[10px] font-black", approvalReadiness.canApprove ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                {approvalReadiness.score}% READY
                            </Badge>
                        </div>
                        <Progress value={approvalReadiness.score} className="h-2" />
                        {!approvalReadiness.canApprove && (
                            <div className="flex gap-2 p-2 rounded bg-amber-50 border border-amber-100">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <p className="text-[10px] text-amber-800 leading-tight">
                                    <strong>Blocker:</strong> {approvalReadiness.blockers[0]}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {portalAccess && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            {portalAccess.state === 'issued' ? <Unlock className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-slate-400" />}
                            <div>
                                <p className="text-[10px] font-bold uppercase text-slate-900">{portalAccess.statusLabel}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">{portalAccess.detail}</p>
                            </div>
                        </div>
                        {portalAccess.portalUserEmail && (
                            <Badge variant="outline" className="text-[9px] font-mono">{portalAccess.portalUserEmail}</Badge>
                        )}
                    </div>
                )}

                {isAdmin && currentIndex < STEPS.length - 1 && (
                    <Button 
                        onClick={handlePromote}
                        disabled={isUpdating || (rawStatus === 'onboarding' && approvalReadiness && !approvalReadiness.canApprove)}
                        className="w-full group relative overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {isUpdating ? "Processing..." : `Promote to ${STEPS[currentIndex + 1].title}`}
                            {!isUpdating && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                        </span>
                    </Button>
                )}
                
                {!isAdmin && currentIndex < STEPS.length - 1 && (
                    <p className="text-[10px] text-center text-muted-foreground italic">Admin approval required for lifecycle promotion.</p>
                )}

                {currentIndex === STEPS.length - 1 && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                        <CheckCheck className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Lifecycle Complete</span>
                    </div>
                )}
            </div>
        </div>
    );
}
