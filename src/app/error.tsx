'use client'

import { RouteErrorView } from "@/components/shared/route-error-view";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            scope="root"
            description="Something went wrong while processing your request. This could be a transient network issue or a route-level failure."
        />
    );
}
