'use client'

import { useActionState, useState, useEffect } from 'react';
import { authenticate, setupTwoFactor, verifyAndEnableTwoFactor } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast } from "sonner";

export default function LoginPage() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    );
    const [showPassword, setShowPassword] = useState(false);
    const [show2FA, setShow2FA] = useState(false);
    const [showSetup2FA, setShowSetup2FA] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [setupCode, setSetupCode] = useState('');
    const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
    const [setupSuccess, setSetupSuccess] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [displayErrorMessage, setDisplayErrorMessage] = useState('');

    // Use effects for state transitions to avoid render-time state updates
    useEffect(() => {
        let processedError = '';
        if (errorMessage) {
            if (errorMessage.includes('require-2fa')) {
                setShow2FA(true);
                setShowSetup2FA(false);
                processedError = ''; // Don't display this as a user-facing error
            } else if (errorMessage.includes('setup-2fa')) {
                handleStart2FASetup();
                processedError = ''; // Don't display this as a user-facing error
            } else {
                processedError = errorMessage;
            }
        }
        setDisplayErrorMessage(processedError);
        if (processedError) {
            toast.error(processedError);
        }
    }, [errorMessage]);

    const handleStart2FASetup = async () => {
        const result = await setupTwoFactor();
        if (result.success && result.qrCodeUrl) {
            setQrCodeUrl(result.qrCodeUrl);
            setShowSetup2FA(true);
        } else {
            toast.error("Failed to initialize 2FA setup. Please contact admin.");
        }
    };

    const handleVerifySetup = async () => {
        if (setupCode.length !== 6) return;
        setIsVerifyingSetup(true);
        try {
            const result = await verifyAndEnableTwoFactor(setupCode);
            if (result.success) {
                setSetupSuccess(true);
                toast.success("2FA enabled successfully!");
                // After small delay, we'll try to login again automatically
                setTimeout(() => {
                    // We can't easily "formAction" here without ref, 
                    // but we can just ask the user to click login again
                    // OR better: we tell them it's ready and show a button to complete
                }, 1000);
            } else {
                toast.error(result.error || "Invalid code");
            }
        } finally {
            setIsVerifyingSetup(false);
        }
    };

    const handleForgotPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        alert("Please contact your administrator (admin@example.com) to reset your password.");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-md">
                <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-primary">Axiom</h1>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                    {showSetup2FA ? "Security Setup" : (show2FA ? "Enter verification code" : "Log in with Employee ID")}
                </p>
                <form action={formAction} className="space-y-4">
                    {!show2FA && !showSetup2FA ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Employee ID</Label>
                                <Input
                                    id="identifier"
                                    name="identifier"
                                    type="text"
                                    placeholder="e.g. EMP001"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                />
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
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
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
                        </>
                    ) : showSetup2FA ? (
                        <div className="space-y-4">
                            {!setupSuccess ? (
                                <>
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        <p className="text-xs text-center text-muted-foreground">Scan this QR code with your Authenticator app (Google or Microsoft Authenticator).</p>
                                        <div className="bg-white p-2 rounded-lg shadow-inner">
                                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="setupCode">Verification Code</Label>
                                        <Input
                                            id="setupCode"
                                            value={setupCode}
                                            onChange={(e) => setSetupCode(e.target.value)}
                                            placeholder="000000"
                                            maxLength={6}
                                            required
                                            className="text-center text-2xl tracking-[0.3em] font-bold"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={handleVerifySetup}
                                        disabled={isVerifyingSetup || setupCode.length !== 6}
                                    >
                                        {isVerifyingSetup ? "Verifying..." : "Verify & Enable 2FA"}
                                    </Button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center">
                                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg">2FA Setup Complete</h3>
                                        <p className="text-sm text-muted-foreground">Your account is now secure. Please click below to finish logging in.</p>
                                    </div>
                                    <Button type="submit" className="w-full">
                                        Finalize Login
                                    </Button>
                                    <input type="hidden" name="identifier" value={identifier} />
                                    <input type="hidden" name="password" value={password} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Authenticator Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    type="text"
                                    placeholder="000000"
                                    autoFocus
                                    required
                                    maxLength={6}
                                    className="text-center text-2xl tracking-[0.3em] font-bold"
                                />
                                <p className="text-[10px] text-center text-muted-foreground">Open your Authenticator app to get the code.</p>
                            </div>
                            {/* Hidden inputs to preserve credentials for the action */}
                            <input type="hidden" name="identifier" value={identifier} />
                            <input type="hidden" name="password" value={password} />
                        </div>
                    )}

                    {!showSetup2FA && (
                        <Button className="w-full" aria-disabled={isPending} type="submit">
                            {isPending ? (show2FA ? "Verifying..." : "Logging in...") : (show2FA ? "Verify Code" : "Log in")}
                        </Button>
                    )}

                    <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                            setShow2FA(false);
                            setShowSetup2FA(false);
                            setSetupCode('');
                            window.location.reload(); // Hard reset to clear action state safely
                        }}
                        className="w-full text-xs text-muted-foreground hover:underline mt-4"
                    >
                        Cancel and back to login
                    </button>
                    <div
                        className="flex h-8 items-end space-x-1"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {displayErrorMessage && (
                            <p className="text-sm text-red-500 font-medium text-center w-full">{displayErrorMessage}</p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
