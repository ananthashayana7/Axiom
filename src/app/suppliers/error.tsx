'use client'

import { RouteErrorView } from "@/components/shared/route-error-view";

export default function SuppliersError({
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
            scope="suppliers"
            title="Supplier Workspace Interrupted"
            description="The supplier workspace hit an isolated rendering error. Retry this section without leaving the rest of Axiom."
            homeHref="/suppliers"
        />
    );
}
