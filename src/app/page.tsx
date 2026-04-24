import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, ArrowUpRight, Boxes, CreditCard, IndianRupee, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { DataExplorer } from "@/components/dashboard/data-explorer";
import { InsightInfographics } from "@/components/dashboard/insight-infographics";
import { RecentProcurements } from "@/components/dashboard/recent-procurements";
import { getDashboardStats, getRecentOrders, getMonthlySpend, getCategorySpend, getHighRiskSuppliers, getSupplierAnalytics } from "@/app/actions/dashboard";
import { getSuppliers } from "@/app/actions/suppliers";
import { getParts } from "@/app/actions/parts";
import { getDepartmentLeads } from "@/app/actions/users";
import { CreateOrderDialog } from "@/components/sourcing/create-order-dialog";

import Link from "next/link";
import { auth } from "@/auth";
import { CommunicationHub } from "@/components/dashboard/communication-hub";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { RequisitionDialog } from "@/app/sourcing/requisitions/requisition-dialog";

type SessionUser = {
  id?: string;
  role?: string | null;
};

export default async function Home() {
  const session = await auth();
  const currentUser = session?.user as SessionUser | undefined;
  const userRole = currentUser?.role;
  const isAdmin = userRole === 'admin';

  const [
    stats,
    recentOrders,
    monthlySpend,
    categorySpend,
    riskySuppliers,
    supplierAnalytics,
    suppliers,
    parts,
    departmentLeads,
  ] = await Promise.all([
    getDashboardStats(),
    getRecentOrders(),
    getMonthlySpend(),
    getCategorySpend(),
    getHighRiskSuppliers(),
    getSupplierAnalytics(),
    getSuppliers(),
    getParts(),
    getDepartmentLeads(),
  ]);

  const leads = departmentLeads.filter((lead) => lead.id !== currentUser?.id);
  const activeOrderCount = Number(stats.pendingCount || 0);
  const moderateRiskSuppliers = supplierAnalytics
    .filter((supplier) => Number(supplier.riskScore || 0) >= 40 && Number(supplier.riskScore || 0) < 60)
    .sort((left, right) => Number(right.riskScore || 0) - Number(left.riskScore || 0))
    .slice(0, 3);
  const warehouseSubtitle = Number(stats.totalInventory) > 0
    ? `On-hand units across ${stats.stockedSkuCount} stocked SKUs`
    : activeOrderCount > 0
      ? `No on-hand stock yet. ${activeOrderCount} active orders are still upstream of receiving.`
      : stats.partCount > 0
        ? `On-hand units across ${stats.stockedSkuCount} stocked SKUs`
        : "Parts catalog has not been populated yet.";
  const dashboardTitle = isAdmin ? "Admin Command Center" : "Operations Workspace";
  const sessionBadge = isAdmin ? "Admin Console Session" : "Internal User Session";
  const dashboardSubtitle = isAdmin
    ? "Restricted intelligence, approvals, and platform control"
    : "Operational sourcing and requisition workspace";

  const roleBadgeClass = isAdmin
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div className="p-4 lg:p-10 space-y-8 bg-background min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase leading-none">{dashboardTitle}</h1>
            {userRole && (
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${roleBadgeClass}`}>
                {sessionBadge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">{dashboardSubtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <AutoRefresh />
          {isAdmin ? <CreateOrderDialog suppliers={suppliers} parts={parts} /> : <RequisitionDialog />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin ? (
        <Card className="glass-card border-l-4 border-l-emerald-600 shadow-lg hover:shadow-emerald-500/20 transition-all h-full accent-shimmer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">Enterprise Spend</CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground tracking-tighter">
              {formatCurrency(stats.totalSpend)}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {!stats.isFirstMonth && stats.showMomChange ? (
                <Badge variant="outline" className={cn(
                  "text-[10px] font-bold px-1.5 py-0",
                  Number(stats.momChange) >= 0 ? "bg-emerald-50/50 text-emerald-700 border-emerald-100" : "bg-red-50/50 text-red-700 border-red-100"
                )}>
                  <TrendingUp className={cn("h-3 w-3 mr-1", Number(stats.momChange) < 0 && "rotate-180")} />
                  {Number(stats.momChange) >= 0 ? "+" : ""}{stats.momChange}%
                </Badge>
              ) : !stats.isFirstMonth ? (
                <Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground border-border px-1.5 py-0">
                  Current month open
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground border-border px-1.5 py-0">
                  New baseline
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground font-medium uppercase">{stats.momentumLabel || 'vs last month'}</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Link href="/admin/analytics" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase">
                  View Analytics
                </Button>
              </Link>
              <Link href="/sourcing/orders">
                <Button size="sm" className="h-7 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white">
                  New Order
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        ) : (
        <Card className="glass-card border-l-4 border-l-emerald-600 shadow-lg hover:shadow-emerald-500/20 transition-all h-full accent-shimmer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">Purchase Requests</CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <CreditCard className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground tracking-tighter">Request</div>
            <div className="flex items-center gap-1 mt-2">
              <Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground border-border px-1.5 py-0">
                Internal workflow
              </Badge>
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Submit for approval</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Link href="/sourcing/requisitions" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase">
                  View Requisitions
                </Button>
              </Link>
              <RequisitionDialog />
            </div>
          </CardContent>
        </Card>
        )}

        {/* Active Suppliers */}
        <Card className="glass-card border-l-4 border-l-emerald-500 shadow-lg hover:shadow-emerald-500/20 transition-all h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">Verified Network</CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground tracking-tighter">{stats.supplierCount}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Active global suppliers
            </p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Link href="/suppliers" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase">
                  View Suppliers
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/suppliers?action=new">
                  <Button size="sm" className="h-7 text-[10px] font-bold uppercase bg-emerald-500 hover:bg-emerald-600 text-white">
                    Add
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card className="glass-card border-l-4 border-l-sky-500 shadow-lg hover:shadow-sky-500/20 transition-all h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">Active Funnel</CardTitle>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
              <CreditCard className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground tracking-tighter">{stats.pendingCount}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase font-mono">{stats.fulfilledCount} Fulfilled · {stats.pendingCount} Active</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Link href="/sourcing/orders" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase">
                  View Orders
                </Button>
              </Link>
              <Link href="/sourcing/orders">
                <Button size="sm" className="h-7 text-[10px] font-bold uppercase bg-sky-500 hover:bg-sky-600 text-white">
                  Track
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Live Inventory */}
        <Card className="glass-card border-l-4 border-l-amber-500 shadow-lg hover:shadow-amber-500/20 transition-all h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-tight">Warehouse Load</CardTitle>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <Boxes className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground tracking-tighter">{Number(stats.totalInventory).toLocaleString('en-IN')}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase">{warehouseSubtitle}</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Link href="/sourcing/parts" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase">
                  Inventory
                </Button>
              </Link>
              <Link href="/sourcing/parts?filter=critical">
                <Button size="sm" className="h-7 text-[10px] font-bold uppercase bg-amber-500 hover:bg-amber-600 text-white">
                  Reorder
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <InsightInfographics
          monthlyData={monthlySpend}
          categoryData={categorySpend}
          supplierData={supplierAnalytics}
          riskySuppliers={riskySuppliers}
          stats={stats}
        />
      )}

      {isAdmin && (
        <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)] shadow-xl">
          <CardContent className="p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    AI Mission Control
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-white/80 text-slate-600">
                    Stronger agents and guarded routes
                  </Badge>
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Interactive fleet ops are live from the main dashboard.</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    Launch resilient AI runs, coordinated recovery bundles, and route-safe drill-downs from the upgraded command surface without routing glitches or brittle handoffs.
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <Link href="/admin/agents">
                  <Button className="w-full justify-between rounded-2xl bg-slate-950 px-5 py-6 text-left text-sm font-bold hover:bg-black">
                    Open AI Fleet
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/admin/fraud-alerts">
                    <Button variant="outline" className="w-full justify-between rounded-2xl px-4 py-5 text-left font-semibold">
                      Risk Console
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/admin/scenarios">
                    <Button variant="outline" className="w-full justify-between rounded-2xl px-4 py-5 text-left font-semibold">
                      Scenario Lab
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          {isAdmin ? (
            <DataExplorer monthlyData={monthlySpend} categoryData={categorySpend} supplierData={supplierAnalytics} />
          ) : (
            <Card className="shadow-lg border-accent/50 overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-lg">Operational Workspace</CardTitle>
                <CardDescription>Use requisitions for internal purchasing and the shared support center for help.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/sourcing/requisitions" className="flex-1">
                    <Button variant="outline" className="w-full">Open Requisitions</Button>
                  </Link>
                  <Link href="/support" className="flex-1">
                    <Button className="w-full">Help & Support</Button>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enterprise spend analytics, telemetry, and supplier risk monitoring remain limited to admin sessions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="col-span-3 space-y-6">
          {isAdmin ? <CommunicationHub leads={leads} /> : null}
          {isAdmin ? <Card className="shadow-lg border-accent/50 overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Recent Procurement
              </CardTitle>
              <CardDescription>
                Latest purchase orders and status updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <RecentProcurements orders={recentOrders} />
            </CardContent>
          </Card> : null}

          {isAdmin && (
            <Card className="shadow-lg border-destructive/20 overflow-hidden">
              <CardHeader className="border-b bg-destructive/10 border-destructive/20">
                <CardTitle className="flex items-center gap-2 text-lg text-destructive font-black uppercase tracking-widest">
                  <ShieldAlert className="h-5 w-5 animate-pulse" />
                  Risk Intelligence
                </CardTitle>
                <CardDescription className="text-destructive/70 font-medium">
                  High-priority interventions required.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {riskySuppliers.length > 0 ? riskySuppliers.map((s) => (
                    <Link key={s.id} href={`/suppliers/${s.id}`} className="block group">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-destructive/10 group-hover:border-destructive/30 group-hover:shadow-md transition-all">
                        <div>
                          <p className="font-bold text-foreground group-hover:text-destructive transition-colors">{s.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">Intervention needed</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="font-black text-[12px] px-2 py-0.5">
                            {s.riskScore}
                          </Badge>
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-tighter mt-1">Criticality</p>
                        </div>
                      </div>
                    </Link>
                  )) : moderateRiskSuppliers.length > 0 ? moderateRiskSuppliers.map((supplier) => (
                    <Link key={supplier.name} href="/suppliers" className="block group">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 group-hover:border-amber-400 group-hover:shadow-md transition-all">
                        <div>
                          <p className="font-bold text-foreground group-hover:text-amber-700 transition-colors">{supplier.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">Warning range</p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-amber-500 text-white hover:bg-amber-500 font-black text-[12px] px-2 py-0.5">
                            {supplier.riskScore}
                          </Badge>
                          <p className="text-[8px] text-muted-foreground font-black uppercase tracking-tighter mt-1">Monitor closely</p>
                        </div>
                      </div>
                    </Link>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">All suppliers within safe risk limits.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
