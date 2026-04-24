'use client'

import { useActionState, useState, useEffect } from 'react';
import { authenticate, verifyAndEnableTwoFactor } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { toast } from "sonner";
import { AxiomLogo } from "@/components/shared/axiom-logo";

type LoginMode = 'admin' | 'user' | 'supplier';

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
    const [loginMode, setLoginMode] = useState<LoginMode>('user');

    useEffect(() => {
        let processedError = '';
        if (errorMessage) {
            if (errorMessage.includes('require-2fa')) {
                setShow2FA(true);
                setShowSetup2FA(false);
                processedError = '';
            } else if (errorMessage.startsWith('setup-2fa:')) {
                const payload = errorMessage.slice('setup-2fa:'.length);
                const [qrUrl, secret] = payload.split('|');
                setQrCodeUrl(qrUrl);
                if (secret) setSetupSecret(secret);
                setShowSetup2FA(true);
                processedError = '';
            } else if (errorMessage === 'setup-2fa') {
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
            const result = await verifyAndEnableTwoFactor(setupCode, identifier);
            if (result.success) {
                toast.success("2FA enabled! Enter a fresh code from your authenticator to log in.");
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

    const features = [
        { icon: Zap, label: "AI-Powered Sourcing", desc: "10 autonomous agents working 24/7" },
        { icon: ShieldCheck, label: "3-Way Invoice Matching", desc: "Automated fraud detection & validation" },
        { icon: BarChart3, label: "Real-time Risk Intelligence", desc: "ESG scoring & supplier risk monitoring" },
    ];
    const loginModes: Array<{
        mode: LoginMode;
        label: string;
        title: string;
        description: string;
    }> = [
        {
            mode: 'user',
            label: 'Internal Workspace',
            title: 'Internal team sign-in',
            description: 'For procurement, operations, and business users.',
        },
        {
            mode: 'admin',
            label: 'Admin Console',
            title: 'Administrator sign-in',
            description: 'Restricted control-plane access for platform administrators.',
        },
        {
            mode: 'supplier',
            label: 'Supplier Portal',
            title: 'Supplier portal sign-in',
            description: 'External supplier access for RFQs, orders, and portal tasks.',
        },
    ];
    const activeMode = loginModes.find((entry) => entry.mode === loginMode) ?? loginModes[0];

    return (
        <div className="flex min-h-full bg-background">
            {/* Left panel — branding */}
            <div className="hidden lg:flex flex-col justify-between w-[420px] xl:w-[460px] bg-primary p-10 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(0,0,0,0.15)_0%,_transparent_70%)] pointer-events-none" />
                {/* Decorative grid */}
                <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '40px 40px'}} />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-14">
                        <div className="h-9 w-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                            <AxiomLogo className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <span className="text-[17px] font-black tracking-tight text-white">Axiom</span>
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/55">Procurement OS</p>
                        </div>
                    </div>
                    <h2 className="text-[28px] font-black text-white leading-tight mb-4">
                        Intelligent<br />Procurement,<br />Simplified.
                    </h2>
                    <p className="text-white/65 text-sm leading-relaxed max-w-xs">
                        AI-powered sourcing, supplier management, and spend analytics — built for modern procurement teams.
                    </p>
                </div>

                <div className="relative z-10 space-y-4">
                    {features.map((f) => {
                        const Icon = f.icon;
                        return (
                            <div key={f.label} className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
                                    <Icon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-white text-[13px] font-semibold">{f.label}</p>
                                    <p className="text-white/55 text-[11px] mt-0.5">{f.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative bg-gradient-to-br from-background via-background to-primary/5">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/4 rounded-full blur-3xl pointer-events-none" />
                <div className="w-full max-w-sm relative z-10">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                            <AxiomLogo className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <span className="text-[17px] font-black tracking-tight text-foreground">Axiom</span>
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Procurement OS</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-card/90 backdrop-blur-sm p-7 shadow-2xl shadow-black/5">
                        <h1 className="mb-1 text-2xl font-black tracking-tight text-foreground">
                            {showSetup2FA ? "Secure your account" : (show2FA ? "Two-factor auth" : activeMode.title)}
                        </h1>
                        <p className="mb-6 text-sm text-muted-foreground">
                            {showSetup2FA ? "Set up 2FA to protect your account" : (show2FA ? "Enter the code from your authenticator app" : activeMode.description)}
                        </p>

                        <form action={formAction} className="space-y-4">
                            <input type="hidden" name="roleMode" value={loginMode} />
                            {!show2FA && !showSetup2FA ? (
                                <>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {loginModes.map((entry) => (
                                            <button
                                                key={entry.mode}
                                                type="button"
                                                onClick={() => setLoginMode(entry.mode)}
                                                className={`rounded-xl border px-3 py-2 text-left transition-all ${loginMode === entry.mode
                                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                                    : 'border-border bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                                    }`}
                                            >
                                                <span className="block text-[10px] font-black uppercase tracking-[0.14em]">{entry.label}</span>
                                                <span className="mt-1 block text-[11px] leading-4">{entry.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="identifier" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            {loginMode === 'supplier' ? 'Supplier Email Address' : 'Work Email Address'}
                                        </Label>
                                        <Input
                                            id="identifier"
                                            name="identifier"
                                            type="email"
                                            placeholder={loginMode === 'supplier' ? 'supplier@company.com' : 'you@company.com'}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            required
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                className="text-xs text-primary hover:underline font-medium"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                name="password"
                                                type={showPassword ? "text" : "password"}
                                                className="pr-10 h-10"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`rounded-xl border px-3 py-2 text-[11px] leading-5 ${loginMode === 'admin'
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : loginMode === 'supplier'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : 'border-blue-200 bg-blue-50 text-blue-800'
                                        }`}>
                                        {loginMode === 'admin'
                                            ? 'Admin Console access is limited to platform administrators and protected routes only.'
                                            : loginMode === 'supplier'
                                                ? 'Supplier Portal accounts are restricted to vendor-facing RFQs, documents, requests, and order visibility.'
                                                : 'Internal Workspace accounts can operate the procurement workspace without entering the admin control plane.'}
                                    </div>
                                </>
                            ) : showSetup2FA ? (
                                <div className="space-y-4">
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        <p className="text-xs text-center text-muted-foreground">Scan this QR code with your Authenticator app (Google or Microsoft Authenticator).</p>
                                        <div className="bg-white p-3 rounded-xl shadow-inner border">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                                        </div>
                                        {setupSecret && (
                                            <div className="w-full">
                                                <p className="text-[10px] text-center text-muted-foreground mb-1">Or enter this key manually:</p>
                                                <code className="block w-full p-2 bg-muted border rounded-lg text-center font-mono text-xs break-all select-all">
                                                    {setupSecret}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="setupCode" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification Code</Label>
                                        <Input
                                            id="setupCode"
                                            value={setupCode}
                                            onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                                            placeholder="000000"
                                            maxLength={6}
                                            required
                                            className="text-center text-2xl tracking-[0.3em] font-bold h-12"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={handleVerifySetup}
                                        disabled={isVerifyingSetup || setupCode.length !== 6}
                                    >
                                        {isVerifyingSetup ? "Verifying..." : "Verify & Enable 2FA"}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="code" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticator Code</Label>
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
                                            className="text-center text-2xl tracking-[0.3em] font-bold h-12"
                                        />
                                        <p className="text-[10px] text-center text-muted-foreground">Open your Authenticator app to get the code.</p>
                                    </div>
                                    <input type="hidden" name="identifier" value={identifier} />
                                    <input type="hidden" name="password" value={password} />
                                </div>
                            )}

                            {!showSetup2FA && (
                                <Button className="w-full h-10 font-semibold" aria-disabled={isPending} type="submit">
                                    {isPending ? (show2FA ? "Verifying..." : "Signing in...") : (show2FA ? "Verify Code" : "Sign in")}
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
                                    className="w-full text-xs text-muted-foreground hover:text-foreground hover:underline mt-2 transition-colors"
                                >
                                    ← Back to sign in
                                </button>
                            )}

                            <div
                                className="flex h-6 items-end space-x-1"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                {displayErrorMessage && (
                                    <p className="text-xs text-red-500 font-medium text-center w-full">{displayErrorMessage}</p>
                                )}
                            </div>
                        </form>
                    </div>

                    <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
                        Secured by Axiom &middot; Enterprise Procurement Platform
                    </p>
                </div>
            </div>
        </div>
    );
}
