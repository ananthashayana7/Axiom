'use client'

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    AlertCircle,
    Clock,
    ShieldCheck,
    Calendar,
    ArrowUpRight
} from "lucide-react";

interface DocumentSnapshot {
    recordedAt: string | Date;
    deliveryRate: string;
    qualityScore: string;
    collaborationScore: number;
}

interface ScorecardProps {
    metrics: {
        performanceScore: number;
        onTimeDeliveryRate: string;
        defectRate: string;
        collaborationScore: number;
        responsivenessScore: number;
        performanceLogs: DocumentSnapshot[];
    };
}

export function SupplierScorecard({ metrics }: ScorecardProps) {
    // Reverse logs for trend chart (oldest to newest)
    const chartData = [...metrics.performanceLogs].reverse().map(log => ({
        date: new Date(log.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        delivery: parseFloat(log.deliveryRate),
        quality: parseFloat(log.qualityScore),
        collaboration: log.collaborationScore
    }));

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50/50 to-transparent">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Overall Reliability</CardDescription>
                        <CardTitle className="text-2xl font-bold text-blue-600">{metrics.performanceScore}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <TrendingUp className="h-3 w-3" /> +2.4% vs last Q
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">On-Time Delivery</CardDescription>
                        <CardTitle className="text-2xl font-bold">{metrics.onTimeDeliveryRate}%</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Progress value={parseFloat(metrics.onTimeDeliveryRate)} className="h-1.5" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" /> Target: 95.0%
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Quality Rate</CardDescription>
                        <CardTitle className="text-2xl font-bold">{100 - parseFloat(metrics.defectRate)}%</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Progress value={100 - parseFloat(metrics.defectRate)} className="h-1.5 bg-red-100" />
                        <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertCircle className="h-3 w-3" /> {metrics.defectRate}% defect rate
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Collaboration</CardDescription>
                        <CardTitle className="text-2xl font-bold">{metrics.collaborationScore}/100</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full ${i <= (metrics.collaborationScore / 20) ? 'bg-primary' : 'bg-muted'}`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" /> Responsive Tier
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Performance Trends</CardTitle>
                            <CardDescription>Historical tracking of delivery and quality excellence.</CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1 font-bold">
                            <ArrowUpRight className="h-3 w-3" /> Last 10 Audits
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorDelivery" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorQuality" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#888' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#888' }}
                                    domain={[70, 100]}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="delivery"
                                    name="Delivery Rate"
                                    stroke="#2563eb"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorDelivery)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="quality"
                                    name="Quality Score"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorQuality)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Recent Performance Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {metrics.performanceLogs.map((log: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">{new Date(log.recordedAt).toLocaleDateString()}</p>
                                        <p className="text-xs text-muted-foreground">{log.notes || "Routine performance audit"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Delivery</p>
                                        <p className="font-bold text-sm text-blue-600">{log.deliveryRate}%</p>
                                    </div>
                                    <div className="text-center">
                                        <ShieldCheck className={`h-5 w-5 ${parseFloat(log.qualityScore) > 90 ? 'text-green-500' : 'text-yellow-500'}`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
