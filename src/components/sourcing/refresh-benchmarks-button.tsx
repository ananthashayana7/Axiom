'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { syncInternalBenchmarks } from "@/app/actions/cost-intelligence";
import { toast } from "sonner";

export function RefreshBenchmarksButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRefresh = () => {
        startTransition(async () => {
            try {
                const result = await syncInternalBenchmarks();
                if (result.success) {
                    toast.success("Benchmark intelligence refreshed", {
                        description: `Updated ${result.categoriesUpdated} category benchmarks from internal history.`
                    });
                    router.refresh();
                    return;
                }

                toast.error(result.message || "No benchmark data could be generated");
            } catch {
                toast.error("Benchmark refresh failed");
            }
        });
    };

    return (
        <Button
            variant="outline"
            className="gap-2"
            onClick={handleRefresh}
            disabled={isPending}
        >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isPending ? 'Refreshing...' : 'Refresh Benchmarks'}
        </Button>
    );
}
