'use client'

import React, { useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { batchGeocodeSuppliers } from "@/app/actions/geocoding";
import { toast } from "sonner";

export function GeocodeTrigger() {
    const [isPending, startTransition] = useTransition();

    const handleBatchGeocode = () => {
        startTransition(async () => {
            const result = await batchGeocodeSuppliers();
            if (result.success) {
                toast.success(`Succesfully geocoded ${result.count} suppliers.`);
            } else {
                toast.error(result.error || "Geocoding failed.");
            }
        });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            disabled={isPending}
            onClick={handleBatchGeocode}
        >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {isPending ? "Geocoding..." : "Refresh Map Data"}
        </Button>
    );
}
