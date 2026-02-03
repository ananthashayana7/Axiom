import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    ShieldAlert,
    Globe,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    Activity,
    CloudRainCombined,
    CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { MitigationAction } from "@/components/admin/mitigation-action";
import { RiskIntelligenceView } from "@/components/admin/risk-intelligence-view";
import { GeoRiskMap } from "@/components/admin/geo-risk-map";
import { getRiskComplianceStats } from "@/app/actions/risk";
import { batchGeocodeSuppliers } from "@/app/actions/geocoding";
import { GeocodeTrigger } from "@/components/admin/geocode-trigger";

export const dynamic = 'force-dynamic';

export default async function RiskDashboardPage() {
    const stats = await getRiskComplianceStats();

    if (!stats) return <div className="p-8">Unable to load risk intelligence.</div>;

    const allSuppliers = await db.query.suppliers.findMany();
    const highRiskSuppliers = allSuppliers.filter((s: any) => (s.riskScore || 0) > 60);
    const lowESGSuppliers = allSuppliers.filter((s: any) => (s.esgScore || 0) < 40);
    const financialWatchlist = allSuppliers.filter((s: any) => (s.financialScore || 0) < 50);

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Risk & Compliance Intelligence</h1>
                    <p className="text-muted-foreground mt-1">Real-time monitoring of ESG, financial, and operational supply chain risks.</p>
                </div>
                <GeocodeTrigger />
            </div>

            <div className="w-full h-[400px] mb-8 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <GeoRiskMap
                    suppliers={allSuppliers
                        .filter(s => s.latitude && s.longitude)
                        .map(s => ({
                            id: s.id,
                            name: s.name,
                            latitude: parseFloat(s.latitude || "0"),
                            longitude: parseFloat(s.longitude || "0"),
                            riskScore: s.riskScore || 0
                        }))
                    }
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card className="border-red-200 bg-red-50/30 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Critical Risks</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{highRiskSuppliers.length}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-medium">
                            Requiring immediate attention
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/30 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Network Health Score</CardTitle>
                        <Activity className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{100 - stats.avgRisk}%</div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">Stable</p>
                    </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/30 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg ESG Performance</CardTitle>
                        <Globe className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-700">{stats.esgAvg}/100</div>
                        <p className="text-xs text-stone-500 mt-1">Portfolio ESG Target: 75+</p>
                    </CardContent>
                </Card>
                <Card className="border-stone-200 bg-stone-50/30 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
                        <Search className="h-4 w-4 text-stone-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-stone-900">{stats.esgAvg}%</div>
                        <p className="text-xs text-stone-500 mt-1 font-medium">Avg Portfolio ESG Score</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
                {/* ESG Monitoring */}
                <Card className="shadow-sm border-accent/20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2 text-stone-900">
                                    <Globe className="h-5 w-5 text-amber-600" />
                                    ESG Tracking (Sustainability)
                                </CardTitle>
                                <CardDescription>Monitoring environmental and social impact scores.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50/50">Active Monitoring</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {lowESGSuppliers.slice(0, 4).map((s: any) => (
                            <div key={s.id} className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <Link href={`/suppliers/${s.id}`} className="font-semibold hover:text-primary transition-colors">{s.name}</Link>
                                    <span className="text-red-500 font-bold">{s.esgScore}/100</span>
                                </div>
                                <Progress value={s.esgScore || 0} className="h-2 bg-muted transition-all [&>div]:bg-red-500" />
                                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    Environmental compliance verification active.
                                </p>
                            </div>
                        ))}
                        {lowESGSuppliers.length === 0 && (
                            <div className="py-10 text-center text-muted-foreground">
                                All suppliers meet ESG benchmarks.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Financial Health Monitoring */}
                <Card className="shadow-sm border-accent/20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Wallet className="h-5 w-5 text-purple-600" />
                                    Financial Health Watchlist
                                </CardTitle>
                                <CardDescription>Live credit monitoring and liquidity risk assessment.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-purple-600">Credit Active</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {financialWatchlist.slice(0, 5).map((s: any) => (
                            <div key={s.id} className="flex items-center justify-between p-4 rounded-xl border bg-background hover:bg-muted/50 transition-colors">
                                <div className="flex flex-col gap-1">
                                    <Link href={`/suppliers/${s.id}`} className="font-bold text-foreground hover:text-primary transition-colors">{s.name}</Link>
                                    <span className="text-xs text-muted-foreground">Financial Health: <strong>{
                                        s.financialScore > 80 ? 'Exceptional' :
                                            s.financialScore > 60 ? 'Strong' :
                                                s.financialScore > 40 ? 'Fair' : 'Distressed'
                                    }</strong></span>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <Badge variant="secondary" className={cn(
                                        "px-3 border-none",
                                        s.financialScore > 70 ? "bg-green-100 text-green-700" :
                                            s.financialScore > 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                    )}>
                                        Score: {s.financialScore}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                        Liquidity: {s.financialScore > 50 ? 'Stable' : 'Volatile'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* AI Risk Alerts Section */}
            <div className="mt-8">
                <Card className="bg-gradient-to-r from-background to-accent/5 border-primary/20">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <ShieldAlert className="h-6 w-6 text-primary" />
                                AI-Driven Risk Intelligence
                            </CardTitle>
                            <Badge className="bg-primary hover:bg-primary shadow-none">Active Analysis</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {highRiskSuppliers.slice(0, 3).map((s: any) => (
                            <RiskIntelligenceView key={s.id} supplier={s} />
                        ))}
                        {highRiskSuppliers.length === 0 && (
                            <div className="col-span-3 py-10 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-primary/20">
                                <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-2 opacity-50" />
                                <p className="font-medium">No critical risk disruptions detected in the active supplier network.</p>
                            </div>
                        )}
                        <div className="p-4 rounded-xl border bg-background/50 hover:shadow-md transition-all group">
                            <Badge variant="outline" className="text-orange-500 border-orange-200 mb-3 uppercase text-[10px]">Strategic Insight</Badge>
                            <h4 className="font-bold mb-2">Portfolio Diversification</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">Axiom detected {highRiskSuppliers.length} suppliers in high-risk zones. Recommendation: Review alternative source options.</p>
                            <Link href="/sourcing/rfqs" className="inline-flex items-center gap-1 text-xs text-primary font-bold mt-4 group-hover:underline">
                                Explore Sourcing <ArrowUpRight size={14} />
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
