'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to your telemetry or console
        console.error('Unhandled Runtime Error:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-500">
            <div className="bg-red-50 dark:bg-red-950/20 p-6 rounded-full mb-6">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
                Unexpected System Interruption
            </h1>

            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 leading-relaxed">
                Something went wrong while processing your request. This could be due to a transient network issue or a momentary system glitch.
                {error.digest && (
                    <span className="block mt-2 font-mono text-[10px] opacity-50">
                        Error ID: {error.digest}
                    </span>
                )}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Button
                    onClick={() => reset()}
                    className="bg-primary hover:bg-primary/90 flex items-center gap-2 px-6"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Attempt Recovery
                </Button>

                <Button variant="outline" asChild className="px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Go to Dashboard
                    </Link>
                </Button>
            </div>

            <div className="mt-12 pt-8 border-t border-border w-full max-w-lg">
                <p className="text-xs text-muted-foreground">
                    If this issue persists, please contact Axiom Support with the Error ID provided above.
                </p>
            </div>
        </div>
    )
}
