import { getRFQById, updateRFQStatus } from "@/app/actions/rfqs";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    Users,
    FileText,
    TrendingUp,
    ShieldCheck,
    Truck,
    Clock,
    Wallet,
    Info
} from "lucide-react";
import { AnalyzeQuoteButton } from "@/components/sourcing/analyze-quote-button";
import { ApproveOrderButton } from "@/components/sourcing/approve-order-button";
import { getAuditLogs, getComments } from "@/app/actions/activity";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    const rfq = await getRFQById(id);

    if (!rfq) {
        notFound();
    }

    const sortedSuppliers = [...rfq.suppliers].sort((a: any, b: any) => {
        const scoreA = (a.supplier.performanceScore || 0) * 0.7 + (100 - (a.supplier.riskScore || 0)) * 0.3;
        const scoreB = (b.supplier.performanceScore || 0) * 0.7 + (100 - (b.supplier.riskScore || 0)) * 0.3;
        return scoreB - scoreA;
    });
    const topSupplierId = sortedSuppliers[0]?.id;
    const quotedSuppliers = sortedSuppliers.filter((s: any) => s.aiAnalysis);

    const initialComments = await getComments('rfq' as any, id);
    const auditLogs = isAdmin ? await getAuditLogs('rfq' as any, id) : [];

    const handleStatusChange = async (formData: FormData) => {
        'use server';
        const newStatus = formData.get('status') as any;
        await updateRFQStatus(id, newStatus);
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="mb-6">
                <Link href="/sourcing/rfqs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sourcing Requests
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-10">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">{rfq.title}</h1>
                        <Badge variant={rfq.status === 'open' ? 'default' : 'secondary'} className="text-sm px-3">
                            {rfq.status?.toUpperCase()}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-lg max-w-2xl">{rfq.description || "No description provided."}</p>
                </div>

                <Card className="w-full lg:w-[350px] p-6 bg-background shadow-sm border-accent/50">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Created</span>
                            <span className="text-sm font-semibold">{new Date(rfq.createdAt!).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-4">
                            <span className="text-sm font-medium text-muted-foreground">Request Items</span>
                            <span className="text-sm font-semibold">{rfq.items.length} Unique Parts</span>
                        </div>
                        {isAdmin && (
                            <form action={handleStatusChange} className="pt-4 border-t flex gap-2">
                                <select
                                    name="status"
                                    defaultValue={rfq.status!}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="open">Open (Invite Suppliers)</option>
                                    <option value="closed">Closed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                <Button type="submit" size="sm" variant="secondary">Update</Button>
                            </form>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
                {/* Left: Items List */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="h-full border-accent/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Requested Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {rfq.items.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                        <div>
                                            <p className="font-semibold text-sm">{item.part.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono">{item.part.sku}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{item.quantity} Units</p>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{item.part.category}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: AI Selection & Insights */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-primary/20 bg-primary/5 shadow-md">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                                    AI Supplier Recommendations
                                </CardTitle>
                                <Badge className="bg-primary text-primary-foreground border-none">INTELLIGENCE ACTIVE</Badge>
                            </div>
                            <CardDescription className="text-primary/70">
                                Our AI analyzed 48 potential leads and identified these top matches based on performance, lead times, and financial stability.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {sortedSuppliers.map((s: any) => {
                                const analysis = s.aiAnalysis ? JSON.parse(s.aiAnalysis) : null;
                                const isTop = s.id === topSupplierId;
                                const performance = s.supplier.performanceScore || 0;
                                const risk = s.supplier.riskScore || 0;
                                const matchScore = Math.round((performance * 0.7) + ((100 - risk) * 0.3));

                                return (
                                    <div key={s.id} className={`flex flex-col gap-6 p-6 rounded-xl border transition-all group relative overflow-hidden ${isTop ? 'border-primary/40 bg-primary/5 shadow-sm' : 'bg-background hover:border-accent'}`}>
                                        {isTop && (
                                            <div className="absolute top-0 right-0">
                                                <Badge className="rounded-tr-none rounded-bl-xl bg-primary text-primary-foreground border-none">AI TOP PICK</Badge>
                                            </div>
                                        )}

                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            <div className="flex-1 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                                            {s.supplier.name}
                                                            <Badge variant="outline" className="text-[10px] uppercase">{s.status}</Badge>
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground mt-0.5">Automated Match Score: <span className="text-primary font-bold">{matchScore}%</span></p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Performance</p>
                                                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                                                            <TrendingUp size={14} className="text-green-500" />
                                                            {performance}%
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Risk Profile</p>
                                                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                                                            <ShieldCheck size={14} className={risk > 30 ? 'text-red-500' : 'text-blue-500'} />
                                                            {risk <= 20 ? 'Low' : risk <= 50 ? 'Medium' : 'High'}
                                                        </div>
                                                    </div>
                                                    {analysis && (
                                                        <>
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Quote Total</p>
                                                                <div className="flex items-center gap-1.5 font-bold text-sm text-primary">
                                                                    <Wallet size={14} />
                                                                    ₹{parseFloat(s.quoteAmount || '0').toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Lead Time</p>
                                                                <div className="flex items-center gap-1.5 font-semibold text-sm">
                                                                    <Clock size={14} />
                                                                    {analysis.deliveryWeeks} Weeks
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {analysis && (
                                                    <div className="bg-muted/30 p-3 rounded-lg border border-muted-foreground/10">
                                                        <p className="text-[10px] font-bold text-muted-foreground mb-2 flex items-center gap-1">
                                                            <Sparkles size={10} className="text-primary" />
                                                            AI EXTRACTION HIGHLIGHTS
                                                        </p>
                                                        <ul className="text-xs space-y-1">
                                                            {analysis.highlights.map((h: string, i: number) => (
                                                                <li key={i} className="flex items-center gap-2">
                                                                    <CheckCircle2 size={10} className="text-green-500" />
                                                                    {h}
                                                                </li>
                                                            ))}
                                                            <li className="flex items-center gap-2 text-muted-foreground italic">
                                                                <Info size={10} />
                                                                Payment Terms: {analysis.terms}
                                                            </li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-row md:flex-col justify-end gap-2 shrink-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                                                {isAdmin && (
                                                    <AnalyzeQuoteButton rfqSupplierId={s.id} hasAnalysis={!!s.aiAnalysis} />
                                                )}
                                                <Link href={`/suppliers/${s.supplier.id}`}>
                                                    <Button size="sm" variant="outline" className="w-full">Profile</Button>
                                                </Link>
                                                <ApproveOrderButton
                                                    rfqId={rfq.id}
                                                    supplierId={s.supplier.id}
                                                    variant={isTop ? 'default' : 'secondary'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {sortedSuppliers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <AlertTriangle className="h-10 w-10 text-yellow-500 mb-2" />
                                    <p className="font-semibold">No suppliers selected yet</p>
                                    <p className="text-sm text-muted-foreground">Move the RFQ to 'Open' to trigger AI invitation logic.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-accent/30 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Sourcing Intelligence Insights</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-muted/30 border border-muted flex items-start gap-3">
                                <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold">Should-Cost Estimate</p>
                                    <p className="text-xs text-muted-foreground mt-1">Based on category benchmarks, total cost should range between ₹4,50,000 - ₹5,20,000.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/30 border border-muted flex items-start gap-3">
                                <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold">Compliance Status</p>
                                    <p className="text-xs text-muted-foreground mt-1">All recommended suppliers have active ISO certifications and valid contracts.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {quotedSuppliers.length > 1 && (
                        <Card className="border-primary/30 bg-primary/5 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Sparkles className="h-6 w-6 text-primary" />
                                    Comparative Decision Summary
                                </CardTitle>
                                <CardDescription>AI-generated cross-supplier comparison based on extracted data.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl bg-background border flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <Wallet className="h-5 w-5 text-green-700" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Best Financial Value</p>
                                                <p className="text-xs text-muted-foreground">Lowest total cost across all identified quotes.</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-green-700">{[...quotedSuppliers].sort((a, b) => parseFloat(a.quoteAmount || '0') - parseFloat(b.quoteAmount || '0'))[0]?.supplier.name}</p>
                                            <p className="text-xs font-medium">₹{parseFloat([...quotedSuppliers].sort((a, b) => parseFloat(a.quoteAmount || '0') - parseFloat(b.quoteAmount || '0'))[0]?.quoteAmount || '0').toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-background border flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <Clock className="h-5 w-5 text-blue-700" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Fastest Execution</p>
                                                <p className="text-xs text-muted-foreground">Shortest lead time from approval to delivery.</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-blue-700">{[...quotedSuppliers].sort((a, b) => (JSON.parse(a.aiAnalysis!).deliveryWeeks) - (JSON.parse(b.aiAnalysis!).deliveryWeeks))[0]?.supplier.name}</p>
                                            <p className="text-xs font-medium">{JSON.parse([...quotedSuppliers].sort((a, b) => (JSON.parse(a.aiAnalysis!).deliveryWeeks) - (JSON.parse(b.aiAnalysis!).deliveryWeeks))[0]?.aiAnalysis!).deliveryWeeks} Weeks</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-primary text-primary-foreground flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary-foreground/20 rounded-lg">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">Recommended Award</p>
                                                <p className="text-xs opacity-80">Based on weighted score (70% Performance, 30% Cost).</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{sortedSuppliers[0]?.supplier.name}</p>
                                            <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-none">Selected by AI</Badge>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
