import { db } from "@/db";
import { parts } from "@/db/schema";
import { sql, desc, asc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Warehouse,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Package,
    BarChart3,
    ArrowUpRight,
    CheckCircle2,
    Minus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

type SessionUser = { role?: string | null };

export default async function InventoryPage() {
    const session = await auth();
    const role = (session?.user as SessionUser | undefined)?.role;
    if (role === 'supplier') redirect('/portal');

    // Fetch all parts with stock data
    const allParts = await db.select().from(parts).orderBy(asc(parts.name));

    // Compute stats
    const totalSKUs = allParts.length;
    const totalUnits = allParts.reduce((sum, p) => sum + (p.stockLevel ?? 0), 0);
    const belowReorder = allParts.filter(p => (p.stockLevel ?? 0) < (p.reorderPoint ?? 50));
    const outOfStock = allParts.filter(p => (p.stockLevel ?? 0) === 0);
    const wellStocked = allParts.filter(p => (p.stockLevel ?? 0) >= (p.reorderPoint ?? 50));

    // ABC classification counts
    const abcCounts = allParts.reduce((acc, p) => {
        const cls = p.abcClassification ?? 'None';
        acc[cls] = (acc[cls] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Category breakdown
    const categoryMap = allParts.reduce((acc, p) => {
        acc[p.category] = (acc[p.category] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topCategories = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const stockHealthPct = totalSKUs > 0 ? Math.round((wellStocked.length / totalSKUs) * 100) : 0;

    function getStockStatus(part: typeof allParts[0]) {
        const stock = part.stockLevel ?? 0;
        const reorder = part.reorderPoint ?? 50;
        const min = part.minStockLevel ?? 20;
        if (stock === 0) return { label: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50', dot: 'bg-red-500' };
        if (stock < min) return { label: 'Critical', color: 'text-red-500', bg: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50', dot: 'bg-red-400' };
        if (stock < reorder) return { label: 'Low Stock', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50', dot: 'bg-amber-400' };
        return { label: 'In Stock', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/50', dot: 'bg-emerald-500' };
    }

    function getTrendIcon(trend: string | null) {
        if (trend === 'rising') return <TrendingUp className="h-3 w-3 text-red-500" />;
        if (trend === 'falling') return <TrendingDown className="h-3 w-3 text-emerald-500" />;
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }

    const abcColors: Record<string, string> = {
        A: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
        B: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
        C: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400',
        None: 'bg-muted text-muted-foreground border-border',
    };

    return (
        <div className="p-4 lg:p-8 space-y-8 bg-background min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                            <Warehouse className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-foreground">Inventory</h1>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Stock Levels & Parts Management</p>
                        </div>
                    </div>
                </div>
                <Link href="/sourcing/parts">
                    <Button size="sm" className="gap-2">
                        <Package className="h-4 w-4" />
                        Parts Catalog
                        <ArrowUpRight className="h-3 w-3" />
                    </Button>
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-primary shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Total SKUs</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight">{totalSKUs.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">{totalUnits.toLocaleString()} total units on hand</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Stock Health</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-emerald-600">{stockHealthPct}%</div>
                        <Progress value={stockHealthPct} className="mt-2 h-1.5" />
                        <p className="text-xs text-muted-foreground mt-1">{wellStocked.length} of {totalSKUs} SKUs above reorder point</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Reorder Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-amber-600">{belowReorder.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">SKUs below reorder threshold</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Out of Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tight text-red-600">{outOfStock.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">SKUs with zero inventory</p>
                    </CardContent>
                </Card>
            </div>

            {/* ABC Classification + Category Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wide">ABC Classification</CardTitle>
                        <CardDescription>Inventory value segmentation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {(['A', 'B', 'C', 'None'] as const).map((cls) => {
                            const count = abcCounts[cls] ?? 0;
                            const pct = totalSKUs > 0 ? Math.round((count / totalSKUs) * 100) : 0;
                            const labels: Record<string, string> = {
                                A: 'High-value items (top 20% by spend)',
                                B: 'Mid-value items (next 30% by spend)',
                                C: 'Low-value items (remaining 50%)',
                                None: 'Unclassified items',
                            };
                            return (
                                <div key={cls} className="flex items-center gap-3">
                                    <Badge className={cn("w-8 justify-center text-xs font-black border", abcColors[cls])}>{cls}</Badge>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">{labels[cls]}</span>
                                            <span className="font-bold">{count} SKUs ({pct}%)</span>
                                        </div>
                                        <Progress value={pct} className="h-1.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wide">Category Breakdown</CardTitle>
                        <CardDescription>Top categories by SKU count</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {topCategories.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No categories found</p>
                        ) : topCategories.map(([cat, count]) => {
                            const pct = totalSKUs > 0 ? Math.round((count / totalSKUs) * 100) : 0;
                            return (
                                <div key={cat} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium truncate">{cat}</span>
                                            <span className="font-bold text-muted-foreground">{count} ({pct}%)</span>
                                        </div>
                                        <Progress value={pct} className="h-1.5" />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Reorder Alerts Table */}
            {belowReorder.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800/50">
                    <CardHeader className="flex flex-row items-center gap-3">
                        <div className="h-8 w-8 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold">Reorder Required</CardTitle>
                            <CardDescription>{belowReorder.length} items need immediate attention</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60">
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">SKU</th>
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Part Name</th>
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Category</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">On Hand</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Reorder At</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Trend</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {belowReorder.slice(0, 20).map((part) => {
                                        const status = getStockStatus(part);
                                        return (
                                            <tr key={part.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{part.sku}</td>
                                                <td className="py-2.5 px-3 font-medium">{part.name}</td>
                                                <td className="py-2.5 px-3 text-muted-foreground text-xs">{part.category}</td>
                                                <td className="py-2.5 px-3 text-right font-bold tabular-nums">{(part.stockLevel ?? 0).toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{(part.reorderPoint ?? 50).toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="flex items-center justify-center gap-1">
                                                        {getTrendIcon(part.marketTrend)}
                                                        <span className="text-xs capitalize text-muted-foreground">{part.marketTrend ?? 'stable'}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border", status.bg)}>
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                                                        <span className={status.color}>{status.label}</span>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {belowReorder.length > 20 && (
                            <p className="text-xs text-muted-foreground text-center mt-3">
                                Showing 20 of {belowReorder.length} items. <Link href="/sourcing/parts" className="text-primary hover:underline font-medium">View all in Parts Catalog →</Link>
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Full Inventory Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Full Inventory
                    </CardTitle>
                    <CardDescription>All {totalSKUs} SKUs with current stock levels</CardDescription>
                </CardHeader>
                <CardContent>
                    {allParts.length === 0 ? (
                        <div className="py-12 text-center">
                            <Warehouse className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">No parts in inventory yet.</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">Add parts via the Parts Catalog to track stock levels.</p>
                            <Link href="/sourcing/parts" className="mt-4 inline-block">
                                <Button size="sm" variant="outline">Go to Parts Catalog</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/60">
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">SKU</th>
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Part Name</th>
                                        <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Category</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">ABC</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">On Hand</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Min Level</th>
                                        <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Reorder At</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Trend</th>
                                        <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allParts.map((part) => {
                                        const status = getStockStatus(part);
                                        const cls = part.abcClassification ?? 'None';
                                        return (
                                            <tr key={part.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{part.sku}</td>
                                                <td className="py-2.5 px-3 font-medium">{part.name}</td>
                                                <td className="py-2.5 px-3 text-muted-foreground text-xs">{part.category}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <Badge className={cn("text-[10px] font-black border w-6 justify-center", abcColors[cls])}>{cls}</Badge>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold tabular-nums">{(part.stockLevel ?? 0).toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{(part.minStockLevel ?? 20).toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{(part.reorderPoint ?? 50).toLocaleString()}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="flex items-center justify-center gap-1">
                                                        {getTrendIcon(part.marketTrend)}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border", status.bg)}>
                                                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                                                        <span className={status.color}>{status.label}</span>
                                                    </span>
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
