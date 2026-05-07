'use client'

import React, { useMemo, useState } from "react";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Download,
    FileText,
    ChevronDown,
    X
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsvFile } from "@/lib/client/download";

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

    const allActions = useMemo(() => Array.from(new Set(initialLogs.map((log) => log.action))), [initialLogs]);
    const allEntities = useMemo(() => Array.from(new Set(initialLogs.map((log) => log.entityType))), [initialLogs]);

    const filteredLogs = useMemo(() => {
        return initialLogs.filter((log) => {
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
        const headers = [
            "Serial No.",
            "Audit ID",
            "Action Type",
            "Entity Type",
            "Entity ID",
            "Description",
            "Performed By",
            "Timestamp (UTC)",
            "Date",
            "Time",
            "Category",
            "Compliance Status",
        ];

        const rows = filteredLogs.map((log, index) => {
            const timestamp = new Date(log.createdAt);
            return [
                index + 1,
                `PMA-AUD-${(log.id || "").slice(0, 8).toUpperCase()}`,
                log.action,
                log.entityType,
                log.entityId,
                log.details,
                log.userName,
                timestamp.toISOString(),
                timestamp.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }),
                timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
                log.action === "CREATE" ? "Data Entry" : log.action === "UPDATE" ? "Modification" : log.action === "DELETE" ? "Removal" : "System Event",
                "Verified",
            ];
        });

        downloadCsvFile(`axiom_audit_trail_${new Date().toISOString().split("T")[0]}.csv`, [
            ["Axiom Global Audit Trail - Compliance Evidence Report"],
            ["Generated On:", new Date().toLocaleString()],
            ["Report Scope:", selectedActions.length ? selectedActions.join(", ") : "All Actions"],
            ["Entity Filter:", selectedEntities.length ? selectedEntities.join(", ") : "All Entities"],
            ["Record Count:", filteredLogs.length],
            ["Exported By:", "Axiom Admin"],
            [],
            headers,
            ...rows,
        ]);
    };

    const toggleAction = (action: string) => {
        setSelectedActions((previous) =>
            previous.includes(action) ? previous.filter((value) => value !== action) : [...previous, action]
        );
    };

    const toggleEntity = (entity: string) => {
        setSelectedEntities((previous) =>
            previous.includes(entity) ? previous.filter((value) => value !== entity) : [...previous, entity]
        );
    };

    const clearFilters = () => {
        setSearchTerm("");
        setSelectedActions([]);
        setSelectedEntities([]);
    };

    const PAGE_SIZE = 50;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{filteredLogs.length}</strong> of <strong className="text-foreground">{initialLogs.length}</strong> audit events</span>
                <span>Page {currentPage} of {totalPages}</span>
            </div>

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search details, users, IDs..."
                            className="bg-background pl-9"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Badge variant="secondary" className="h-5 rounded-sm px-1 font-normal">
                                    {selectedActions.length || "All"}
                                </Badge>
                                Actions
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Filter Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {allActions.map((action) => (
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
                                <Badge variant="secondary" className="h-5 rounded-sm px-1 font-normal">
                                    {selectedEntities.length || "All"}
                                </Badge>
                                Entities
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Filter Entities</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {allEntities.map((entity) => (
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

                <Button onClick={exportToCSV} className="shrink-0 gap-2">
                    <Download className="h-4 w-4" />
                    Export Evidence (CSV)
                </Button>
            </div>

            <Card className="border-accent/20 shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-tight text-muted-foreground">Action</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-tight text-muted-foreground">Entity</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-tight text-muted-foreground">Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-tight text-muted-foreground">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-tight text-muted-foreground">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredLogs.length > 0 ? paginatedLogs.map((log) => (
                                    <tr key={log.id} className="transition-colors hover:bg-muted/10">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <Badge
                                                variant="secondary"
                                                className={`font-mono text-[10px] uppercase tracking-tighter ${log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
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
                                                <div className="flex h-7 w-7 items-center justify-center rounded bg-accent/20 text-accent ring-1 ring-accent/10">
                                                    <FileText className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold capitalize text-foreground">{log.entityType}</span>
                                                    <span className="font-mono text-[10px] text-muted-foreground">{log.entityId.slice(0, 8)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="max-w-sm px-6 py-4 text-muted-foreground lg:max-w-md truncate">
                                            {log.details}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                    {log.userName?.[0]}
                                                </div>
                                                <span className="font-medium">{log.userName}</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right font-mono text-xs text-muted-foreground md:text-left">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center italic text-muted-foreground">
                                            No matching audit records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="text-xs">
                        &laquo; First
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="text-xs">
                        &lsaquo; Prev
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                        Page {currentPage} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="text-xs">
                        Next &rsaquo;
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="text-xs">
                        Last &raquo;
                    </Button>
                </div>
            )}
        </div>
    );
}
