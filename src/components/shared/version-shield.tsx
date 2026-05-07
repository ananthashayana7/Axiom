"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type VersionShieldProps = {
    initialVersion: string;
    initialLabel: string;
};

export function VersionShield({ initialVersion, initialLabel }: VersionShieldProps) {
    const [latestLabel, setLatestLabel] = useState(initialLabel);
    const [staleDetected, setStaleDetected] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const checkVersion = async () => {
            try {
                const response = await fetch("/api/system/version", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    return;
                }

                const payload = await response.json() as { version?: string; label?: string };
                if (cancelled || !payload.version || payload.version === initialVersion) {
                    return;
                }

                setLatestLabel(payload.label || payload.version);
                setStaleDetected(true);
            } catch {
                // Keep the current session alive if the version probe fails.
            }
        };

        void checkVersion();
        const interval = window.setInterval(checkVersion, 60_000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [initialVersion]);

    const message = useMemo(() => {
        if (!staleDetected) {
            return null;
        }

        return `A newer app version (${latestLabel}) is live. Refresh now to avoid form and route mismatches.`;
    }, [latestLabel, staleDetected]);

    if (!message) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 top-0 z-[70] border-b border-amber-200 bg-amber-50/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3 text-amber-900">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{message}</p>
                </div>
                <Button
                    size="sm"
                    className="w-full gap-2 bg-amber-600 text-white hover:bg-amber-700 md:w-auto"
                    disabled={isRefreshing}
                    onClick={() => {
                        setIsRefreshing(true);
                        window.location.reload();
                    }}
                >
                    <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh Workspace
                </Button>
            </div>
        </div>
    );
}
