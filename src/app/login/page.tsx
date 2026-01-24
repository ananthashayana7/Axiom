'use client'

import { useActionState, useState } from 'react';
import { authenticate } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    );
    const [showPassword, setShowPassword] = useState(false);

    const handleForgotPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        alert("Please log in first, then go to Profile > Change Password to reset your password. If you can't log in, contact your administrator (admin@example.com).");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-md">
                <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-primary">Axiom</h1>
                <p className="mb-6 text-center text-sm text-muted-foreground">Log in to your account</p>
                <form action={formAction} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="identifier">Email or Employee ID</Label>
                        <Input id="identifier" name="identifier" type="text" placeholder="admin@example.com or ADMIN001" required />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-xs text-primary hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                className="pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <Button className="w-full" aria-disabled={isPending} type="submit">
                        {isPending ? "Logging in..." : "Log in"}
                    </Button>
                    <div
                        className="flex h-8 items-end space-x-1"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {errorMessage && (
                            <p className="text-sm text-red-500">{errorMessage}</p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
