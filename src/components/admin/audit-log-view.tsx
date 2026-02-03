'use client'

import React, { useState, useMemo } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Filter,
    Download,
    FileText,
    ChevronDown,
    X
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    createdAt: string | Date;
    userName: string;
}

export function AuditLogView({ initialLogs }: { initialLogs: AuditLog[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedActions, setSelectedActions] = useState<string[]>([]);
    const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

    const allActions = useMemo(() => Array.from(new Set(initialLogs.map(l => l.action))), [initialLogs]);
    const allEntities = useMemo(() => Array.from(new Set(initialLogs.map(l => l.entityType))), [initialLogs]);

    const filteredLogs = useMemo(() => {
        return initialLogs.filter(log => {
            const matchesSearch =
                log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.entityId.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesAction = selectedActions.length === 0 || selectedActions.includes(log.action);
            const matchesEntity = selectedEntities.length === 0 || selectedEntities.includes(log.entityType);

            return matchesSearch && matchesAction && matchesEntity;
        });
    }, [initialLogs, searchTerm, selectedActions, selectedEntities]);

    const exportToCSV = () => {
        const headers = ["ID", "Action", "Entity Type", "Entity ID", "Details", "User", "Timestamp"];
        const rows = filteredLogs.map(log => [
            log.id,
            log.action,
            log.entityType,
            log.entityId,
            log.details,
            log.userName,
            new Date(log.createdAt).toISOString()
        ]);

        const reportDate = new Date().toLocaleString();
        const csvContent = [
            `"Axiom Audit Trail Report"`,
            `"Generated On:","${reportDate}"`,
            `"Record Count:","${filteredLogs.length}"`,
            "",
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `axiom_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleAction = (action: string) => {
        setSelectedActions(prev =>
            prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]
        );
    };

    const toggleEntity = (entity: string) => {
        setSelectedEntities(prev =>
            prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
        );
    };

    const clearFilters = () => {
        setSearchTerm("");
        setSelectedActions([]);
        setSelectedEntities([]);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search details, users, IDs..."
                            className="pl-9 bg-background"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Badge variant="secondary" className="h-5 px-1 rounded-sm font-normal">
                                    {selectedActions.length || "All"}
                                </Badge>
                                Actions
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Filter Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {allActions.map(action => (
                                <DropdownMenuCheckboxItem
                                    key={action}
                                    checked={selectedActions.includes(action)}
                                    onCheckedChange={() => toggleAction(action)}
                                >
                                    {action}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Badge variant="secondary" className="h-5 px-1 rounded-sm font-normal">
                                    {selectedEntities.length || "All"}
                                </Badge>
                                Entities
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Filter Entities</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {allEntities.map(entity => (
                                <DropdownMenuCheckboxItem
                                    key={entity}
                                    checked={selectedEntities.includes(entity)}
                                    onCheckedChange={() => toggleEntity(entity)}
                                >
                                    <span className="capitalize">{entity}</span>
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {(searchTerm || selectedActions.length > 0 || selectedEntities.length > 0) && (
                        <Button variant="ghost" className="gap-1 px-2" onClick={clearFilters}>
                            <X className="h-4 w-4" />
                            Clear
                        </Button>
                    )}
                </div>

                <Button onClick={exportToCSV} className="gap-2 shrink-0">
                    <Download className="h-4 w-4" />
                    Export Evidence (CSV)
                </Button>
            </div>

            <Card className="shadow-sm border-accent/20">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground tracking-tight uppercase text-xs">Action</th>
                                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground tracking-tight uppercase text-xs">Entity</th>
                                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground tracking-tight uppercase text-xs">Details</th>
                                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground tracking-tight uppercase text-xs">User</th>
                                    <th className="px-6 py-3 text-left font-semibold text-muted-foreground tracking-tight uppercase text-xs">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge
                                                variant="secondary"
                                                className={`font-mono text-[10px] tracking-tighter uppercase ${log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                                                    log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}
                                            >
                                                {log.action}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded bg-accent/20 flex items-center justify-center text-accent ring-1 ring-accent/10">
                                                    <FileText className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground capitalize">{log.entityType}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{log.entityId.slice(0, 8)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground max-w-sm truncate lg:max-w-md">
                                            {log.details}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {log.userName?.[0]}
                                                </div>
                                                <span className="font-medium">{log.userName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono text-xs text-right md:text-left">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">
                                            No matching audit records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
