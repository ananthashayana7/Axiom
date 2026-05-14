'use client'

import { RouteErrorView } from "@/components/shared/route-error-view";

export default function AdminError({
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
            scope="admin"
            title="Admin Route Interrupted"
            description="This admin workspace section failed to render. Retry only this section or return to the admin console."
            homeHref="/admin"
        />
    );
}
