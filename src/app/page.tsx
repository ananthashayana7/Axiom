import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CreditCard, Users, IndianRupee, Package, ShieldAlert, TrendingUp, Boxes, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnalyticsBoard } from "@/components/dashboard/analytics-board";
import { DataExplorer } from "@/components/dashboard/data-explorer";
import { RecentProcurements } from "@/components/dashboard/recent-procurements";
import { getDashboardStats, getRecentOrders, getMonthlySpend, getCategorySpend, getHighRiskSuppliers, getSupplierAnalytics } from "@/app/actions/dashboard";
import { getSuppliers } from "@/app/actions/suppliers";
import { getParts } from "@/app/actions/parts";
import { getDepartmentLeads } from "@/app/actions/users";
import { CreateOrderDialog } from "@/components/sourcing/create-order-dialog";

import Link from "next/link";
import { auth } from "@/auth";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { CommunicationHub } from "@/components/dashboard/communication-hub";
import { AutoRefresh } from "@/components/shared/auto-refresh";

export default async function Home() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'admin';
  const isAgent = userRole === 'admin' || userRole === 'user';

  const stats = await getDashboardStats();
  const recentOrders = await getRecentOrders();
  const monthlySpend = await getMonthlySpend();
  const categorySpend = await getCategorySpend();
  const riskySuppliers = await getHighRiskSuppliers();
  const supplierAnalytics = await getSupplierAnalytics();
  const suppliers = await getSuppliers();
  const parts = await getParts();
  const leads = (await getDepartmentLeads()).filter(lead => lead.id !== (session?.user as any)?.id);

  const allData = {
    stats,
    recentOrders,
    monthlySpend,
    categorySpend,
    supplierAnalytics
  };

  return (
    <div className="p-10 space-y-8 bg-background min-h-full" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Command Center</h1>
          <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-1">Enterprise Sourcing & intelligence</p>
        </div>
        <div className="flex items-center space-x-3">
          <AutoRefresh />
          <CreateOrderDialog suppliers={suppliers} parts={parts} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Spend */}
        <Link href={isAgent ? "/admin/analytics" : "/sourcing/orders"} className="block transition-transform hover:scale-[1.02] group">
          <Card className="glass-card border-l-4 border-l-emerald-600 shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer h-full accent-shimmer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-tight">Enterprise Spend</CardTitle>
              <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 tracking-tighter">
                ₹{new Intl.NumberFormat('en-IN').format(Number(stats.totalSpend))}
              </div>
              <div className="flex items-center gap-1 mt-2">
                {!stats.isFirstMonth ? (
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold px-1.5 py-0",
                    Number(stats.momChange) >= 0 ? "bg-emerald-50/50 text-emerald-700 border-emerald-100" : "bg-red-50/50 text-red-700 border-red-100"
                  )}>
                    <TrendingUp className={cn("h-3 w-3 mr-1", Number(stats.momChange) < 0 && "rotate-180")} />
                    {Number(stats.momChange) >= 0 ? "+" : ""}{stats.momChange}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold bg-slate-50/50 text-slate-600 border-slate-100 px-1.5 py-0">
                    New baseline
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground font-medium uppercase">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Active Suppliers */}
        <Link href="/suppliers" className="block transition-transform hover:scale-[1.02] group">
          <Card className="glass-card border-l-4 border-l-emerald-500 shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-tight">Verified Network</CardTitle>
              <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 tracking-tighter">{stats.supplierCount}</div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Active global suppliers
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Pending Orders */}
        <Link href="/sourcing/orders" className="block transition-transform hover:scale-[1.02] group">
          <Card className="glass-card border-l-4 border-l-sky-500 shadow-lg hover:shadow-sky-500/20 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-tight">Active Funnel</CardTitle>
              <div className="p-2 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
                <CreditCard className="h-4 w-4 text-sky-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 tracking-tighter">{stats.pendingCount}</div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase font-mono">Operations: {stats.fulfilledCount} Fulfilled</p>
            </CardContent>
          </Card>
        </Link>

        {/* Live Inventory */}
        <Link href="/sourcing/parts" className="block transition-transform hover:scale-[1.02] group">
          <Card className="glass-card border-l-4 border-l-amber-500 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-tight">Warehouse Load</CardTitle>
              <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                <Boxes className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 tracking-tighter">{Number(stats.totalInventory).toLocaleString()}</div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Units across {stats.partCount} SKUs</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <DataExplorer monthlyData={monthlySpend} categoryData={categorySpend} supplierData={supplierAnalytics} />
          {isAgent && <AiInsights />}
        </div>
        <div className="col-span-3 space-y-6">
          <CommunicationHub leads={leads} />
          <Card className="shadow-lg border-accent/50 overflow-hidden">
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
          </Card>

          {isAgent && (
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
                  {riskySuppliers.map((s) => (
                    <Link key={s.id} href={`/suppliers/${s.id}`} className="block group">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-destructive/10 group-hover:border-destructive/30 group-hover:shadow-md transition-all">
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-destructive transition-colors">{s.name}</p>
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
                  ))}
                  {riskySuppliers.length === 0 && (
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
