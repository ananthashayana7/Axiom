'use client';

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowUpRight,
    BarChart3,
    Filter,
    Globe2,
    Loader,
    Pencil,
    Plus,
    Search,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
    addSupplier,
    calculateABCAnalysis,
    deleteSupplier,
    getSupplierWorkspaceRows,
    updateSupplier,
} from "@/app/actions/suppliers";
import { MessageSupplierButton } from "@/components/suppliers/message-supplier-button";
import { SupplierQuickViewDrawer } from "@/components/intelligence/supplier-quick-view-drawer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils/currency";

type WorkspaceRow = Awaited<ReturnType<typeof getSupplierWorkspaceRows>>[number];

type SupplierSection =
    | "classification"
    | "certificates"
    | "performance"
    | "potential"
    | "qualification"
    | "onboarded"
    | "suspended"
    | "risk"
    | "watchlist"
    | "incidents";

const SECTION_GROUPS: Array<{
    title: string;
    items: Array<{ id: SupplierSection; label: string; description: string }>;
}> = [
    {
        title: "General Overviews",
        items: [
            { id: "classification", label: "Classification", description: "Volume, ABC, and trust posture." },
            { id: "certificates", label: "Certificates & Documents", description: "Compliance coverage and record quality." },
            { id: "performance", label: "Performance", description: "OTIF, quality, and active order load." },
        ],
    },
    {
        title: "Onboarding",
        items: [
            { id: "potential", label: "Potential Suppliers", description: "Prospects not yet qualified." },
            { id: "qualification", label: "In Qualification", description: "Suppliers in onboarding flow." },
            { id: "onboarded", label: "Onboarded Suppliers", description: "Approved network ready to transact." },
            { id: "suspended", label: "Suspended / Rejected", description: "Stopped or rejected relationships." },
        ],
    },
    {
        title: "Risk & ESG",
        items: [
            { id: "risk", label: "Risk Development", description: "Operational and financial exposure." },
            { id: "watchlist", label: "Suspicious Suppliers", description: "High-risk or low-trust suppliers." },
            { id: "incidents", label: "Public Incidents", description: "Suppliers above critical risk threshold." },
        ],
    },
];

function applySection(rows: WorkspaceRow[], section: SupplierSection) {
    const copy = [...rows];

    switch (section) {
        case "classification":
            return copy.sort((left, right) => right.currentYearVolume - left.currentYearVolume);
        case "certificates":
            return copy.sort((left, right) => right.complianceCoverage - left.complianceCoverage);
        case "performance":
            return copy.sort((left, right) => right.performanceScore - left.performanceScore);
        case "potential":
            return copy.filter((row) => row.lifecycleStatus === "prospect");
        case "qualification":
            return copy.filter((row) => row.lifecycleStatus === "onboarding");
        case "onboarded":
            return copy.filter((row) => row.lifecycleStatus === "active" && row.status === "active");
        case "suspended":
            return copy.filter((row) => ["suspended", "terminated"].includes(row.lifecycleStatus) || row.status !== "active");
        case "risk":
            return copy.sort((left, right) => right.riskScore - left.riskScore);
        case "watchlist":
            return copy.filter((row) => row.riskScore >= 60 || row.trustScore < 55);
        case "incidents":
            return copy.filter((row) => row.riskScore >= 75);
        default:
            return copy;
    }
}

function getSectionCount(rows: WorkspaceRow[], section: SupplierSection) {
    return applySection(rows, section).length;
}

function countryLabel(countryCode: string | null) {
    if (!countryCode) return "Unassigned";
    try {
        const display = new Intl.DisplayNames(["en"], { type: "region" });
        return display.of(countryCode) || countryCode;
    } catch {
        return countryCode;
    }
}

function flagEmoji(countryCode: string | null) {
    const normalized = countryCode?.toUpperCase();
    if (!normalized || !/^[A-Z]{2}$/.test(normalized)) {
        return "🌐";
    }

    return String.fromCodePoint(...normalized.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function lifecycleBadgeClass(lifecycleStatus: string) {
    switch (lifecycleStatus) {
        case "active":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "onboarding":
            return "border-blue-200 bg-blue-50 text-blue-700";
        case "suspended":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "terminated":
            return "border-rose-200 bg-rose-50 text-rose-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
}

function abcBadgeClass(value: string) {
    switch (value) {
        case "A":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "B":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "C":
            return "border-blue-200 bg-blue-50 text-blue-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-600";
    }
}

export function SuppliersWorkspace({
    initialRows,
    canManage,
}: {
    initialRows: WorkspaceRow[];
    canManage: boolean;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supplierParam = searchParams.get("supplier");

    const [rows, setRows] = useState<WorkspaceRow[]>(initialRows);
    const [section, setSection] = useState<SupplierSection>("classification");
    const [search, setSearch] = useState("");
    const [countryFilter, setCountryFilter] = useState("all");
    const [attentionFilter, setAttentionFilter] = useState("all");
    const [openDialog, setOpenDialog] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<WorkspaceRow | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<WorkspaceRow | null>(null);
    const [isPending, startTransition] = useTransition();

    const setSupplierDrawer = (supplierId: string | null) => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (supplierId) {
            nextParams.set("supplier", supplierId);
        } else {
            nextParams.delete("supplier");
        }
        const query = nextParams.toString();
        router.replace(query ? `/suppliers?${query}` : "/suppliers", { scroll: false });
    };

    const reloadRows = async () => {
        const nextRows = await getSupplierWorkspaceRows();
        setRows(nextRows);
    };

    const visibleSectionRows = useMemo(() => applySection(rows, section), [rows, section]);

    const countryOptions = useMemo(() => {
        const countries = Array.from(new Set(rows.map((row) => row.countryCode).filter(Boolean))) as string[];
        return countries.sort();
    }, [rows]);

    const filteredRows = useMemo(() => {
        return visibleSectionRows.filter((row) => {
            const query = search.trim().toLowerCase();
            const matchesSearch = !query
                || row.name.toLowerCase().includes(query)
                || row.contactEmail.toLowerCase().includes(query)
                || row.supplierCode.toLowerCase().includes(query)
                || row.categories.some((category: string) => category.toLowerCase().includes(query));

            const matchesCountry = countryFilter === "all" || row.countryCode === countryFilter;

            const matchesAttention = attentionFilter === "all"
                || (attentionFilter === "high_risk" && row.riskScore >= 60)
                || (attentionFilter === "compliance_gap" && row.complianceCoverage < 55)
                || (attentionFilter === "onboarding" && ["prospect", "onboarding"].includes(row.lifecycleStatus))
                || (attentionFilter === "low_trust" && row.trustScore < 55);

            return matchesSearch && matchesCountry && matchesAttention;
        });
    }, [attentionFilter, countryFilter, search, visibleSectionRows]);

    const metrics = useMemo(() => {
        const totalCurrentVolume = filteredRows.reduce((sum, row) => sum + row.currentYearVolume, 0);
        const onboardingCount = rows.filter((row) => ["prospect", "onboarding"].includes(row.lifecycleStatus)).length;
        const highRiskCount = rows.filter((row) => row.riskScore >= 60).length;
        const complianceGapCount = rows.filter((row) => row.complianceCoverage < 55).length;

        return {
            totalCurrentVolume,
            onboardingCount,
            highRiskCount,
            complianceGapCount,
        };
    }, [filteredRows, rows]);

    const handleSaveSupplier = async (formData: FormData) => {
        startTransition(async () => {
            let result;
            if (selectedSupplier) {
                const isoCertifications = Array.from(new Set([
                    ...formData.getAll("iso").map((value) => String(value).trim()).filter(Boolean),
                    ...String(formData.get("customCertifications") || "")
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                ]));

                result = await updateSupplier(selectedSupplier.id, {
                    name: String(formData.get("name") || ""),
                    contactEmail: String(formData.get("email") || ""),
                    countryCode: String(formData.get("countryCode") || ""),
                    city: String(formData.get("city") || ""),
                    latitude: Number.parseFloat(String(formData.get("latitude") || "")),
                    longitude: Number.parseFloat(String(formData.get("longitude") || "")),
                    riskScore: Number.parseInt(String(formData.get("risk") || "0"), 10) || 0,
                    performanceScore: Number.parseInt(String(formData.get("performance") || "0"), 10) || 0,
                    esgScore: Number.parseInt(String(formData.get("esg") || "0"), 10) || 0,
                    financialScore: Number.parseInt(String(formData.get("financial") || "0"), 10) || 0,
                    lifecycleStatus: formData.get("lifecycleStatus") as "prospect" | "onboarding" | "active" | "suspended" | "terminated",
                    status: formData.get("status") as "active" | "inactive" | "blacklisted",
                    abcClassification: formData.get("abcClassification") as "A" | "B" | "C" | "None",
                    tierLevel: formData.get("tier") as "tier_1" | "tier_2" | "tier_3" | "critical",
                    isoCertifications,
                    modernSlaveryStatement: formData.get("modern_slavery") === "on" ? "yes" : "no",
                    esgEnvironmentScore: Number.parseInt(String(formData.get("esg_env") || "0"), 10) || 0,
                    esgSocialScore: Number.parseInt(String(formData.get("esg_soc") || "0"), 10) || 0,
                    esgGovernanceScore: Number.parseInt(String(formData.get("esg_gov") || "0"), 10) || 0,
                    financialHealthRating: String(formData.get("financialHealthRating") || "Reviewed"),
                });
            } else {
                result = await addSupplier(formData);
            }

            if (result.success) {
                toast.success(selectedSupplier ? "Supplier updated" : "Supplier added");
                setOpenDialog(false);
                setSelectedSupplier(null);
                await reloadRows();
            } else {
                toast.error(result.error || "Failed to save supplier");
            }
        });
    };

    const handleDeleteSupplier = async () => {
        if (!supplierToDelete) return;

        startTransition(async () => {
            const result = await deleteSupplier(supplierToDelete.id);
            if (result.success) {
                toast.success("Supplier deleted");
                setDeleteOpen(false);
                setSupplierToDelete(null);
                await reloadRows();
            } else {
                toast.error(result.error || "Failed to delete supplier");
            }
        });
    };

    const handleRunAbc = async () => {
        startTransition(async () => {
            const result = await calculateABCAnalysis();
            if (result.success) {
                toast.success("ABC analysis refreshed");
                await reloadRows();
            } else {
                toast.error(("error" in result ? result.error : undefined) || "Failed to refresh ABC analysis");
            }
        });
    };

    return (
        <div className="min-h-full bg-background p-4 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950">Supplier Workspace</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Classification, onboarding, compliance coverage, and supplier risk in one operating view.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {canManage ? (
                        <Button variant="outline" className="gap-2" onClick={handleRunAbc} disabled={isPending}>
                            {isPending ? <Loader className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                            Refresh ABC
                        </Button>
                    ) : null}
                    <Link href="/admin/ecosystem">
                        <Button variant="outline" className="gap-2">
                            Open Ecosystem
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    {canManage ? (
                        <Dialog open={openDialog} onOpenChange={(nextOpen) => {
                            if (!nextOpen) {
                                setSelectedSupplier(null);
                            }
                            setOpenDialog(nextOpen);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="gap-2" onClick={() => setSelectedSupplier(null)}>
                                    <Plus className="h-4 w-4" />
                                    Add new
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>{selectedSupplier ? "Edit supplier" : "Add new supplier"}</DialogTitle>
                                    <DialogDescription>
                                        Capture the commercial, compliance, and risk profile that should follow this supplier into sourcing and finance.
                                    </DialogDescription>
                                </DialogHeader>
                                <form action={handleSaveSupplier} className="grid gap-4 py-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Company name</Label>
                                            <Input id="name" name="name" defaultValue={selectedSupplier?.name} required />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Contact email</Label>
                                            <Input id="email" name="email" type="email" defaultValue={selectedSupplier?.contactEmail} required />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="countryCode">Country</Label>
                                            <Input id="countryCode" name="countryCode" maxLength={2} defaultValue={selectedSupplier?.countryCode || ""} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="city">City / region</Label>
                                            <Input id="city" name="city" defaultValue={selectedSupplier?.city || ""} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="latitude">Latitude</Label>
                                            <Input id="latitude" name="latitude" type="number" step="0.0000001" defaultValue="" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="longitude">Longitude</Label>
                                            <Input id="longitude" name="longitude" type="number" step="0.0000001" defaultValue="" />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="risk">Risk score</Label>
                                            <Input id="risk" name="risk" type="number" min="0" max="100" defaultValue={selectedSupplier?.riskScore ?? 15} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="performance">Performance</Label>
                                            <Input id="performance" name="performance" type="number" min="0" max="100" defaultValue={selectedSupplier?.performanceScore ?? 80} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="financial">Financial</Label>
                                            <Input id="financial" name="financial" type="number" min="0" max="100" defaultValue={selectedSupplier?.financialScore ?? 70} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="esg">ESG</Label>
                                            <Input id="esg" name="esg" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgScore ?? 70} />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="tier">Tier</Label>
                                            <select id="tier" name="tier" defaultValue={selectedSupplier?.tierLevel ?? "tier_3"} className="h-10 rounded-md border bg-background px-3 text-sm">
                                                <option value="tier_1">Tier 1</option>
                                                <option value="tier_2">Tier 2</option>
                                                <option value="tier_3">Tier 3</option>
                                                <option value="critical">Critical</option>
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="lifecycleStatus">Lifecycle</Label>
                                            <select id="lifecycleStatus" name="lifecycleStatus" defaultValue={selectedSupplier?.lifecycleStatus ?? "prospect"} className="h-10 rounded-md border bg-background px-3 text-sm">
                                                <option value="prospect">Prospect</option>
                                                <option value="onboarding">Onboarding</option>
                                                <option value="active">Active</option>
                                                <option value="suspended">Suspended</option>
                                                <option value="terminated">Terminated</option>
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="status">Status</Label>
                                            <select id="status" name="status" defaultValue={selectedSupplier?.status ?? "active"} className="h-10 rounded-md border bg-background px-3 text-sm">
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="blacklisted">Blacklisted</option>
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="abcClassification">ABC class</Label>
                                            <select id="abcClassification" name="abcClassification" defaultValue={selectedSupplier?.abcClassification ?? "None"} className="h-10 rounded-md border bg-background px-3 text-sm">
                                                <option value="None">None</option>
                                                <option value="A">A</option>
                                                <option value="B">B</option>
                                                <option value="C">C</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="esg_env">ESG: Environment</Label>
                                            <Input id="esg_env" name="esg_env" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgScore ?? 70} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="esg_soc">ESG: Social</Label>
                                            <Input id="esg_soc" name="esg_soc" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgScore ?? 70} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="esg_gov">ESG: Governance</Label>
                                            <Input id="esg_gov" name="esg_gov" type="number" min="0" max="100" defaultValue={selectedSupplier?.esgScore ?? 70} />
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        <Label className="text-sm font-semibold">Compliance and certifications</Label>
                                        <div className="grid gap-2 md:grid-cols-3">
                                            {["ISO 9001", "ISO 14001", "ISO 27001", "ISO 45001", "IATF 16949", "REACH"].map((certification) => (
                                                <label key={certification} className="flex items-center gap-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        name="iso"
                                                        value={certification}
                                                        defaultChecked={selectedSupplier?.isoCertifications?.includes(certification)}
                                                    />
                                                    {certification}
                                                </label>
                                            ))}
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" name="modern_slavery" defaultChecked={selectedSupplier?.modernSlaveryStatement === "yes"} />
                                                Modern slavery statement
                                            </label>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="customCertifications">Additional certifications</Label>
                                            <Input id="customCertifications" name="customCertifications" placeholder="RoHS, TISAX, ISO 50001" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="financialHealthRating">Financial health note</Label>
                                            <Input id="financialHealthRating" name="financialHealthRating" defaultValue="Reviewed" />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={isPending}>
                                            {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            {selectedSupplier ? "Update supplier" : "Onboard supplier"}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    {SECTION_GROUPS.map((group) => (
                        <div key={group.title} className="mb-5 last:mb-0">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const active = item.id === section;
                                    const count = getSectionCount(rows, item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSection(item.id)}
                                            className={`w-full rounded-2xl px-3 py-3 text-left transition-all ${
                                                active
                                                    ? "bg-slate-900 text-white shadow-lg"
                                                    : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className={`text-sm font-bold ${active ? "text-white" : "text-slate-900"}`}>{item.label}</p>
                                                    <p className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{item.description}</p>
                                                </div>
                                                <Badge variant="outline" className={active ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-700"}>
                                                    {count}
                                                </Badge>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </aside>

                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-black uppercase tracking-[0.18em]">Current year volume</CardDescription>
                                <CardTitle className="text-3xl font-black">{formatCurrency(metrics.totalCurrentVolume)}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-500">Live order value in the current filtered workspace.</p>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-black uppercase tracking-[0.18em]">Onboarding queue</CardDescription>
                                <CardTitle className="text-3xl font-black text-blue-700">{metrics.onboardingCount}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-500">Suppliers still moving through qualification and onboarding.</p>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-black uppercase tracking-[0.18em]">High-risk watchlist</CardDescription>
                                <CardTitle className="text-3xl font-black text-rose-700">{metrics.highRiskCount}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-500">Suppliers currently above the intervention threshold.</p>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-black uppercase tracking-[0.18em]">Compliance gaps</CardDescription>
                                <CardTitle className="text-3xl font-black text-amber-700">{metrics.complianceGapCount}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-500">Suppliers with thin certification or control coverage.</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <CardTitle className="text-xl font-black tracking-tight text-slate-950">
                                        Supplier control table
                                    </CardTitle>
                                    <CardDescription>
                                        Filter by lifecycle, risk, geography, and compliance without leaving the supplier workspace.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                        {filteredRows.length} rows
                                    </Badge>
                                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                        8 columns live
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px_220px_auto]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search supplier, email, code, or category..."
                                        className="pl-9"
                                    />
                                </div>
                                <div className="relative">
                                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={countryFilter}
                                        onChange={(event) => setCountryFilter(event.target.value)}
                                        className="h-10 w-full appearance-none rounded-md border bg-background pl-9 pr-3 text-sm"
                                    >
                                        <option value="all">All countries</option>
                                        {countryOptions.map((countryCode) => (
                                            <option key={countryCode} value={countryCode}>
                                                {countryLabel(countryCode)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative">
                                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <select
                                        value={attentionFilter}
                                        onChange={(event) => setAttentionFilter(event.target.value)}
                                        className="h-10 w-full appearance-none rounded-md border bg-background pl-9 pr-3 text-sm"
                                    >
                                        <option value="all">All views</option>
                                        <option value="high_risk">High risk</option>
                                        <option value="compliance_gap">Compliance gaps</option>
                                        <option value="onboarding">Onboarding</option>
                                        <option value="low_trust">Low trust</option>
                                    </select>
                                </div>
                                <Button variant="outline" onClick={() => {
                                    setSearch("");
                                    setCountryFilter("all");
                                    setAttentionFilter("all");
                                }}>
                                    Reset
                                </Button>
                            </div>

                            <div className="overflow-hidden rounded-2xl border">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1120px] text-sm">
                                        <thead className="bg-slate-50">
                                            <tr className="border-b">
                                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Supplier</th>
                                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Country</th>
                                                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-500">Order volume {new Date().getUTCFullYear()}</th>
                                                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-500">Order volume {new Date().getUTCFullYear() - 1}</th>
                                                <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500">ABC</th>
                                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Trust & compliance</th>
                                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">Lifecycle</th>
                                                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-[0.18em] text-slate-500">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRows.map((row) => (
                                                <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50/70">
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="space-y-1">
                                                            <button
                                                                type="button"
                                                                className="text-left text-sm font-bold text-slate-950 transition-colors hover:text-primary"
                                                                onClick={() => setSupplierDrawer(row.id)}
                                                            >
                                                                {row.name}
                                                            </button>
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                <span>{row.supplierCode}</span>
                                                                <span>•</span>
                                                                <span>{row.contactEmail}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{flagEmoji(row.countryCode)}</span>
                                                            <div>
                                                                <p className="font-medium text-slate-900">{countryLabel(row.countryCode)}</p>
                                                                <p className="text-xs text-slate-500">{row.city || "Region pending"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right align-top font-semibold text-slate-900">
                                                        {formatCurrency(row.currentYearVolume)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right align-top text-slate-500">
                                                        {formatCurrency(row.previousYearVolume)}
                                                    </td>
                                                    <td className="px-4 py-4 text-center align-top">
                                                        <Badge variant="outline" className={abcBadgeClass(row.abcClassification)}>
                                                            {row.abcClassification}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="font-semibold text-slate-700">Trust {row.trustScore}</span>
                                                                <span className="text-slate-500">Coverage {row.complianceCoverage}%</span>
                                                            </div>
                                                            <Progress value={row.complianceCoverage} className="h-1.5" />
                                                            <div className="flex flex-wrap gap-1">
                                                                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                                                    Risk {row.riskScore}
                                                                </Badge>
                                                                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                                                    Perf {row.performanceScore}
                                                                </Badge>
                                                                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                                                    Docs {row.documentCount}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="space-y-2">
                                                            <Badge variant="outline" className={lifecycleBadgeClass(row.lifecycleStatus)}>
                                                                {row.lifecycleStatus.replace("_", " ")}
                                                            </Badge>
                                                            <div className="text-xs text-slate-500">
                                                                {row.activeOrders} active orders • {row.quotedRfqs} quoted RFQs
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="flex justify-end gap-2">
                                                            <MessageSupplierButton
                                                                supplierId={row.id}
                                                                supplierName={row.name}
                                                                supplierEmail={row.contactEmail}
                                                                iconOnly
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                            />
                                                            <Button variant="outline" size="sm" onClick={() => setSupplierDrawer(row.id)}>
                                                                Quick view
                                                            </Button>
                                                            <Link href={`/suppliers/${row.id}`}>
                                                                <Button variant="ghost" size="sm">Profile</Button>
                                                            </Link>
                                                            {canManage ? (
                                                                <>
                                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                                        setSelectedSupplier(row);
                                                                        setOpenDialog(true);
                                                                    }}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => {
                                                                        setSupplierToDelete(row);
                                                                        setDeleteOpen(true);
                                                                    }}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-12 text-center">
                                                        <p className="text-base font-semibold text-slate-900">No suppliers match this view.</p>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            Adjust the workspace section or clear filters to broaden the supplier set.
                                                        </p>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <SupplierQuickViewDrawer supplierId={supplierParam} open={Boolean(supplierParam)} onOpenChange={(open) => {
                if (!open) setSupplierDrawer(null);
            }} />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {supplierToDelete?.name || "this supplier"} only if there are no active commercial dependencies left in orders or RFQs.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(event) => {
                            event.preventDefault();
                            void handleDeleteSupplier();
                        }} disabled={isPending} className="bg-rose-600 hover:bg-rose-700">
                            {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
