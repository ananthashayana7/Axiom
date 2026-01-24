'use client';

import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Search, Filter } from "lucide-react";
import { PartMenuActions } from "./part-menu-actions";
import { formatCurrency } from "@/lib/utils/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteAllParts } from "@/app/actions/parts";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PartsClient({ initialParts }: { initialParts: any[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [showDeleteAllAlert, setShowDeleteAllAlert] = useState(false);

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

    // Pagination Logic
    const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
    const paginatedParts = filteredParts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

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
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground poiner-events-none" />
                            <select
                                className="pl-9 pr-4 py-2 border rounded-md text-sm bg-background appearance-none min-w-[140px] focus:ring-2 focus:ring-primary cursor-pointer"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteAllAlert(true)}
                            className="h-9 px-4 font-bold bg-red-600 hover:bg-red-700 text-white"
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete All
                        </Button>
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
                            <th className="sticky right-0 bg-muted px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-widest shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] z-10">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {paginatedParts.map((part) => (
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
                                <td className="sticky right-0 bg-card px-6 py-4 whitespace-nowrap text-right shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] z-10 group-hover:bg-muted transition-colors">
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

            {/* Pagination Controls */}
            {
                totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
                        <p className="text-sm text-muted-foreground font-medium">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredParts.length)} of {filteredParts.length} entries
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="h-8 px-3"
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple logic to show first few pages or surrounding current page
                                    // For now, just show first 5 or logic can be improved
                                    let p = i + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        p = currentPage - 2 + i;
                                        if (p > totalPages) p = totalPages - (4 - i);
                                    }
                                    return (
                                        <Button
                                            key={p}
                                            variant={currentPage === p ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePageChange(p)}
                                            className={`h-8 w-8 p-0 ${currentPage === p ? 'bg-primary text-primary-foreground' : ''}`}
                                        >
                                            {p}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="h-8 px-3"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )
            }

            <DeleteAllDialog open={showDeleteAllAlert} onOpenChange={setShowDeleteAllAlert} />
        </div >
    );
}

function DeleteAllDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAllParts();
            if (result.success) {
                toast.success("All parts deleted successfully");
                onOpenChange(false);
            } else {
                toast.error("Failed to delete parts");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete <span className="font-bold text-red-600">ALL</span> parts from the inventory.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isDeleting}
                    >
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete All Data
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
