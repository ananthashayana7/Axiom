'use client';

import { useState } from "react";
import { 
    Download, 
    Plus, 
    Settings2, 
    FileJson, 
    FileSpreadsheet,
    ChevronDown,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface InventoryPart {
    id: string;
    sku: string;
    name: string;
    category: string;
    stockLevel: number | null;
    minStockLevel: number | null;
    reorderPoint: number | null;
    abcClassification: string | null;
    marketTrend: string | null;
}

export function InventoryActions({ parts }: { parts: InventoryPart[] }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExportCSV = () => {
        setIsExporting(true);
        try {
            const headers = ["SKU", "Name", "Category", "Stock Level", "Min Level", "Reorder Point", "ABC", "Trend"];
            const rows = parts.map(p => [
                p.sku,
                `"${p.name.replace(/"/g, '""')}"`,
                p.category,
                p.stockLevel ?? 0,
                p.minStockLevel ?? 0,
                p.reorderPoint ?? 0,
                p.abcClassification ?? 'None',
                p.marketTrend ?? 'stable'
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(r => r.join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `axiom_inventory_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("Inventory exported successfully", {
                description: `${parts.length} SKUs saved to CSV.`
            });
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export inventory data");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-9 font-bold text-[11px] uppercase tracking-wider border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
                        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Export
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Format</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>Export as CSV</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => toast.info("JSON export coming soon")}>
                        <FileJson className="h-4 w-4 text-blue-600" />
                        <span>Export as JSON</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-9 font-bold text-[11px] uppercase tracking-wider border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
                onClick={() => toast.info("Inventory adjustment mode enabled. Select a part to modify.")}
            >
                <Settings2 className="h-3.5 w-3.5" />
                Adjust Stock
            </Button>
        </div>
    );
}
