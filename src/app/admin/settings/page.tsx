'use client'

import React, { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Settings as SettingsIcon, Globe, Loader2 } from "lucide-react";
import { updateSettings } from "@/app/actions/settings";
import { toast } from "sonner";

export default function AdminSettingsPage() {
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const result = await updateSettings(formData);
            if (result.success) {
                toast.success("Settings updated successfully", {
                    description: "Global configuration has been refreshed."
                });
            } else {
                toast.error("Failed to update settings", {
                    description: result.error
                });
            }
        });
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
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <SettingsIcon className="h-5 w-5 text-primary" />
                            <CardTitle>General Configuration</CardTitle>
                        </div>
                        <CardDescription>Main system parameters and localization settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="siteName">Platform Name</Label>
                                <Input id="siteName" name="siteName" defaultValue="Axiom Procurement Intelligence" className="bg-background" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="currency">Base Currency</Label>
                                <Input id="currency" name="currency" defaultValue="INR (₹)" className="bg-background" />
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
                                <Input id="sessionTimeout" name="sessionTimeout" type="number" defaultValue="60" className="bg-background" />
                            </div>
                            <div className="grid gap-2 flex items-end">
                                <Button type="button" variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100">
                                    Flush Auth Cache
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
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
