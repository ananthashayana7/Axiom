'use client';

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, RefreshCcw, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NavigatorWithConnection = Navigator & {
    connection?: {
        saveData?: boolean;
        effectiveType?: string;
        downlink?: number;
    };
};

export function OperationalFreshnessStrip({
    renderedAt,
    telemetryTitle,
    telemetryDetail,
    fxTitle,
    fxDetail,
}: {
    renderedAt: string;
    telemetryTitle: string;
    telemetryDetail: string;
    fxTitle: string;
    fxDetail: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [connectionMode, setConnectionMode] = useState<'live' | 'degraded'>('live');

    useEffect(() => {
        const updateConnectionMode = () => {
            const connection = (navigator as NavigatorWithConnection).connection;
            const lowBandwidth = Boolean(
                connection?.saveData
                || connection?.effectiveType === 'slow-2g'
                || connection?.effectiveType === '2g'
                || (typeof connection?.downlink === 'number' && connection.downlink <= 0.75),
            );

            setConnectionMode(!navigator.onLine || lowBandwidth ? 'degraded' : 'live');
        };

        updateConnectionMode();
        window.addEventListener('online', updateConnectionMode);
        window.addEventListener('offline', updateConnectionMode);

        return () => {
            window.removeEventListener('online', updateConnectionMode);
            window.removeEventListener('offline', updateConnectionMode);
        };
    }, []);

    return (
        <Card className="border-slate-200 bg-slate-50/80">
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-3 lg:grid-cols-3 lg:gap-6">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Data last synced</p>
                        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Clock3 className="h-4 w-4 text-primary" />
                            {new Date(renderedAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            This surface renders from guarded server actions. Force refresh if you need a fresh read before presenting.
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{telemetryTitle}</p>
                        <p className="mt-1 text-sm text-foreground">{telemetryDetail}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{fxTitle}</p>
                        <p className="mt-1 text-sm text-foreground">{fxDetail}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Badge
                        variant="outline"
                        className={cn(
                            connectionMode === 'live'
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                    >
                        {connectionMode === 'live' ? 'Live route' : 'Degraded / cached posture'}
                    </Badge>
                    {connectionMode === 'degraded' && (
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                            <WifiOff className="mr-1 h-3.5 w-3.5" />
                            Auto-refresh paused on weak or offline connection
                        </Badge>
                    )}
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => startTransition(() => router.refresh())}
                        disabled={isPending}
                    >
                        <RefreshCcw className={cn("h-4 w-4", isPending && "animate-spin")} />
                        Force Refresh
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
