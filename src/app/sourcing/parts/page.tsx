import React from 'react';
import { getParts } from "@/app/actions/parts";
import { CreatePartDialog } from "@/components/parts/create-part-dialog";
import { PartMenuActions } from "@/components/parts/part-menu-actions";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function PartsPage() {
  const parts = await getParts();

  // Basic stats calculation based on real data
  const totalParts = parts.length;
  const lowStock = parts.filter((p: any) => p.stockLevel < 50).length; // simple threshold
  const criticalStock = parts.filter((p: any) => p.stockLevel < 20).length; // simple threshold
  const categories = new Set(parts.map((p: any) => p.category)).size;

  return (
    <div className="p-8 bg-muted/40 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parts Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Manage your inventory and parts database.
          </p>
        </div>
        <CreatePartDialog />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Parts</p>
              <p className="text-2xl font-bold">{totalParts}</p>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-600">{lowStock}</p>
            </div>
            <div className="bg-yellow-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold text-red-600">{criticalStock}</p>
            </div>
            <div className="bg-red-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{categories}</p>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Parts Inventory</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search (Coming soon)..."
                className="px-3 py-2 border rounded-md text-sm bg-background"
                disabled
              />
              <select className="px-3 py-2 border rounded-md text-sm bg-background" disabled>
                <option>Filter Category (Coming soon)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Part Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider underline decoration-dotted">Should-Cost Range</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Trend</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parts.map((part: any) => (
                <tr key={part.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium">{part.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{part.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">{part.category}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <span className={`font-medium ${part.stockLevel < 20 ? 'text-red-600' :
                        part.stockLevel < 50 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                        {part.stockLevel}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-semibold">
                    ₹{(Math.random() * 500 + 400).toLocaleString(undefined, { maximumFractionDigits: 0 })} -
                    ₹{(Math.random() * 300 + 900).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-1.5 text-green-600 font-bold">
                      <TrendingUp size={14} />
                      Stable
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={part.stockLevel < 20 ? "destructive" : part.stockLevel < 50 ? "secondary" : "default"}
                      className={part.stockLevel >= 50 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                    >
                      {part.stockLevel < 20 ? 'Critical' : part.stockLevel < 50 ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <PartMenuActions part={part} />
                  </td>
                </tr>
              ))}
              {parts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">No parts found. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (Static for now) */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">1</span> to <span className="font-medium">{parts.length}</span> of{' '}
            <span className="font-medium">{totalParts}</span> results
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded-md text-sm disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm">1</button>
            <button className="px-3 py-1 border rounded-md text-sm disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};
