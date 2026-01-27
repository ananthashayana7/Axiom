import { Button } from "@/components/ui/button";
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CreditCard, Users, IndianRupee, Package, ShieldAlert } from "lucide-react";
import { AnalyticsBoard } from "@/components/dashboard/analytics-board";
import { DataExplorer } from "@/components/dashboard/data-explorer";
import { RecentSales } from "@/components/dashboard/recent-sales";
import { getDashboardStats, getRecentOrders, getMonthlySpend, getCategorySpend, getHighRiskSuppliers, getSupplierAnalytics } from "@/app/actions/dashboard";
import { getSuppliers } from "@/app/actions/suppliers";
import { getParts } from "@/app/actions/parts";
import { CreateOrderDialog } from "@/components/sourcing/create-order-dialog";
import { DownloadDataButton } from "@/components/dashboard/download-data-button";

import Link from "next/link";
import { auth } from "@/auth";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { CommunicationHub } from "@/components/dashboard/communication-hub";

export default async function Home() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === 'admin';

  const stats = await getDashboardStats();
  const recentOrders = await getRecentOrders();
  const monthlySpend = await getMonthlySpend();
  const categorySpend = await getCategorySpend();
  const riskySuppliers = await getHighRiskSuppliers();
  const supplierAnalytics = await getSupplierAnalytics();
  const suppliers = await getSuppliers();
  const parts = await getParts();

  const allData = {
    stats,
    recentOrders,
    monthlySpend,
    categorySpend,
    supplierAnalytics
  };

  return (
    <div className="p-10 space-y-8 bg-background min-h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <div className="flex items-center space-x-2">
          {isAdmin && <DownloadDataButton data={allData} />}
          <CreateOrderDialog suppliers={suppliers} parts={parts} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Spend */}
        <Link href={isAdmin ? "/admin/analytics" : "/sourcing/orders"} className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tracked Spend</CardTitle>
              <IndianRupee className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats.totalSpend}</div>
              <p className="text-xs text-muted-foreground mt-1">+2.1% from last month</p>
            </CardContent>
          </Card>
        </Link>

        {/* Active Suppliers */}
        <Link href="/suppliers" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Suppliers</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.supplierCount}</div>
              <p className="text-xs text-muted-foreground mt-1">4 new this week</p>
            </CardContent>
          </Card>
        </Link>

        {/* Active Orders */}
        <Link href="/sourcing/orders" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.orderCount}</div>
              <p className="text-xs text-muted-foreground mt-1">12 awaiting approval</p>
            </CardContent>
          </Card>
        </Link>

        {/* Parts Tracked */}
        <Link href="/sourcing/parts" className="block transition-transform hover:scale-[1.02]">
          <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SKUs Tracked</CardTitle>
              <Package className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.partCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Across {categorySpend.length} categories</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <DataExplorer monthlyData={monthlySpend} categoryData={categorySpend} supplierData={supplierAnalytics} />
          {isAdmin && <AiInsights />}
        </div>
        <div className="col-span-3 space-y-6">
          <CommunicationHub />
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
              <RecentSales orders={recentOrders} />
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="shadow-lg border-destructive/20 overflow-hidden">
              <CardHeader className="border-b bg-destructive/5">
                <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  Risk Watchlist
                </CardTitle>
                <CardDescription>
                  Suppliers requiring immediate attention.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {riskySuppliers.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {s.id.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-destructive">{s.riskScore}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Score</p>
                      </div>
                    </div>
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
