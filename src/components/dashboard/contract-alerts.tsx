'use client'

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle,
    Calendar,
    ChevronRight,
    Bell,
    FileText,
    ArrowUpRight
} from "lucide-react";
import { getExpiringContracts } from "@/app/actions/contracts";
import Link from "next/link";

export function ContractAlerts() {
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await getExpiringContracts(90);
            setContracts(data);
            setLoading(false);
        };
        load();
    }, []);

    if (loading) return null;
    if (contracts.length === 0) return null;

    return (
        <Card className="border-l-4 border-l-amber-500 shadow-sm overflow-hidden h-full">
            <CardHeader className="pb-3 border-b border-border/50 bg-amber-50/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <CardTitle className="text-base font-semibold">Contract Renewal Pulse</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-200">
                        {contracts.length} Alerts
                    </Badge>
                </div>
                <CardDescription className="text-xs">Expirations within 90 days requiring action.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                    {contracts.slice(0, 3).map((contract) => {
                        const daysLeft = Math.ceil((new Date(contract.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        const isUrgent = daysLeft < 30;

                        return (
                            <div key={contract.id} className="p-3 hover:bg-muted/30 transition-colors group relative">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm truncate">{contract.title}</span>
                                            {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <FileText className="h-3 w-3" />
                                                {contract.supplier?.name}
                                            </span>
                                            <span className={`flex items-center gap-1 ${isUrgent ? 'text-red-600 font-bold' : ''}`}>
                                                <Calendar className="h-3 w-3" />
                                                Exp. {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(contract.validTo))}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={isUrgent ? "destructive" : "secondary"}
                                        className="text-[10px] h-5 px-1.5 shrink-0"
                                    >
                                        {daysLeft}d left
                                    </Badge>
                                </div>
                                <Link
                                    href={`/sourcing/contracts/${contract.id}`}
                                    className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none"
                                />
                            </div>
                        );
                    })}
                </div>
                {contracts.length > 3 && (
                    <div className="p-2 border-t border-border/50 bg-muted/20">
                        <Button variant="ghost" size="sm" className="w-full text-xs font-semibold h-7 gap-1" asChild>
                            <Link href="/sourcing/contracts">
                                View all {contracts.length} contracts <ChevronRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
