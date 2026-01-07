'use client'

import React, { useEffect, useState } from "react";
import { getSupplierStats, getSupplierRFQs } from "@/app/actions/portal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    ShoppingCart,
    MessageSquare,
    Bell,
    Clock,
    ChevronRight,
    ArrowUpRight,
    Sparkles
} from "lucide-react";
import Link from "next/link";

export default function SupplierDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            const [s, r] = await Promise.all([
                getSupplierStats(),
                getSupplierRFQs()
            ]);
            setStats(s);
            setRfqs(r);
            setLoading(false);
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground font-medium">Authenticating vendor access...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Supplier Command Center</h1>
                    <p className="text-muted-foreground mt-1">Manage your bids, orders, and strategic partnership with Axiom.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2 relative">
                        <Bell className="h-4 w-4" /> Notifications
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    </Button>
                </div>
            </div>

            {/* Vendor Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">New Invitations</CardTitle>
                        <Sparkles className="h-4 w-4 opacity-80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black">{stats?.invitedRFQs || 0}</div>
                        <p className="text-xs opacity-70 mt-2">Active RFQs requiring your quotation.</p>
                        <Button variant="secondary" size="sm" className="w-full mt-4 font-bold">
                            View Invitations <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Active Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats?.activeOrders || 0}</div>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> 2 orders due this week
                        </p>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Partner Health</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">A+</div>
                        <p className="text-xs text-muted-foreground mt-2">Preferred tier supplier status active.</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                {/* Recent RFQs List */}
                <Card className="lg:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Active Sourcing Requests
                        </CardTitle>
                        <CardDescription>RFQ invitations requiring your feedback or quotation.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {rfqs.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl italic">
                                    No active invitations at this time.
                                </div>
                            ) : (
                                rfqs.map((rfq) => (
                                    <div key={rfq.id} className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors group">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground group-hover:text-primary transition-colors">{rfq.title}</span>
                                            <span className="text-xs text-muted-foreground">Received {new Date(rfq.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={rfq.status === 'invited' ? 'default' : 'secondary'} className="uppercase text-[10px] font-bold">
                                                {rfq.status}
                                            </Badge>
                                            <Link href={`/portal/rfqs/${rfq.id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-muted-foreground/20">
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Collaboration & Help */}
                <div className="space-y-6">
                    <Card className="border-none bg-blue-50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                                <MessageSquare className="h-5 w-5" />
                                Support Desk
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-blue-800/80 leading-relaxed mb-4">
                                Need technical help or clarification on an RFQ? Connect with the Axiom procurement team directly.
                            </p>
                            <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold border-none shadow-md">
                                Open Chat Window
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Strategic Documents</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                                <span className="text-sm font-medium">Compliance Policy 2026</span>
                                <Badge variant="outline" className="text-[10px]">NEW</Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                                <span className="text-sm font-medium">Environmental Guidelines</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
