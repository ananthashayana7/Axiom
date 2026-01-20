'use client'

import React, { useTransition, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Settings as SettingsIcon, Globe, Loader2, Lock, Unlock } from "lucide-react";
import { updateSettings, getSettings } from "@/app/actions/settings";
import { toast } from "sonner";
// import { Switch } from "@/components/ui/switch"; // Removed unused component

export default function AdminSettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [settings, setSettings] = useState<any>(null);
    const [isLocked, setIsLocked] = useState(true);

    useEffect(() => {
        async function loadSettings() {
            const data = await getSettings();
            setSettings(data);
            setIsLocked(data.isSettingsLocked === 'yes');
        }
        loadSettings();
    }, []);

    async function handleSubmit(formData: FormData) {
        // If it's a switch, we need to manually add it if it's off, or handle its value
        // But here we'll just let the action handle it
        startTransition(async () => {
            const result = await updateSettings(formData);
            if (result.success) {
                toast.success("Settings updated successfully");
                const data = await getSettings();
                setSettings(data);
                setIsLocked(data.isSettingsLocked === 'yes');
            } else {
                toast.error(result.error || "Failed to update settings");
            }
        });
    }

    if (!settings) {
        return <div className="p-8 flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
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
                                <SettingsIcon className="h-5 w-5 text-primary" />
                                <CardTitle>General Configuration</CardTitle>
                            </div>
                            <CardDescription>Main system parameters and localization settings.</CardDescription>
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
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
                                    className="bg-background disabled:opacity-70"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="currency">Base Currency</Label>
                                <Input
                                    id="currency"
                                    name="currency"
                                    defaultValue={settings.defaultCurrency}
                                    disabled={isLocked}
                                    className="bg-background disabled:opacity-70"
                                />
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
                            <div className="grid gap-2 flex items-end">
                                <Button type="button" variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100">
                                    Flush Auth Cache
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-dashed">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-500" />
                            <CardTitle>AI & Data Benchmarks</CardTitle>
                        </div>
                        <CardDescription>Configure AI model parameters and market intelligence thresholds.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="benchmarkingInterval">Market Data Refresh (Days)</Label>
                                <Input id="benchmarkingInterval" name="benchmarkingInterval" type="number" defaultValue="7" className="bg-background" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="aiHighPickScore">AI "Top Pick" Threshold (%)</Label>
                                <Input id="aiHighPickScore" name="aiHighPickScore" type="number" defaultValue="85" className="bg-background" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-4">
                    <Button type="button" variant="ghost">Reset Defaults</Button>
                    <Button type="submit" disabled={isPending} className="min-w-[140px]">
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
