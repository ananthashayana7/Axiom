'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, BarChart3 } from "lucide-react";

interface LaunchSourcingButtonProps {
    rfqId: string;
    action?: (id: string, status: any) => Promise<any>;
}

export function LaunchSourcingButton({ rfqId }: { rfqId: string }) {
    const handleLaunch = () => {
        window.alert("Triggering AI Supplier Outreach... RFQ will be moved to OPEN status.");
        // In a real scenario, this would call a server action and then redirect/refresh
    };

    return (
        <Button
            className="w-full gap-2 bg-primary text-primary-foreground font-bold"
            onClick={handleLaunch}
        >
            <Sparkles size={16} />
            Launch Sourcing Event
        </Button>
    );
}

export function ComparePricesButton() {
    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-9 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/10"
            onClick={() => window.alert("Historical Price Comparison: Benchmarking against previous 24 months...")}
        >
            <BarChart3 className="h-3 w-3 mr-1" />
            Compare
        </Button>
    );
}
