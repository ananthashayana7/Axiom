'use client'

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifiedPage() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Simulate redirect landing (actual verification happened server-side)
        const error = searchParams.get('error');
        if (error) {
            setStatus('error');
            setMessage(error);
        } else {
            setStatus('success');
            setMessage('Your email has been verified successfully!');
        }
    }, [searchParams]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
                <Card className="w-full max-w-lg">
                    <CardContent className="p-12 text-center space-y-6">
                        <Loader2 className="h-8 w-8 text-primary mx-auto animate-spin" />
                        <p className="text-muted-foreground">Verifying your email...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
                <Card className="w-full max-w-lg border-red-500/30 bg-red-500/5">
                    <CardContent className="p-12 text-center space-y-6">
                        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold">Verification Failed</h2>
                        <p className="text-muted-foreground">{message}</p>
                        <Link href="/portal/register">
                            <Button className="w-full">Try Again</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
            <Card className="w-full max-w-lg border-green-500/30 bg-green-500/5">
                <CardContent className="p-12 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
                        <p className="text-muted-foreground mb-4">
                            Thank you for verifying your email address. An Axiom administrator will review your registration and contact you soon.
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                            Typical review time: 1-2 business days
                        </p>
                    </div>
                    <Link href="/portal/register">
                        <Button variant="outline" className="w-full">Back to Registration</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
