'use client'

import { useState } from "react";
import { registerSupplier } from "@/app/actions/supplier-registration";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Mail, Phone, Globe, MapPin, Shield, CheckCircle2, Loader2 } from "lucide-react";

const CATEGORY_OPTIONS = [
    'Electronics', 'Mechanical', 'Raw Materials', 'Chemicals', 'Packaging',
    'IT Services', 'Logistics', 'Consulting', 'Office Supplies', 'Industrial',
];

const CERT_OPTIONS = [
    'ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 27001', 'ISO 13485',
    'IATF 16949', 'AS9100', 'CE Marking', 'UL Listed', 'RoHS',
];

export default function SupplierRegistrationPage() {
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedCerts, setSelectedCerts] = useState<string[]>([]);

    const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
        setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const result = await registerSupplier({
            companyName: formData.get('companyName') as string,
            contactEmail: formData.get('contactEmail') as string,
            contactPhone: formData.get('contactPhone') as string || undefined,
            city: formData.get('city') as string || undefined,
            country: formData.get('country') as string || undefined,
            countryCode: formData.get('countryCode') as string || undefined,
            website: formData.get('website') as string || undefined,
            description: formData.get('description') as string || undefined,
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            certifications: selectedCerts.length > 0 ? selectedCerts : undefined,
        });

        setLoading(false);
        if (result.success) {
            setSubmitted(true);
        } else {
            setError(result.error || 'Registration failed');
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
                <Card className="w-full max-w-lg border-green-500/30 bg-green-500/5">
                    <CardContent className="p-12 text-center space-y-6">
                        <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold">Registration Submitted!</h2>
                        <p className="text-muted-foreground">
                            Thank you for registering. An Axiom administrator and onboarding workflow
                            will review your application and guide the next evidence requests.
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                            Typical review time: 1-2 business days
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
            <Card className="w-full max-w-2xl shadow-2xl border-accent/30">
                <CardHeader className="space-y-2 pb-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">Supplier Registration</CardTitle>
                            <p className="text-sm text-muted-foreground">Join the Axiom Procurement Network</p>
                        </div>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="p-6 space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Company Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="companyName" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Building2 className="h-3 w-3" /> Company Name *
                                </Label>
                                <Input id="companyName" name="companyName" placeholder="Acme Industries Ltd." required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactEmail" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Mail className="h-3 w-3" /> Contact Email *
                                </Label>
                                <Input id="contactEmail" name="contactEmail" type="email" placeholder="procurement@acme.com" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactPhone" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Phone className="h-3 w-3" /> Phone
                                </Label>
                                <Input id="contactPhone" name="contactPhone" placeholder="+1 555 0100" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <MapPin className="h-3 w-3" /> City
                                </Label>
                                <Input id="city" name="city" placeholder="Munich" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Globe className="h-3 w-3" /> Country
                                </Label>
                                <Input id="country" name="country" placeholder="Germany" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="countryCode" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Globe className="h-3 w-3" /> ISO Code
                                </Label>
                                <Input id="countryCode" name="countryCode" placeholder="DE" maxLength={2} className="uppercase" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="website" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Globe className="h-3 w-3" /> Website
                                </Label>
                                <Input id="website" name="website" type="url" placeholder="https://www.acme.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                    <Building2 className="h-3 w-3" /> Company Profile
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    placeholder="Describe your capabilities, production footprint, and what you supply."
                                    className="min-h-[102px]"
                                />
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold uppercase tracking-wider">Supply Categories</Label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_OPTIONS.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => toggleItem(selectedCategories, setSelectedCategories, cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                            selectedCategories.includes(cat)
                                                ? 'bg-primary/10 border-primary/40 text-primary'
                                                : 'bg-muted/30 border-border hover:border-primary/30 text-muted-foreground'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Certifications */}
                        <div className="space-y-3">
                            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                                <Shield className="h-3 w-3" /> Certifications
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {CERT_OPTIONS.map(cert => (
                                    <button
                                        key={cert}
                                        type="button"
                                        onClick={() => toggleItem(selectedCerts, setSelectedCerts, cert)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                            selectedCerts.includes(cert)
                                                ? 'bg-green-500/10 border-green-500/40 text-green-600'
                                                : 'bg-muted/30 border-border hover:border-green-500/30 text-muted-foreground'
                                        }`}
                                    >
                                        {cert}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="px-6 py-4 border-t bg-muted/10 flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                            Every submission opens an onboarding pack with workflow and compliance checks
                        </p>
                        <Button type="submit" disabled={loading} className="min-w-[140px]">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Registration'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
