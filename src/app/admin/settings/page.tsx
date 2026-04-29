'use client'

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { flushAuthCache, getSettings, updateSettings } from "@/app/actions/settings";
import { ClearInventoryButton } from "@/components/admin/clear-inventory-button";
import { ResetDatabaseButton } from "@/components/admin/reset-database-button";
import { SeedDemoDataButton } from "@/components/admin/seed-demo-data-button";
import { TwoFactorSetup } from "@/components/admin/two-factor-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    AlertTriangle,
    Cpu,
    Loader2,
    Lock,
    Shield,
    ShieldCheck,
    Unlock,
} from "lucide-react";
import { toast } from "sonner";

type SettingsState = {
    role?: string;
    platformName?: string;
    isSettingsLocked?: string;
    isTwoFactorEnabled?: boolean;
    aiCredentialState?: {
        hasCredentials: boolean;
        databaseKeyCount: number;
        environmentKeyCount: number;
        totalKeyCount: number;
        source: string;
    };
};

export default function AdminSettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [settings, setSettings] = useState<SettingsState | null>(null);
    const [isLocked, setIsLocked] = useState(true);
    const [initialIsLocked, setInitialIsLocked] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);

    const loadSettings = useCallback(async () => {
        const data = await getSettings();
        if (data.role !== 'admin') {
            setAccessDenied(true);
            return;
        }

        setSettings(data);
        setIsLocked(data.isSettingsLocked === 'yes');
        setInitialIsLocked(data.isSettingsLocked === 'yes');
        setAccessDenied(false);
    }, []);

    useEffect(() => {
        queueMicrotask(() => {
            void loadSettings();
        });
    }, [loadSettings]);

    const isDirty = isLocked !== initialIsLocked;

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result = await updateSettings(formData);
            if (result.success) {
                toast.success("Security settings updated successfully.");
                await loadSettings();
            } else {
                toast.error(result.error || "Failed to update settings");
            }
        });
    }

    if (accessDenied) {
        return (
            <div className="p-4 lg:p-8 flex items-center justify-center h-screen">
                <div className="text-center space-y-2">
                    <Shield className="h-10 w-10 text-red-500 mx-auto" />
                    <p className="font-bold text-red-600 uppercase text-sm">Admin Access Required</p>
                    <p className="text-muted-foreground text-xs">Only administrators can access system settings.</p>
                </div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-4 lg:p-8 flex items-center justify-center h-screen">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    const aiCredentialState = settings.aiCredentialState ?? {
        hasCredentials: false,
        databaseKeyCount: 0,
        environmentKeyCount: 0,
        totalKeyCount: 0,
        source: "Not configured",
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Settings</h1>
                    <p className="text-muted-foreground mt-1">Secure configuration, recovery controls, and demo-environment maintenance.</p>
                </div>
            </div>

            <form action={handleSubmit} className="grid gap-6">
                <input type="hidden" name="platformName" value={settings.platformName || "Axiom Procurement Intelligence"} />

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-amber-600" />
                                <CardTitle>Configuration Guardrail</CardTitle>
                            </div>
                            <CardDescription>Prevent accidental changes during demos and executive reviews.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
                            <Label htmlFor="isSettingsLocked" className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                {isLocked ? <Lock size={14} className="text-red-500" /> : <Unlock size={14} className="text-green-500" />}
                                Settings Lock
                            </Label>
                            <input
                                type="checkbox"
                                id="isSettingsLocked"
                                name="isSettingsLocked"
                                checked={isLocked}
                                onChange={(event) => setIsLocked(event.target.checked)}
                                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            When the lock is enabled, operational settings stay frozen so the demo surface does not drift during handoffs or live presentations.
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-red-500" />
                            <CardTitle>Security & Access</CardTitle>
                        </div>
                        <CardDescription>Authentication policy and permission refresh controls.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="rounded-xl border bg-background/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Session Policy</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">30-minute server session window</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    Session duration is enforced server-side. This page shows the active policy but does not expose low-level auth configuration for editing in the browser.
                                </p>
                            </div>
                            <div className="rounded-xl border bg-background/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Two-Factor Authentication</p>
                                <div className="mt-3">
                                    <TwoFactorSetup
                                        isEnabled={!!settings.isTwoFactorEnabled}
                                        onStatusChange={(enabled) =>
                                            setSettings((previous) => previous ? { ...previous, isTwoFactorEnabled: enabled } : previous)
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Flush Authorization Cache
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 rounded-md p-3 border">
                                Revalidates server-rendered permission checks after role changes, 2FA updates, or access-policy fixes so the UI reflects the latest security posture immediately.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100"
                                onClick={async () => {
                                    const result = await flushAuthCache();
                                    if (result.success) {
                                        toast.success("Authorization cache flushed. Fresh role rules are now active.");
                                    } else {
                                        toast.error(result.error);
                                    }
                                }}
                            >
                                Flush Auth Cache
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Cpu className="h-5 w-5 text-amber-600" />
                            <CardTitle>AI Credential Status</CardTitle>
                        </div>
                        <CardDescription>Credential presence is visible, but raw keys never render in the browser.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={aiCredentialState.hasCredentials ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
                                {aiCredentialState.hasCredentials ? "AI Ready" : "AI Credentials Missing"}
                            </Badge>
                            <Badge variant="outline" className="border-stone-200 bg-stone-50 text-stone-700">
                                {aiCredentialState.totalKeyCount} credential source{aiCredentialState.totalKeyCount === 1 ? "" : "s"} detected
                            </Badge>
                            <Badge variant="outline" className="border-stone-200 bg-white text-stone-600">
                                {aiCredentialState.source}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-xl border bg-background/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Secure Storage</p>
                                <p className="mt-2 text-2xl font-black text-foreground">{aiCredentialState.databaseKeyCount}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Credential records stored server-side.</p>
                            </div>
                            <div className="rounded-xl border bg-background/80 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Environment Sources</p>
                                <p className="mt-2 text-2xl font-black text-foreground">{aiCredentialState.environmentKeyCount}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Server environment variables available to the runtime.</p>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Sensitive values are intentionally hidden. Provisioning and rotation should happen through secure server configuration, not through browser-visible admin forms.
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-red-500/20 bg-red-50/5">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            <CardTitle className="font-black uppercase tracking-tighter">System Maintenance</CardTitle>
                        </div>
                        <CardDescription>Reset demo data without losing admin access.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-red-700 uppercase tracking-tight">Workspace Cleanup</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Use this only when you need to strip demo data, stale AI outputs, and operational records from the environment before a fresh presentation run.
                                </p>
                            </div>
                            <div className="grid gap-3">
                                <SeedDemoDataButton />
                                <ClearInventoryButton />
                                <ResetDatabaseButton />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-4">
                    <Button type="button" variant="ghost" onClick={loadSettings}>Reset</Button>
                    <Button type="submit" disabled={isPending || !isDirty} className="min-w-[160px] bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 disabled:opacity-50">
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Applying...
                            </>
                        ) : (
                            "Apply Changes"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
