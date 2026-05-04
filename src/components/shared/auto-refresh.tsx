"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

type NavigatorWithConnection = Navigator & {
    connection?: {
        saveData?: boolean;
        effectiveType?: string;
        downlink?: number;
    };
};

export function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
    const router = useRouter()

    useEffect(() => {
        const interval = setInterval(() => {
            const connection = (navigator as NavigatorWithConnection).connection
            const lowBandwidth = Boolean(
                connection?.saveData
                || connection?.effectiveType === "slow-2g"
                || connection?.effectiveType === "2g"
                || (typeof connection?.downlink === "number" && connection.downlink <= 0.75)
            )

            if (document.visibilityState !== "visible" || !navigator.onLine || lowBandwidth) {
                return
            }

            router.refresh()
        }, intervalMs)

        return () => clearInterval(interval)
    }, [router, intervalMs])

    return null
}
