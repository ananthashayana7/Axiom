'use client'

import React, { useTransition, useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Settings as SettingsIcon, Globe, Loader2, Lock, Unlock, AlertTriangle, Info, KeyRound } from "lucide-react";
import { updateSettings, getSettings, flushAuthCache } from "@/app/actions/settings";
import { toast } from "sonner";
import { ResetDatabaseButton } from "@/components/admin/reset-database-button";
import { TwoFactorSetup } from "@/components/admin/two-factor-setup";
import { redirect } from "next/navigation";

export default function AdminSettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [settings, setSettings] = useState<any>(null);
    const [isLocked, setIsLocked] = useState(true);
    const [initialSettings, setInitialSettings] = useState<any>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    const loadSettings = useCallback(async () => {
        const data = await getSettings();
        // If role came back as non-admin, deny access
        if (data.role !== 'admin') {
            setAccessDenied(true);
            return;
        }
        setSettings(data);
        setInitialSettings(data);
        setIsLocked(data.isSettingsLocked === 'yes');
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const isDirty = initialSettings && settings && (
        settings.platformName !== initialSettings.platformName ||
        (settings.geminiApiKey || '') !== (initialSettings.geminiApiKey || '') ||
        isLocked !== (initialSettings.isSettingsLocked === 'yes')
    );

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result = await updateSettings(formData);
            if (result.success) {
                toast.success("Settings updated successfully");
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
        return <div className="p-4 lg:p-8 flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Settings</h1>
                    <p className="text-muted-foreground mt-1">Configure global platform parameters and system preferences.</p>
                </div>
            </div>

            <form action={handleSubmit} className="grid gap-6">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <SettingsIcon className="h-5 w-5 text-amber-600" />
                                <CardTitle>General Configuration</CardTitle>
                            </div>
                            <CardDescription>Main system parameters and platform identity.</CardDescription>
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
                                onChange={(e) => setIsLocked(e.target.checked)}
                                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="siteName">Platform Name</Label>
                                <Input
                                    id="siteName"
                                    name="siteName"
                                    defaultValue={settings.platformName}
                                    disabled={isLocked}
                                    onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                                    className="bg-background disabled:opacity-70"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                    Currency
                                </Label>
                                <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                                    <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    <span>Auto-detected from user&apos;s locale / timezone — no manual override needed.</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-red-500" />
                            <CardTitle>Security & Access</CardTitle>
                        </div>
                        <CardDescription>Authentication rules and RBAC policies.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                                <Input id="sessionTimeout" name="sessionTimeout" type="number" defaultValue="30" className="bg-background" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Two-Factor Authentication (2FA)</Label>
                                <TwoFactorSetup
                                    isEnabled={settings.isTwoFactorEnabled}
                                    onStatusChange={(enabled) => setSettings((prev: any) => ({ ...prev, isTwoFactorEnabled: enabled }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Flush Authorization Cache
                                </Label>
                                <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 rounded-md p-2 border">
                                    <strong>What this does:</strong> Revalidates all server-rendered pages and clears any in-memory role/permission caches. Useful after updating user roles, enabling/disabling 2FA, or applying permission changes so they reflect immediately without waiting for cache expiry.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100"
                                    onClick={async () => {
                                        const result = await flushAuthCache();
                                        if (result.success) {
                                            toast.success("Authorization cache flushed — all pages will re-render with fresh permissions.");
                                        } else {
                                            toast.error(result.error);
                                        }
                                    }}
                                >
                                    Flush Auth Cache
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-amber-600" />
                            <CardTitle>AI Provider Configuration</CardTitle>
                        </div>
                        <CardDescription>Configure the Gemini API key used by Axiom Copilot and AI agents. Only you (admin) can view or change this key.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="geminiApiKey">Gemini API Key</Label>
                                <Input
                                    id="geminiApiKey"
                                    name="geminiApiKey"
                                    type="password"
                                    value={settings.geminiApiKey || ''}
                                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                                    placeholder="AIza..."
                                    className="bg-background"
                                    disabled={isLocked}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-red-500/20 bg-red-50/5">
                    <CardHeader>
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            <CardTitle className="font-black uppercase tracking-tighter">System Maintenance</CardTitle>
                        </div>
                        <CardDescription>Critical system utilities for administrative use only.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-red-700 uppercase tracking-tight">Warning: Data Purge</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Performing a database reset will wipe ALL procurement history, suppliers, and parts.
                                    Admin and user accounts are preserved. This is typically used during handover or environment migrations.
                                </p>
                            </div>
                            <div className="flex items-center">
                                <ResetDatabaseButton />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-4">
                    <Button type="button" variant="ghost" onClick={loadSettings}>Reset</Button>
                    <Button type="submit" disabled={isPending || !isDirty} className="min-w-[140px] bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 disabled:opacity-50">
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Settings"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
