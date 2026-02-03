'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setupTwoFactor, verifyAndEnableTwoFactor, disableTwoFactor } from '@/app/actions/auth';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldAlert, Key, Smartphone, Copy, Check } from 'lucide-react';

interface TwoFactorSetupProps {
    isEnabled: boolean;
}

export function TwoFactorSetup({ isEnabled: initialEnabled }: TwoFactorSetupProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [isPending, setIsPending] = useState(false);
    const [step, setStep] = useState<'initial' | 'setup' | 'verify'>('initial');
    const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [hasCopied, setHasCopied] = useState(false);

    const [qrError, setQrError] = useState(false);

    const handleStartSetup = async () => {
        setIsPending(true);
        setQrError(false);
        try {
            const result = await setupTwoFactor();
            if (result.success) {
                setSetupData({ secret: result.secret!, qrCodeUrl: result.qrCodeUrl! });
                setStep('setup');
            } else {
                toast.error(result.error || "Failed to start 2FA setup");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    const handleVerifyToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (verificationCode.length !== 6) return;

        setIsPending(true);
        try {
            const result = await verifyAndEnableTwoFactor(verificationCode);
            if (result.success) {
                toast.success("2FA enabled successfully");
                setIsEnabled(true);
                setIsOpen(false);
                setStep('initial');
            } else {
                toast.error(result.error || "Verification failed");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    const handleDisable = async () => {
        if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) return;

        setIsPending(true);
        try {
            const result = await disableTwoFactor();
            if (result.success) {
                toast.success("2FA disabled");
                setIsEnabled(false);
            } else {
                toast.error(result.error || "Failed to disable 2FA");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    const copyToClipboard = () => {
        if (setupData?.secret) {
            navigator.clipboard.writeText(setupData.secret);
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        }
    };

    return (
        <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-stone-700">Authenticator App</p>
                    {isEnabled ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                            <ShieldCheck size={10} /> Active
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 uppercase">
                            <ShieldAlert size={10} /> Disabled
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground">Secure your account with TOTP (Google/Microsoft Authenticator).</p>
            </div>

            <Dialog open={isOpen} onOpenChange={(val) => {
                setIsOpen(val);
                if (!val) setStep('initial');
            }}>
                <DialogTrigger asChild>
                    <Button variant={isEnabled ? "outline" : "default"} size="sm" type="button" className="h-8 text-[10px] font-bold uppercase tracking-tighter shadow-sm">
                        {isEnabled ? "Manage 2FA" : "Setup 2FA"}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5 text-amber-600" />
                            Two-Factor Authentication
                        </DialogTitle>
                        <DialogDescription>
                            {isEnabled
                                ? "Manage your second factor settings."
                                : "Add an extra layer of security to your account."}
                        </DialogDescription>
                    </DialogHeader>

                    {isEnabled ? (
                        <div className="py-6 space-y-4">
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-emerald-500 rounded-full text-white shadow-lg">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-emerald-900 leading-none mb-1">2FA is Protected</p>
                                    <p className="text-xs text-emerald-700">Your account is secured with an authenticator app.</p>
                                </div>
                            </div>
                            <Button
                                variant="destructive"
                                className="w-full uppercase font-black tracking-widest text-[12px]"
                                onClick={handleDisable}
                                disabled={isPending}
                            >
                                {isPending ? <Loader2 className="animate-spin" /> : "Disable 2FA Protection"}
                            </Button>
                        </div>
                    ) : (
                        <div className="py-4">
                            {step === 'initial' && (
                                <div className="space-y-4 text-center">
                                    <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-2">
                                        <Smartphone size={32} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Use an authenticator app like Microsoft Authenticator to generate verification codes.
                                    </p>
                                    <Button onClick={handleStartSetup} disabled={isPending} className="w-full">
                                        {isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                        Begin Configuration
                                    </Button>
                                </div>
                            )}

                            {step === 'setup' && setupData && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center justify-center bg-white p-4 rounded-xl shadow-inner border min-h-[220px]">
                                        {!qrError ? (
                                            <img
                                                src={setupData.qrCodeUrl}
                                                alt="2FA QR Code"
                                                className="w-48 h-48"
                                                onError={() => setQrError(true)}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center text-center p-4">
                                                <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-2">
                                                    <ShieldAlert size={32} />
                                                </div>
                                                <p className="text-xs font-bold text-amber-800 uppercase">QR Generator Blocked</p>
                                                <p className="text-[10px] text-amber-700 leading-tight mt-1">
                                                    Your network is blocking the QR generator. Please use the <b>Setup Key</b> below instead.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Step 1: Scan QR Code</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {qrError ? "Since the image is blocked, manually add a new account in your app." : "Scan the image above with your authenticator app."}
                                        </p>

                                        <div className="pt-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-bold uppercase text-amber-600">Manual Setup Key</Label>
                                                {qrError && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1 rounded uppercase">Priority Fallback</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <code className="flex-1 p-2 bg-amber-50 border border-amber-100 text-amber-900 rounded font-mono text-sm break-all font-bold">
                                                    {setupData.secret}
                                                </code>
                                                <Button size="icon" variant="outline" onClick={copyToClipboard} className="border-amber-200 hover:bg-amber-100">
                                                    {hasCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={() => setStep('verify')} className="w-full">
                                        Next: Verify Code
                                    </Button>
                                </div>
                            )}

                            {step === 'verify' && (
                                <form onSubmit={handleVerifyToken} className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">Step 2: Enter 6-Digit Code</Label>
                                        <p className="text-xs text-muted-foreground">Enter the code displayed in your authenticator app.</p>
                                        <Input
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            className="text-center text-2xl tracking-[0.5em] font-black h-14"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button type="submit" className="w-full" disabled={isPending || verificationCode.length !== 6}>
                                            {isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                                            Verify & Enable
                                        </Button>
                                        <Button type="button" variant="ghost" className="text-xs" onClick={() => setStep('setup')}>
                                            Back to QR Code
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
