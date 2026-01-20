'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Search, Filter } from "lucide-react";
import { PartMenuActions } from "./part-menu-actions";
import { formatCurrency } from "@/lib/utils/currency";
import { Input } from "@/components/ui/input";

export function PartsClient({ initialParts }: { initialParts: any[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    const categories = useMemo(() => {
        const cats = new Set(initialParts.map(p => p.category));
        return ["All", ...Array.from(cats)];
    }, [initialParts]);

    const filteredParts = useMemo(() => {
        return initialParts.filter(part => {
            const matchesSearch =
                part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                part.sku.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = categoryFilter === "All" || part.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [initialParts, searchQuery, categoryFilter]);

    const renderTrend = (trend: string | null) => {
        switch (trend?.toLowerCase()) {
            case 'up':
                return <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 flex items-center gap-1"><TrendingUp size={12} /> Rising</Badge>;
            case 'down':
                return <Badge variant="outline" className="text-green-500 border-green-200 bg-green-50 flex items-center gap-1"><TrendingDown size={12} /> Falling</Badge>;
            case 'volatile':
                return <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50 flex items-center gap-1"><AlertTriangle size={12} /> Volatile</Badge>;
            default:
                return <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 flex items-center gap-1"><Minus size={12} /> Stable</Badge>;
        }
    };

    return (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-muted/20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold shrink-0">Parts Inventory</h2>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-background"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <select
                                className="pl-9 pr-4 py-2 border rounded-md text-sm bg-background appearance-none min-w-[140px] focus:ring-2 focus:ring-primary"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">SKU</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">Part Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">Category</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Stock</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">Current Price</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">Market Trend</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredParts.map((part) => (
                            <tr key={part.id} className="hover:bg-muted/30 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-primary">{part.sku}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{part.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                    <Badge variant="secondary" className="font-semibold bg-secondary/50">{part.category}</Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <span className={`inline-block px-2 py-1 rounded-md font-bold ${part.stockLevel < 20 ? 'bg-red-100 text-red-700' :
                                        part.stockLevel < 50 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {part.stockLevel}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground font-black text-lg">
                                    {formatCurrency(part.price || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {renderTrend(part.marketTrend)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-black uppercase">
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${part.stockLevel < 20 ? 'bg-red-500 animate-pulse' : part.stockLevel < 50 ? 'bg-amber-500' : 'bg-green-500'}`} />
                                        {part.stockLevel < 20 ? 'CRITICAL' : part.stockLevel < 50 ? 'LOW STOCK' : 'AVAILABLE'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <PartMenuActions part={part} />
                                </td>
                            </tr>
                        ))}
                        {filteredParts.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-20 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search size={48} className="opacity-20" />
                                        <p className="text-xl font-bold">No parts found</p>
                                        <p className="text-sm">Try adjusting your search or filters.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AlertTriangle({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size || 24}
            height={size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </svg>
    );
}
