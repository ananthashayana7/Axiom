'use client'

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";

import { trackClientErrorBoundary } from "@/app/actions/telemetry";
import { Button } from "@/components/ui/button";

type RouteErrorViewProps = {
    error: Error & { digest?: string };
    reset: () => void;
    scope: string;
    title?: string;
    description?: string;
    homeHref?: string;
};

export function RouteErrorView({
    error,
    reset,
    scope,
    title = "Unexpected System Interruption",
    description = "Something went wrong while processing this workspace route. You can retry the section without tearing down the full app shell.",
    homeHref = "/",
}: RouteErrorViewProps) {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") {
            console.error("Route error boundary:", {
                scope,
                message: error.message,
                digest: error.digest,
            });
        }

        void trackClientErrorBoundary({
            scope,
            digest: error.digest,
            message: error.message,
        });
    }, [error, scope]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="mb-6 rounded-full bg-red-50 p-6 dark:bg-red-950/20">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>

            <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground">
                {title}
            </h1>

            <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-muted-foreground">
                {description}
                {error.digest && (
                    <span className="mt-2 block font-mono text-[10px] opacity-50">
                        Error ID: {error.digest}
                    </span>
                )}
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button onClick={() => reset()} className="flex items-center gap-2 px-6">
                    <RefreshCcw className="h-4 w-4" />
                    Attempt Recovery
                </Button>

                <Button variant="outline" asChild className="px-6">
                    <Link href={homeHref} className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Go to Dashboard
                    </Link>
                </Button>
            </div>

            <div className="mt-12 w-full max-w-lg border-t border-border pt-8">
                <p className="text-xs text-muted-foreground">
                    If this issue persists, contact Axiom Support with the Error ID above.
                </p>
            </div>
        </div>
    );
}
