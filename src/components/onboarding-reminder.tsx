'use client'

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowRight } from 'lucide-react';

export function OnboardingReminder() {
    const { data: session } = useSession();

    if (!session?.user || session.user.onboardingCompleted) {
        return null;
    }

    return (
        <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4">
                <div className="flex gap-3 items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-blue-900">Complete your onboarding</p>
                        <p className="text-sm text-blue-800 mt-1">
                            Finish a few quick setup steps to get the most out of Axiom.
                        </p>
                    </div>
                    <Link href="/onboarding" className="flex-shrink-0 ml-2">
                        <Button size="sm" variant="outline" className="gap-1 h-8">
                            <span>Go</span>
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
