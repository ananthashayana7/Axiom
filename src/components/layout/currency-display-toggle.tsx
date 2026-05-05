'use client';

import { Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/currency-provider";

export function CurrencyDisplayToggle() {
    const { displayMode, geoLocale, ready, reportingCurrency, toggleDisplayMode } = useCurrency();

    if (!ready) {
        return null;
    }

    const isReportingMode = displayMode === 'reporting';
    const label = isReportingMode
        ? `${reportingCurrency} Book View`
        : `${geoLocale.currencyCode} Local View`;
    const helper = isReportingMode ? "Fixed reporting-book lens" : "User-local FX lens";

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDisplayMode}
            className="hidden h-9 items-center gap-2 border-border/70 bg-background/80 px-3 text-left md:flex"
            title="Local view converts the display into the user's operating currency. Book view converts the same records into fixed reporting-book rates without changing source invoices."
        >
            <Landmark className="h-3.5 w-3.5 text-primary" />
            <span className="flex flex-col leading-none">
                <span className="text-[11px] font-bold">{label}</span>
                <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{helper}</span>
            </span>
        </Button>
    );
}
