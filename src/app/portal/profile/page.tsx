'use client'

import React, { useEffect, useState } from 'react';
import { getSupplierProfile, updateSupplierProfile } from "@/app/actions/portal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    User,
    Mail,
    MapPin,
    CheckCircle2,
    Shield,
    Globe,
    Zap,
    Save
} from "lucide-react";
import { toast } from "sonner";

export default function SupplierProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const p = await getSupplierProfile();
            setProfile(p);
            setLoading(false);
        }
        load();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const res = await updateSupplierProfile(formData);
        if (res.success) {
            toast.success("Profile updated successfully");
        } else {
            toast.error(res.error || "Update failed");
        }
    };

    if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Loading vendor credentials...</div>;
    if (!profile) return <div className="p-8">Unauthorized access to vendor profile.</div>;

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900">Enterprise Profile</h1>
                    <p className="text-muted-foreground mt-1">Manage your corporate credentials and compliance data on Axiom.</p>
                </div>
                <Badge className="bg-emerald-600 h-6 px-3">Verified Partner</Badge>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <form onSubmit={handleSubmit}>
                        <Card className="shadow-sm border-accent/20">
                            <CardHeader className="border-b border-border/50 bg-stone-50/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    General Information
                                </CardTitle>
                                <CardDescription>Update your contact and administrative details.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Legal Entity Name</Label>
                                        <Input id="name" value={profile.name} disabled className="bg-muted border-none font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactEmail">Contact Email (for RFQs)</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="contactEmail" name="contactEmail" defaultValue={profile.contactEmail} className="pl-10" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city">Headquarters City</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input id="city" name="city" defaultValue={profile.city} className="pl-10" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" className="gap-2 shadow-lg">
                                        <Save className="h-4 w-4" /> Save Profile Changes
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>

                    <Card className="shadow-sm border-accent/20">
                        <CardHeader className="bg-stone-50/50 border-b border-border/50">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-600" />
                                Sustainability & ESG Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid gap-8 md:grid-cols-3">
                                <div className="text-center p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Environment</span>
                                    <div className="text-3xl font-black text-emerald-700">{profile.esgEnvironmentScore || 0}%</div>
                                </div>
                                <div className="text-center p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                    <span className="text-[10px] text-blue-600 font-bold uppercase">Social</span>
                                    <div className="text-3xl font-black text-blue-700">{profile.esgSocialScore || 0}%</div>
                                </div>
                                <div className="text-center p-4 rounded-2xl bg-amber-50 border border-amber-100">
                                    <span className="text-[10px] text-amber-600 font-bold uppercase">Governance</span>
                                    <div className="text-3xl font-black text-amber-700">{profile.esgGovernanceScore || 0}%</div>
                                </div>
                            </div>
                            <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-4 rounded-xl border border-dashed">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ESG scores are verified annually based on your submitted audits. Next audit scheduled for Oct 2026.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="bg-stone-900 border-none text-white overflow-hidden relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent)]" />
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Globe className="h-5 w-5 text-emerald-400" />
                                Global Identity
                            </CardTitle>
                            <CardDescription className="text-stone-400">Public visibility of your geographic footprint.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-500">Tier Level</span>
                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 font-bold uppercase">
                                    {profile.tierLevel?.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-500">ISO Certifications</span>
                                <span className="text-stone-300 font-medium">8 Certified</span>
                            </div>
                            <div className="pt-4 mt-4 border-t border-stone-800">
                                <p className="text-xs text-stone-500 italic">
                                    Your geographic location is plotted on Axiom's Global Risk Control Tower to monitor logistics disruptions.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary fill-primary" />
                                Axiom Alpha Program
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                As a preferred partner, you have first access to Axiom's predictive replenishment forecasts.
                            </p>
                            <Button variant="link" className="p-0 h-auto text-xs font-bold text-primary hover:underline">
                                Review Forecasts →
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
