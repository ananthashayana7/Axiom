'use client'

import { useActionState, useEffect, useState } from 'react';
import { authenticate, verifyAndEnableTwoFactor } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { toast } from "sonner";
import { AxiomLogo } from "@/components/shared/axiom-logo";

type LoginMode = 'admin' | 'user' | 'supplier';

export default function LoginPage() {
    const [authResult, formAction, isPending] = useActionState(
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
        if (authResult) {
            if (authResult.status === 'success') {
                window.location.assign(authResult.redirectUrl);
                return;
            }

            if (authResult.status === 'require-2fa') {
                console.log('[LOGIN] 2FA required - showing code entry screen');
                setShow2FA(true);
                setShowSetup2FA(false);
                processedError = '';
            } else if (authResult.status === 'setup-2fa') {
                console.log('[LOGIN] 2FA setup needed', { 
                    hasQrCode: !!authResult.qrCodeUrl, 
                    qrCodeLength: authResult.qrCodeUrl?.length || 0,
                    hasSecret: !!authResult.secret 
                });
                setQrCodeUrl(authResult.qrCodeUrl);
                if (authResult.secret) setSetupSecret(authResult.secret);
                setShowSetup2FA(true);
                processedError = '';
            } else if (authResult.status === 'error') {
                console.log('[LOGIN] Auth error:', authResult.message);
                processedError = authResult.message;
            }
        }

        setDisplayErrorMessage(processedError);
        if (processedError) {
            toast.error(processedError);
        }
    }, [authResult]);

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
        { icon: Zap, label: "Guarded AI execution", desc: "Autonomous workflows with routed recovery and approval gates" },
        { icon: ShieldCheck, label: "Controlled data movement", desc: "Protected imports, matching controls, and audit-ready approvals" },
        { icon: BarChart3, label: "Global operating visibility", desc: "Multi-currency spend with regional risk and compliance context" },
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
            description: 'Platform-wide control, approvals, intelligence, and operating oversight.',
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
        <div className="min-h-full bg-background">
            <div className="mx-auto grid min-h-full w-full max-w-[1680px] lg:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]">
                <div className="relative hidden min-h-full shrink-0 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.34),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.22),transparent_42%),linear-gradient(160deg,#0f172a_0%,#10332e_42%,#18624d_100%)] p-8 lg:flex lg:flex-col lg:justify-between xl:p-10">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,_transparent_60%)]" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-1/2 w-full bg-[radial-gradient(ellipse_at_bottom_left,_rgba(0,0,0,0.18)_0%,_transparent_70%)]" />
                    <div
                        className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
                            backgroundSize: '40px 40px',
                        }}
                    />

                    <div className="relative z-10">
                        <div className="mb-14 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm">
                                <AxiomLogo className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <span className="text-[17px] font-black tracking-tight text-white">Axiom</span>
                            </div>
                        </div>

                        <div className="mb-5 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
                            Secure procurement workspace
                        </div>

                        <h2 className="mb-4 text-[30px] font-black leading-tight text-white">
                            Control procurement across currencies, regions, and supplier risk.
                        </h2>
                        <p className="max-w-sm text-sm leading-relaxed text-white/70">
                            One workspace for sourcing, approvals, supplier evidence, and resilient operating routes.
                        </p>
                    </div>

                    <div className="relative z-10 space-y-4">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div key={feature.label} className="rounded-2xl border border-white/14 bg-white/8 p-4 backdrop-blur-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/12">
                                            <Icon className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-white">{feature.label}</p>
                                            <p className="mt-0.5 text-[11px] text-white/60">{feature.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="relative flex min-h-full items-start justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.10),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_52%,#f6fdf9_100%)] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 xl:px-12">
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
                    <div className="relative z-10 w-full max-w-[500px] py-2 sm:py-4">
                        <div className="mb-8 flex items-center gap-3 lg:hidden">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
                                <AxiomLogo className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                                <span className="text-[17px] font-black tracking-tight text-foreground">Axiom</span>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/70 bg-card/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/70">Axiom</p>
                                </div>
                                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                                    Secure sign in
                                </div>
                            </div>

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
                                                    className={`min-h-[84px] rounded-2xl border px-3 py-3 text-left transition-all ${loginMode === entry.mode
                                                        ? 'border-primary bg-primary/[0.08] text-primary shadow-[0_10px_30px_rgba(16,185,129,0.10)]'
                                                        : 'border-border bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground'
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
                                                className="h-11"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
                                                <button
                                                    type="button"
                                                    onClick={handleForgotPassword}
                                                    className="text-xs font-medium text-primary hover:underline"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    id="password"
                                                    name="password"
                                                    type={showPassword ? "text" : "password"}
                                                    className="h-11 pr-10"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className={`rounded-2xl border px-3 py-3 text-[11px] leading-5 ${loginMode === 'admin'
                                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                                            : loginMode === 'supplier'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : 'border-blue-200 bg-blue-50 text-blue-800'
                                            }`}>
                                            {loginMode === 'admin'
                                                ? 'Admin Console sessions can manage platform controls, approvals, intelligence, and operating routes.'
                                                : loginMode === 'supplier'
                                                    ? 'Supplier Portal accounts are restricted to vendor-facing RFQs, documents, requests, and order visibility.'
                                                : 'Internal Workspace accounts can operate the procurement workspace without entering the admin control plane.'}
                                        </div>
                                    </>
                                ) : showSetup2FA ? (
                                    <div className="space-y-4">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <p className="text-center text-xs text-muted-foreground">Scan this QR code with your Authenticator app (Google or Microsoft Authenticator).</p>
                                            <div className="rounded-xl border bg-white p-4 shadow-inner flex items-center justify-center min-h-[180px]">
                                                {qrCodeUrl ? (
                                                    <img src={qrCodeUrl} alt="2FA QR Code" className="h-48 w-48 object-contain" />
                                                ) : (
                                                    <p className="text-xs text-muted-foreground text-center">Loading QR code...</p>
                                                )}
                                            </div>
                                            {setupSecret && (
                                                <div className="w-full">
                                                    <p className="mb-1 text-center text-[10px] text-muted-foreground">Or enter this key manually:</p>
                                                    <code className="block w-full break-all rounded-lg border bg-muted p-2 text-center font-mono text-xs select-all">
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
                                                className="h-12 text-center text-2xl font-bold tracking-[0.3em]"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
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
                                                className="h-12 text-center text-2xl font-bold tracking-[0.3em]"
                                            />
                                            <p className="text-center text-[10px] text-muted-foreground">Open your Authenticator app to get the code.</p>
                                        </div>
                                        <input type="hidden" name="identifier" value={identifier} />
                                        <input type="hidden" name="password" value={password} />
                                    </div>
                                )}

                                {!showSetup2FA && (
                                    <Button className="h-11 w-full font-semibold shadow-lg shadow-emerald-100" aria-disabled={isPending} type="submit">
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
                                        className="mt-2 w-full text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                                    >
                                        Back to sign in
                                    </button>
                                )}

                                <div
                                    className="flex h-6 items-end space-x-1"
                                    aria-live="polite"
                                    aria-atomic="true"
                                >
                                    {displayErrorMessage && (
                                        <p className="w-full text-center text-xs font-medium text-red-500">{displayErrorMessage}</p>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
