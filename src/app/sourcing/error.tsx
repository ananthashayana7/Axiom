'use client'

import { RouteErrorView } from "@/components/shared/route-error-view";

export default function SourcingError({
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
            scope="sourcing"
            title="Sourcing Route Interrupted"
            description="This sourcing section failed independently. Retry the section or return to the sourcing command hub."
            homeHref="/sourcing"
        />
    );
}
