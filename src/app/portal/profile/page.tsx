'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Factory, Globe, Leaf, Mail, MapPin, MessageSquare, Save, Scale, Shield, Wallet } from "lucide-react";
import { toast } from "sonner";

import { getSupplierProfile, updateSupplierProfile } from "@/app/actions/portal";
import { getComments } from "@/app/actions/activity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CommentsSection } from "@/components/shared/comments";

const CERTIFICATION_OPTIONS = [
    "ISO 9001",
    "ISO 14001",
    "ISO 27001",
    "ISO 45001",
    "ISO 50001",
    "ISO 44001",
    "IATF 16949",
];

export default function SupplierProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [threadComments, setThreadComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            const supplierProfile = await getSupplierProfile();
            setProfile(supplierProfile);
            if (supplierProfile?.id) {
                const thread = await getComments('supplier_message', supplierProfile.id);
                setThreadComments(thread);
            }
            setLoading(false);
        }

        void load();
    }, []);

    const categoriesCsv = useMemo(() => (profile?.categories || []).join(', '), [profile]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);

        try {
            const formData = new FormData(event.currentTarget);
            const result = await updateSupplierProfile(formData);

            if (!result.success) {
                toast.error(result.error || "Update failed");
                return;
            }

            const refreshedProfile = await getSupplierProfile();
            setProfile(refreshedProfile);
            toast.success("Supplier profile synced to the buyer workspace.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Loading supplier profile...</div>;
    if (!profile) return <div className="p-8">Unauthorized access to supplier profile.</div>;

    const recordedCertifications = Array.isArray(profile.isoCertifications) ? profile.isoCertifications : [];

    return (
        <div className="flex min-h-full flex-col gap-8 bg-muted/40 p-4 lg:p-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900">Supplier Master Profile</h1>
                    <p className="mt-1 text-muted-foreground">
                        Maintain the company record that procurement, operations, and admin teams see inside Axiom.
                    </p>
                </div>
                <Badge className="h-7 bg-emerald-600 px-3 text-white hover:bg-emerald-600">
                    Synced to Internal Workspace
                </Badge>
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <Card className="border-accent/20 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-stone-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Factory className="h-5 w-5 text-primary" />
                                Company Identity
                            </CardTitle>
                            <CardDescription>These details are reflected in buyer, admin, and sourcing views.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Legal Entity Name</Label>
                                <Input id="name" value={profile.name} disabled className="border-none bg-muted font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail">RFQ Contact Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="contactEmail" name="contactEmail" defaultValue={profile.contactEmail} className="pl-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Headquarters City</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="city" name="city" defaultValue={profile.city || ''} className="pl-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="countryCode">Country Code</Label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="countryCode"
                                        name="countryCode"
                                        defaultValue={profile.countryCode || ''}
                                        placeholder="IN"
                                        maxLength={2}
                                        className="pl-10 uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="categoriesCsv">What You Supply</Label>
                                <Input
                                    id="categoriesCsv"
                                    name="categoriesCsv"
                                    defaultValue={categoriesCsv}
                                    placeholder="Machining, Electronics, Logistics, Plastics"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter categories as a comma-separated list so internal buyers can filter and discover your company correctly.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-accent/20 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-stone-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Shield className="h-5 w-5 text-emerald-600" />
                                Compliance & Certifications
                            </CardTitle>
                            <CardDescription>Keep certifications and declarations current so approvals do not stall.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 p-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold">Recorded Certifications</Label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {CERTIFICATION_OPTIONS.map((certification) => (
                                        <label key={certification} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 text-sm">
                                            <input
                                                type="checkbox"
                                                name="iso"
                                                value={certification}
                                                defaultChecked={recordedCertifications.includes(certification)}
                                                className="rounded border-gray-300"
                                            />
                                            <span>{certification}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="customCertifications">Additional Certifications</Label>
                                <Input
                                    id="customCertifications"
                                    name="customCertifications"
                                    placeholder="ISO 22301, TISAX, RoHS"
                                />
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="financialHealthRating">Financial Health Rating</Label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="financialHealthRating"
                                            name="financialHealthRating"
                                            defaultValue={profile.financialHealthRating || ''}
                                            placeholder="A / BBB / Stable"
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="conflictMineralsStatus">Conflict Minerals Status</Label>
                                    <select
                                        id="conflictMineralsStatus"
                                        name="conflictMineralsStatus"
                                        defaultValue={profile.conflictMineralsStatus || 'unknown'}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="unknown">Unknown</option>
                                        <option value="compliant">Compliant</option>
                                        <option value="non_compliant">Non-compliant</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm">
                                    <span>Modern Slavery Statement Available</span>
                                    <input
                                        type="checkbox"
                                        name="modernSlaveryStatement"
                                        value="yes"
                                        defaultChecked={profile.modernSlaveryStatement === 'yes'}
                                        className="rounded border-gray-300"
                                    />
                                </label>
                                <label className="flex items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm">
                                    <span>Conflict Mineral Declaration Signed</span>
                                    <input
                                        type="checkbox"
                                        name="isConflictMineralCompliant"
                                        value="yes"
                                        defaultChecked={profile.isConflictMineralCompliant === 'yes'}
                                        className="rounded border-gray-300"
                                    />
                                </label>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-accent/20 shadow-sm">
                        <CardHeader className="border-b border-border/50 bg-stone-50/50">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Leaf className="h-5 w-5 text-emerald-600" />
                                Sustainability Declarations
                            </CardTitle>
                            <CardDescription>Capture the numbers procurement teams need for ESG and carbon reporting.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 p-6 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label htmlFor="renewableEnergyShare">Renewable Energy Share %</Label>
                                <Input
                                    id="renewableEnergyShare"
                                    name="renewableEnergyShare"
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="100"
                                    defaultValue={profile.esgEnvironmentScore || 0}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This feeds the sustainability scorecard internal buyers use for green sourcing comparisons.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="carbonFootprintScope1">Scope 1 tCO2e</Label>
                                <Input id="carbonFootprintScope1" name="carbonFootprintScope1" type="number" step="0.01" min="0" defaultValue={profile.carbonFootprintScope1 || '0'} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="carbonFootprintScope2">Scope 2 tCO2e</Label>
                                <Input id="carbonFootprintScope2" name="carbonFootprintScope2" type="number" step="0.01" min="0" defaultValue={profile.carbonFootprintScope2 || '0'} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="carbonFootprintScope3">Scope 3 tCO2e</Label>
                                <Input id="carbonFootprintScope3" name="carbonFootprintScope3" type="number" step="0.01" min="0" defaultValue={profile.carbonFootprintScope3 || '0'} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button type="submit" className="gap-2 shadow-lg" disabled={saving}>
                            <Save className="h-4 w-4" />
                            {saving ? "Saving..." : "Save Supplier Profile"}
                        </Button>
                    </div>
                </form>

                <div className="space-y-6">
                    <Card className="overflow-hidden border-none bg-stone-900 text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Scale className="h-5 w-5 text-emerald-400" />
                                Internal Visibility
                            </CardTitle>
                            <CardDescription className="text-stone-400">
                                Everything saved here appears in internal supplier records immediately.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-500">Recorded certifications</span>
                                <span className="font-semibold text-stone-100">{recordedCertifications.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-500">ESG score snapshot</span>
                                <span className="font-semibold text-stone-100">{profile.esgScore || 0}%</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-stone-500">Renewable energy share</span>
                                <span className="font-semibold text-stone-100">{profile.esgEnvironmentScore || 0}%</span>
                            </div>
                            <div className="rounded-xl border border-stone-800 bg-stone-950/40 p-3 text-xs text-stone-300">
                                Buyers use this profile to evaluate sourcing eligibility, compliance readiness, and risk posture.
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                Sync Checklist
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            <p>Keep the RFQ email current so sourcing invitations and order updates land with the right person.</p>
                            <p>Maintain certifications here before a bid goes live to avoid compliance blockers at award time.</p>
                            <p>Update categories whenever your manufacturing scope changes so internal teams can discover you accurately.</p>
                            <p>Record renewable share and carbon scopes so Axiom can benchmark you in the sustainability leaderboard and carbon-adjusted sourcing views.</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Current Record Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Categories</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(profile.categories || []).length > 0 ? (
                                        profile.categories.map((category: string) => (
                                            <Badge key={category} variant="outline">{category}</Badge>
                                        ))
                                    ) : (
                                        <span className="text-sm text-muted-foreground">No categories recorded yet.</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Certifications</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {recordedCertifications.length > 0 ? (
                                        recordedCertifications.map((certification: string) => (
                                            <Badge key={certification} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{certification}</Badge>
                                        ))
                                    ) : (
                                        <span className="text-sm text-muted-foreground">No certifications recorded yet.</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Sustainability Snapshot</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <Badge variant="outline">Renewables: {profile.esgEnvironmentScore || 0}%</Badge>
                                    <Badge variant="outline">Scope 1: {profile.carbonFootprintScope1 || 0} tCO2e</Badge>
                                    <Badge variant="outline">Scope 2: {profile.carbonFootprintScope2 || 0} tCO2e</Badge>
                                    <Badge variant="outline">Scope 3: {profile.carbonFootprintScope3 || 0} tCO2e</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {profile?.id && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                Procurement Inbox
                            </div>
                            <CommentsSection
                                entityType="supplier_message"
                                entityId={profile.id}
                                initialComments={threadComments}
                                title="Shared Supplier Thread"
                                placeholder="Reply to the buyer or share an update for the procurement team..."
                                buttonLabel="Send Reply"
                                emptyState="No procurement messages yet. When buyers contact you through Axiom, the conversation will appear here."
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
