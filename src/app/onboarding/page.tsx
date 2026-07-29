'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { getOnboardingChecklist, completeOnboarding, isOnboardingComplete } from '@/app/actions/onboarding';
import { toast } from 'sonner';
import type { OnboardingTask } from '@/app/actions/onboarding';

export default function OnboardingPage() {
    const router = useRouter();
    const { data: session, status, update } = useSession();
    const [tasks, setTasks] = useState<OnboardingTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [alreadyCompleted, setAlreadyCompleted] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated') {
            loadOnboarding();
        }
    }, [status, router]);

    const loadOnboarding = async () => {
        try {
            const [checklist, completed] = await Promise.all([
                getOnboardingChecklist(),
                isOnboardingComplete(),
            ]);

            if (completed) {
                setAlreadyCompleted(true);
                router.push(session?.user?.role === 'supplier' ? '/portal' : '/');
                return;
            }

            setTasks(checklist);
        } catch (error) {
            console.error('Failed to load onboarding:', error);
            toast.error('Failed to load onboarding checklist');
        } finally {
            setLoading(false);
        }
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const allComplete = completedCount === totalCount;

    const handleCompleteOnboarding = async () => {
        setCompleting(true);
        try {
            const result = await completeOnboarding();
            if (result.success) {
                toast.success('Welcome! Onboarding complete.');
                // Refresh the JWT so onboardingCompleted=true lands in the
                // token — this prevents the middleware from looping back here
                await update({ onboardingCompleted: true });
                router.push(session?.user?.role === 'supplier' ? '/portal' : '/');
            } else {
                toast.error(result.error || 'Failed to complete onboarding');
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
            toast.error('Failed to complete onboarding');
        } finally {
            setCompleting(false);
        }
    };

    if (loading || alreadyCompleted) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 lg:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight">Welcome to Axiom!</h1>
                    <p className="text-lg text-muted-foreground">
                        Complete these quick steps to get started
                    </p>
                </div>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle>Onboarding Progress</CardTitle>
                        <CardDescription>
                            {completedCount} of {totalCount} tasks completed
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {tasks.map((task) => (
                        <Card key={task.id} className={task.completed ? 'bg-muted/30' : ''}>
                            <CardContent className="p-6">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 pt-1">
                                        {task.completed ? (
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                                                <CheckCircle2 className="h-5 w-5 text-white" />
                                            </div>
                                        ) : (
                                            <Circle className="h-6 w-6 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold ${task.completed ? 'text-muted-foreground line-through' : ''}`}>
                                            {task.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {task.description}
                                        </p>
                                    </div>
                                    {task.action && !task.completed && (
                                        <Link href={task.action.href} className="flex-shrink-0 ml-2">
                                            <Button variant="outline" size="sm" className="gap-1">
                                                {task.action.label}
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {allComplete && (
                    <Card className="border-green-500/30 bg-green-500/5">
                        <CardContent className="p-6">
                            <div className="flex gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-green-900">All set!</p>
                                    <p className="text-sm text-green-800 mt-1">
                                        You've completed all onboarding tasks. You're ready to start using Axiom.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!allComplete && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                            onClick={handleCompleteOnboarding}
                            disabled={!allComplete || completing}
                            className="flex-1"
                            size="lg"
                        >
                            {completing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Completing...
                                </>
                            ) : (
                                'Complete Onboarding'
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(session?.user?.role === 'supplier' ? '/portal' : '/')}
                            size="lg"
                            className="flex-1"
                        >
                            Skip for Now
                        </Button>
                    </div>
                )}

                {allComplete && (
                    <div className="flex gap-3">
                        <Button
                            onClick={handleCompleteOnboarding}
                            disabled={completing}
                            className="w-full"
                            size="lg"
                        >
                            {completing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Getting Started...
                                </>
                            ) : (
                                'Get Started'
                            )}
                        </Button>
                    </div>
                )}

                <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardContent className="p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800">
                                Need help? Check out our <Link href="/docs" className="underline font-medium hover:text-blue-900">documentation</Link> or contact support.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
