'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Sparkles, BarChart3, Loader2, Zap } from "lucide-react";
import { launchRFQSourcingEvent } from "@/app/actions/rfqs";
import { prepareRFQNegotiation } from "@/app/actions/sourcing-events";
import { toast } from "sonner";

export function LaunchSourcingButton({ rfqId }: { rfqId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleLaunch = () => {
        startTransition(async () => {
            const result = await launchRFQSourcingEvent(rfqId);
            if (result.success) {
                toast.success("Sourcing event launched", {
                    description: "Invited suppliers can now submit live quotes in the portal."
                });
                router.refresh();
                return;
            }

            toast.error(result.error || "Failed to launch sourcing event");
        });
    };

    return (
        <Button
            className="w-full gap-2 bg-primary text-primary-foreground font-bold"
            onClick={handleLaunch}
            disabled={isPending}
        >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isPending ? "Launching..." : "Launch Sourcing Event"}
        </Button>
    );
}

export function ComparePricesButton() {
    const handleScroll = () => {
        document.getElementById('rfq-cost-insights')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-9 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/10"
            onClick={handleScroll}
        >
            <BarChart3 className="h-3 w-3 mr-1" />
            Compare
        </Button>
    );
}

export function PrepareNegotiationButton({ rfqId, disabled = false }: { rfqId: string; disabled?: boolean }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handlePrepare = () => {
        startTransition(async () => {
            try {
                const result = await prepareRFQNegotiation(rfqId);
                if (result.success) {
                    toast.success("Negotiation workbench prepared", {
                        description: `Workflow task created with ${result.shouldCostGap.toLocaleString()} still open against should-cost.`
                    });
                    router.refresh();
                    return;
                }

                const errorMessage = 'error' in result ? result.error : "Unable to prepare the negotiation workflow";
                toast.error(errorMessage);
            } catch {
                toast.error("Unable to prepare the negotiation workflow");
            }
        });
    };

    return (
        <Button
            size="sm"
            variant="secondary"
            className="w-full gap-2 font-bold"
            onClick={handlePrepare}
            disabled={disabled || isPending}
        >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {isPending ? "Preparing..." : "Prep Negotiation"}
        </Button>
    );
}
