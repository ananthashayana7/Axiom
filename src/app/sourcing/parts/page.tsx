import React from 'react';
import { getPartLinkedCounts, getParts } from "@/app/actions/parts";
import { CreatePartDialog } from "@/components/parts/create-part-dialog";
import { PartsClient } from "@/components/parts/parts-client";
import { PartCharts } from "@/components/parts/part-charts";

export const dynamic = 'force-dynamic';

export default async function PartsPage() {
  const [parts, linkCounts] = await Promise.all([getParts(), getPartLinkedCounts()]);

  const countsMap = new Map(linkCounts.map((row: any) => [row.partId, row]));
  const partsWithLinks = parts.map((part: any) => {
    const counts = countsMap.get(part.id) || { orderCount: 0, invoiceCount: 0, rfqCount: 0 };
    return { ...part, ...counts };
  });

  // Basic stats calculation based on real data
  const totalParts = partsWithLinks.length;
  const lowStock = partsWithLinks.filter((p: any) => p.stockLevel <= (p.reorderPoint || 50) && p.stockLevel > (p.minStockLevel || 20)).length;
  const criticalStock = partsWithLinks.filter((p: any) => p.stockLevel <= (p.minStockLevel || 20)).length;
  const categoriesCount = new Set(partsWithLinks.map((p: any) => p.category)).size;
  const totalOrderLinks = partsWithLinks.reduce((acc: number, p: any) => acc + (p.orderCount || 0), 0);
  const totalInvoiceLinks = partsWithLinks.reduce((acc: number, p: any) => acc + (p.invoiceCount || 0), 0);

  return (
    <div className="p-4 lg:p-8 bg-muted/40 min-h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary font-outfit uppercase">Parts Intelligence</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Strategic inventory management and market trend analysis.
          </p>
        </div>
        <CreatePartDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-card p-6 rounded-2xl border shadow-sm border-blue-100 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Total Inventory</p>
              <p className="text-3xl font-black text-blue-700">{totalParts}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl border border-blue-200">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm border-amber-100 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Low Stock</p>
              <p className="text-3xl font-black text-amber-600">{lowStock}</p>
            </div>
            <div className="bg-amber-100 p-3 rounded-xl border border-amber-200">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm border-red-100 bg-red-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Critical</p>
              <p className="text-3xl font-black text-red-600">{criticalStock}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-xl border border-red-200">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm border-green-100 bg-green-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Categories</p>
              <p className="text-3xl font-black text-green-700">{categoriesCount}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl border border-green-200">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <div className="bg-card p-6 rounded-2xl border shadow-sm">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Linked Transaction Coverage</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-blue-50/40 border-blue-100 p-4">
              <p className="text-xs text-muted-foreground uppercase font-bold">Order Links</p>
              <p className="text-3xl font-black text-blue-700">{totalOrderLinks}</p>
            </div>
            <div className="rounded-xl border bg-amber-50/40 border-amber-100 p-4">
              <p className="text-xs text-muted-foreground uppercase font-bold">Invoice Links</p>
              <p className="text-3xl font-black text-amber-700">{totalInvoiceLinks}</p>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-3">Top Linked Parts</p>
          <div className="space-y-2 max-h-40 overflow-auto pr-1">
            {partsWithLinks
              .slice()
              .sort((a: any, b: any) => (b.orderCount + b.invoiceCount) - (a.orderCount + a.invoiceCount))
              .slice(0, 5)
              .map((part: any) => (
                <div key={part.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-semibold text-sm">{part.name}</p>
                    <p className="text-xs text-muted-foreground">{part.sku}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-bold">
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Orders: {part.orderCount || 0}</span>
                    <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">Invoices: {part.invoiceCount || 0}</span>
                    <span className="px-2 py-1 rounded bg-violet-100 text-violet-700">RFQs: {part.rfqCount || 0}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <PartCharts parts={partsWithLinks} />

      <PartsClient initialParts={JSON.parse(JSON.stringify(partsWithLinks))} />
    </div>
  );
};
