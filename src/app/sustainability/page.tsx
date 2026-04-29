import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Leaf,
    Wind,
    Factory,
    Globe,
    ShieldCheck,
    AlertTriangle,
    TrendingUp,
    Award,
    CheckCircle2,
    XCircle,
    HelpCircle,
} from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string | null };

export default async function SustainabilityPage() {
    const session = await auth();
    const role = (session?.user as SessionUser | undefined)?.role;
    if (role === 'supplier') redirect('/portal');

    const allSuppliers = await db.select().from(suppliers).orderBy(desc(suppliers.esgScore));

    // Aggregate carbon data
    const totalScope1 = allSuppliers.reduce((s, sup) => s + parseFloat(sup.carbonFootprintScope1 ?? '0'), 0);
    const totalScope2 = allSuppliers.reduce((s, sup) => s + parseFloat(sup.carbonFootprintScope2 ?? '0'), 0);
    const totalScope3 = allSuppliers.reduce((s, sup) => s + parseFloat(sup.carbonFootprintScope3 ?? '0'), 0);
    const totalCarbon = totalScope1 + totalScope2 + totalScope3;

    const avgEsg = allSuppliers.length > 0
        ? Math.round(allSuppliers.reduce((s, sup) => s + (sup.esgScore ?? 0), 0) / allSuppliers.length)
        : 0;
    const avgEnv = allSuppliers.length > 0
        ? Math.round(allSuppliers.reduce((s, sup) => s + (sup.esgEnvironmentScore ?? 0), 0) / allSuppliers.length)
        : 0;
    const avgSocial = allSuppliers.length > 0
        ? Math.round(allSuppliers.reduce((s, sup) => s + (sup.esgSocialScore ?? 0), 0) / allSuppliers.length)
        : 0;
    const avgGov = allSuppliers.length > 0
        ? Math.round(allSuppliers.reduce((s, sup) => s + (sup.esgGovernanceScore ?? 0), 0) / allSuppliers.length)
        : 0;
    const avgRenewableShare = allSuppliers.length > 0
        ? Math.round(allSuppliers.reduce((sum, sup) => sum + (sup.esgEnvironmentScore ?? 0), 0) / allSuppliers.length)
        : 0;

    const conflictCompliant = allSuppliers.filter(s => s.conflictMineralsStatus === 'compliant').length;
    const conflictNonCompliant = allSuppliers.filter(s => s.conflictMineralsStatus === 'non_compliant').length;
    const conflictUnknown = allSuppliers.filter(s => s.conflictMineralsStatus === 'unknown').length;

    const modernSlaveryYes = allSuppliers.filter(s => s.modernSlaveryStatement === 'yes').length;
    const isoCount = allSuppliers.filter(s => (s.isoCertifications?.length ?? 0) > 0).length;
    const lowCarbonSuppliers = allSuppliers
        .map((supplier) => ({
            id: supplier.id,
            name: supplier.name,
            esgEnvironmentScore: supplier.esgEnvironmentScore,
            totalCO2: parseFloat(supplier.carbonFootprintScope1 ?? '0')
                + parseFloat(supplier.carbonFootprintScope2 ?? '0')
                + parseFloat(supplier.carbonFootprintScope3 ?? '0'),
        }))
        .filter((supplier) => supplier.totalCO2 > 0)
        .sort((left, right) => left.totalCO2 - right.totalCO2)
        .slice(0, 5);

    function getEsgColor(score: number) {
        if (score >= 75) return 'text-emerald-600';
        if (score >= 50) return 'text-amber-600';
        return 'text-red-600';
    }

    function getConflictBadge(status: string | null) {
        if (status === 'compliant') return <span className="badge-success"><CheckCircle2 className="h-3 w-3" />Compliant</span>;
        if (status === 'non_compliant') return <span className="badge-danger"><XCircle className="h-3 w-3" />Non-Compliant</span>;
        return <span className="badge-warning"><HelpCircle className="h-3 w-3" />Unknown</span>;
    }

    return (
        <div className="p-4 lg:p-8 space-y-8 bg-background min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center border border-emerald-200 dark:border-emerald-800/50">
                        <Leaf className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">Sustainability & ESG</h1>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Carbon Footprint / ESG Scores / Compliance</p>
                    </div>
                </div>
                <Badge className="badge-success text-sm px-3 py-1">
                    <Leaf className="h-3.5 w-3.5" />
                    {allSuppliers.length} Suppliers Tracked
                </Badge>
            </div>

            {/* Carbon Footprint KPIs */}
            <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Wind className="h-3.5 w-3.5" /> Carbon Footprint (tCO2e)
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-slate-400 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Total Emissions</CardTitle>
                            <Factory className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tight">{totalCarbon.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground mt-1">tCO2e across all scopes</p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-400 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Scope 1 (Direct)</CardTitle>
                            <Factory className="h-4 w-4 text-red-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tight text-red-600">{totalScope1.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Direct supplier emissions</p>
                            {totalCarbon > 0 && (
                                <Progress value={(totalScope1 / totalCarbon) * 100} className="mt-2 h-1.5" />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-amber-400 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Scope 2 (Energy)</CardTitle>
                            <Wind className="h-4 w-4 text-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tight text-amber-600">{totalScope2.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Indirect energy emissions</p>
                            {totalCarbon > 0 && (
                                <Progress value={(totalScope2 / totalCarbon) * 100} className="mt-2 h-1.5" />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-blue-400 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Scope 3 (Value Chain)</CardTitle>
                            <Globe className="h-4 w-4 text-blue-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black tracking-tight text-blue-600">{totalScope3.toFixed(1)}</div>
                            <p className="text-xs text-muted-foreground mt-1">Value chain emissions</p>
                            {totalCarbon > 0 && (
                                <Progress value={(totalScope3 / totalCarbon) * 100} className="mt-2 h-1.5" />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ESG Score Overview */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                            <Award className="h-4 w-4 text-primary" />
                            Average ESG Scores
                        </CardTitle>
                        <CardDescription>Across {allSuppliers.length} suppliers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { label: 'Overall ESG', score: avgEsg, icon: Award, color: 'text-primary' },
                            { label: 'Environmental', score: avgEnv, icon: Leaf, color: 'text-emerald-600' },
                            { label: 'Social', score: avgSocial, icon: Globe, color: 'text-blue-600' },
                            { label: 'Governance', score: avgGov, icon: ShieldCheck, color: 'text-purple-600' },
                            { label: 'Renewable Share', score: avgRenewableShare, icon: Wind, color: 'text-emerald-600' },
                        ].map(({ label, score, icon: Icon, color }) => (
                            <div key={label} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Icon className={cn("h-3.5 w-3.5", color)} />
                                        {label}
                                    </span>
                                    <span className={cn("text-sm font-black tabular-nums", getEsgColor(score))}>
                                        {score}/100
                                    </span>
                                </div>
                                <Progress value={score} className="h-2" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Compliance Overview
                        </CardTitle>
                        <CardDescription>Conflict minerals, modern slavery & certifications</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
                                <div className="text-2xl font-black text-emerald-600">{conflictCompliant}</div>
                                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mt-0.5">Compliant</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                                <div className="text-2xl font-black text-amber-600">{conflictUnknown}</div>
                                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mt-0.5">Unknown</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                                <div className="text-2xl font-black text-red-600">{conflictNonCompliant}</div>
                                <div className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mt-0.5">Non-Compliant</div>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-center font-medium">Conflict Minerals Status (OECD/Dodd-Frank)</div>

                        <div className="pt-2 border-t border-border/60 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Modern Slavery Statements</span>
                                <span className="font-bold">{modernSlaveryYes} / {allSuppliers.length}</span>
                            </div>
                            <Progress value={allSuppliers.length > 0 ? (modernSlaveryYes / allSuppliers.length) * 100 : 0} className="h-1.5" />
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">ISO Certified Suppliers</span>
                                <span className="font-bold">{isoCount} / {allSuppliers.length}</span>
                            </div>
                            <Progress value={allSuppliers.length > 0 ? (isoCount / allSuppliers.length) * 100 : 0} className="h-1.5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-primary" />
                        Lowest Carbon Suppliers
                    </CardTitle>
                    <CardDescription>Fast shortlist for greener sourcing decisions.</CardDescription>
                </CardHeader>
                <CardContent>
                    {lowCarbonSuppliers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                            No supplier carbon disclosures have been captured yet.
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            {lowCarbonSuppliers.map((supplier) => (
                                <div key={supplier.id} className="rounded-2xl border bg-muted/20 p-4">
                                    <p className="font-semibold text-foreground">{supplier.name}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Renewable share {supplier.esgEnvironmentScore || 0}%
                                    </p>
                                    <p className="mt-4 text-2xl font-black text-emerald-600">{supplier.totalCO2.toFixed(1)}</p>
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">tCO2e total</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Supplier ESG Leaderboard */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Supplier ESG Leaderboard
                    </CardTitle>
                    <CardDescription>Ranked by overall ESG score - top {Math.min(allSuppliers.length, 25)} suppliers</CardDescription>
                </CardHeader>
                <CardContent>
                    {allSuppliers.length === 0 ? (
                        <div className="py-12 text-center">
                            <Leaf className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No supplier ESG data yet.</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">ESG scores are populated when suppliers are onboarded and audited.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60">
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground w-8">#</th>
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Supplier</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">ESG</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Env</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Renewables</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Social</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Gov</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Scope 1+2+3</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Conflict Minerals</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">ISO Certs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allSuppliers.slice(0, 25).map((sup, idx) => {
                                        const totalCO2 = parseFloat(sup.carbonFootprintScope1 ?? '0')
                                            + parseFloat(sup.carbonFootprintScope2 ?? '0')
                                            + parseFloat(sup.carbonFootprintScope3 ?? '0');
                                        return (
                                            <tr key={sup.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3 text-muted-foreground font-bold text-xs">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-semibold">{sup.name}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className={cn("font-black tabular-nums", getEsgColor(sup.esgScore ?? 0))}>
                                                        {sup.esgScore ?? 0}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-muted-foreground tabular-nums">{sup.esgEnvironmentScore ?? 0}</td>
                                                <td className="py-2.5 px-3 text-center text-muted-foreground tabular-nums">{sup.esgEnvironmentScore ?? 0}%</td>
                                                <td className="py-2.5 px-3 text-center text-muted-foreground tabular-nums">{sup.esgSocialScore ?? 0}</td>
                                                <td className="py-2.5 px-3 text-center text-muted-foreground tabular-nums">{sup.esgGovernanceScore ?? 0}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground">{totalCO2.toFixed(1)} tCO2e</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {getConflictBadge(sup.conflictMineralsStatus)}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {(sup.isoCertifications?.length ?? 0) > 0 ? (
                                                        <span className="badge-success">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {sup.isoCertifications!.length}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/50">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
