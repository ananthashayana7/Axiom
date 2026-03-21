'use client'

import { useActionState, useState, useEffect } from 'react';
import { authenticate, verifyAndEnableTwoFactor } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from "sonner";
import { AxiomLogo } from "@/components/shared/axiom-logo";

export default function LoginPage() {
    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    );
    const [showPassword, setShowPassword] = useState(false);
    const [show2FA, setShow2FA] = useState(false);
    const [showSetup2FA, setShowSetup2FA] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [setupSecret, setSetupSecret] = useState('');
    const [setupCode, setSetupCode] = useState('');
    const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
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
            } else if (errorMessage.startsWith('setup-2fa:')) {
                // QR code URL and optional secret are embedded in the message
                const payload = errorMessage.slice('setup-2fa:'.length);
                const [qrUrl, secret] = payload.split('|');
                setQrCodeUrl(qrUrl);
                if (secret) setSetupSecret(secret);
                setShowSetup2FA(true);
                processedError = '';
            } else if (errorMessage === 'setup-2fa') {
                // Server couldn't generate QR code during login — show error
                processedError = 'Failed to initialize 2FA setup. Please try again or contact admin.';
            } else {
                processedError = errorMessage;
            }
        }
        setDisplayErrorMessage(processedError);
        if (processedError) {
            toast.error(processedError);
        }
    }, [errorMessage]);

    const handleVerifySetup = async () => {
        if (setupCode.length !== 6) return;
        setIsVerifyingSetup(true);
        try {
            // Pass identifier so the server action can locate the user without a session
            const result = await verifyAndEnableTwoFactor(setupCode, identifier);
            if (result.success) {
                toast.success("2FA enabled! Enter a fresh code from your authenticator to log in.");
                // Transition directly to 2FA code entry instead of "Finalize Login"
                setShowSetup2FA(false);
                setSetupCode('');
                setShow2FA(true);
            } else {
                toast.error(result.error || "Invalid code");
            }
        } finally {
            setIsVerifyingSetup(false);
        }
    };

    const handleForgotPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        toast.info("Please contact your administrator (admin@axiomprocure.com) to reset your password.");
    };

    return (
        <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl pointer-events-none" />
            <div className="w-full max-w-sm rounded-xl border bg-card/80 backdrop-blur-sm p-6 lg:p-8 shadow-xl relative z-10">
                <div className="flex justify-center mb-3">
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <AxiomLogo className="h-7 w-7 text-primary" />
                    </div>
                </div>
                <h1 className="mb-1 text-center text-3xl font-black tracking-tighter text-foreground">Axiom</h1>
                <p className="mb-6 text-center text-xs text-muted-foreground font-medium uppercase tracking-widest">
                    {showSetup2FA ? "Security Setup" : (show2FA ? "Enter verification code" : "Procurement Intelligence")}
                </p>
                <form action={formAction} className="space-y-4">
                    {!show2FA && !showSetup2FA ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="identifier">Email Address</Label>
                                <Input
                                    id="identifier"
                                    name="identifier"
                                    type="email"
                                    placeholder="you@company.com"
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
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <p className="text-xs text-center text-muted-foreground">Scan this QR code with your Authenticator app (Google or Microsoft Authenticator).</p>
                                <div className="bg-white p-2 rounded-lg shadow-inner">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                                </div>
                                {setupSecret && (
                                    <div className="w-full">
                                        <p className="text-[10px] text-center text-muted-foreground mb-1">Or enter this key manually:</p>
                                        <code className="block w-full p-2 bg-muted border rounded text-center font-mono text-xs break-all select-all">
                                            {setupSecret}
                                        </code>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="setupCode">Verification Code</Label>
                                <Input
                                    id="setupCode"
                                    value={setupCode}
                                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Authenticator Code</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    placeholder="000000"
                                    autoFocus
                                    required
                                    maxLength={6}
                                    autoComplete="one-time-code"
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

                    {(show2FA || showSetup2FA) && (
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                                setShow2FA(false);
                                setShowSetup2FA(false);
                                setSetupCode('');
                                setSetupSecret('');
                                setQrCodeUrl('');
                                setDisplayErrorMessage('');
                            }}
                            className="w-full text-xs text-muted-foreground hover:underline mt-4"
                        >
                            Cancel and back to login
                        </button>
                    )}
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
