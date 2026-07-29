'use client'

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function PortalSecurityStatus() {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (status === 'unauthenticated') {
        redirect('/login');
    }

    if (session?.user?.role !== 'supplier') {
        redirect('/');
    }

    const isTwoFactorEnabled = session?.user?.isTwoFactorEnabled ?? false;

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Portal Security</h1>
                <p className="text-muted-foreground mt-2">Manage your account security settings</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Two-Factor Authentication</CardTitle>
                                <CardDescription>Secure your account with 2FA</CardDescription>
                            </div>
                        </div>
                        <Badge variant={isTwoFactorEnabled ? 'default' : 'secondary'}>
                            {isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isTwoFactorEnabled ? (
                        <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/30">
                            <p className="text-sm text-green-700">
                                Two-factor authentication is enabled on your account. Your portal data is protected with an additional security layer.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/30">
                            <div className="flex gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-700">
                                    Two-factor authentication is required for your account. You will be prompted to set it up on your next login.
                                </p>
                            </div>
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                        Two-factor authentication adds an extra layer of security to your Axiom supplier portal account by requiring a code from your authenticator app in addition to your password.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
