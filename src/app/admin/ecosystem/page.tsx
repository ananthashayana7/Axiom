'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Network,
    ShieldAlert,
    Activity,
    Search,
    Filter,
    ArrowUpRight,
    Building2,
    Users,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Globe,
    Layers,
    Share2,
    Link as LinkIcon
} from "lucide-react";
import { buildSupplierEcosystem } from "@/app/actions/agents/supplier-ecosystem";
import { toast } from "sonner";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SupplierEcosystemPage() {
    const [ecosystem, setEcosystem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'map' | 'risk' | 'clusters'>('map');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await buildSupplierEcosystem();
                if (result.success) {
                    setEcosystem(result.data);
                }
            } catch (error) {
                toast.error("Failed to map ecosystem");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-stone-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs animate-pulse">Mapping Supply Chain Graph...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 bg-stone-50/30 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-stone-900 uppercase flex items-center gap-3">
                        <Network className="h-8 w-8 text-indigo-600" />
                        Supplier Ecosystem Intelligence
                    </h1>
                    <p className="text-sm text-stone-500 font-bold uppercase tracking-widest mt-1">
                        Global Dependency Mapping & Risk Propagation Analysis
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-white px-3 py-1 font-mono uppercase text-xs border-indigo-200">
                        Health Score: {ecosystem?.overallHealthScore}/100
                    </Badge>
                </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-sm bg-indigo-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-200">Total Nodes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black">{ecosystem?.nodes.length}</div>
                        <p className="text-[10px] text-indigo-300 font-bold mt-1 uppercase tracking-wider">Active Suppliers Mapped</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Relationships</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-stone-900">{ecosystem?.relationships.length}</div>
                        <p className="text-[10px] text-stone-500 font-bold mt-1 uppercase tracking-wider">Inter-Supplier Dependencies</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Risk Hotspots</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-red-600 font-mono tracking-tighter">{ecosystem?.riskHotspots.length}</div>
                        <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider">Critical Exposure Points</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Active Clusters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-indigo-600">{ecosystem?.clusters.length}</div>
                        <p className="text-[10px] text-stone-500 font-bold mt-1 uppercase tracking-wider">Strategic Category Groups</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visual Map (High Fidelity Simulation) */}
                <Card className="lg:col-span-8 h-[600px] border-none shadow-md bg-white relative overflow-hidden group">
                    <CardHeader className="absolute top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-stone-500 flex items-center gap-2">
                                <Share2 className="h-4 w-4" /> Dependency Graph Projection
                            </CardTitle>
                            <div className="flex bg-stone-100 p-1 rounded-lg gap-1">
                                <button className="px-3 py-1 text-[10px] font-bold rounded-md bg-white shadow-sm">PHYSICAL</button>
                                <button className="px-3 py-1 text-[10px] font-bold rounded-md hover:bg-stone-200 transition-colors">SEMANTIC</button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="h-full flex items-center justify-center p-0">
                        {/* Interactive Graph Simulation Area */}
                        <div className="w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] relative">
                            {/* Simulated Graph Nodes & Connections */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px]">
                                {ecosystem?.nodes.slice(0, 15).map((node: any, i: number) => {
                                    const angle = (i / 15) * 2 * Math.PI;
                                    const r = 160;
                                    const x = Math.cos(angle) * r;
                                    const y = Math.sin(angle) * r;

                                    return (
                                        <div
                                            key={node.id}
                                            className="absolute"
                                            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                                        >
                                            <div className="group relative">
                                                <div className={`h-4 w-4 rounded-full border-2 ${node.riskScore > 70 ? 'bg-red-500 border-red-200' : 'bg-indigo-500 border-indigo-200'} transition-transform hover:scale-150 cursor-pointer`} />
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-stone-900 text-white px-2 py-1 rounded text-[10px] font-mono z-20">
                                                    {node.name} (Risk: {node.riskScore})
                                                </div>
                                                {/* Connecting lines (simulated) */}
                                                <div className={`absolute w-[160px] h-px bg-indigo-100 dark:bg-indigo-900 origin-left -z-10`} style={{ transform: `rotate(${angle + Math.PI}rad)` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Central Hub Node */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <div className="h-16 w-16 bg-indigo-600 rounded-full flex items-center justify-center text-white border-8 border-indigo-100 shadow-2xl animate-pulse">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <p className="absolute top-full left-1/2 -translate-x-1/2 mt-3 font-black text-xs uppercase tracking-tighter whitespace-nowrap">Corporate Hub</p>
                                </div>
                            </div>

                            {/* Legend Overlay */}
                            <div className="absolute bottom-6 left-6 p-4 bg-white/90 backdrop-blur-md rounded-2xl border shadow-lg space-y-3">
                                <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Map Legend</p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
                                        <div className="h-2 w-2 rounded-full bg-indigo-500" /> Critical Supplier
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
                                        <div className="h-2 w-2 rounded-full bg-red-500" /> High Risk Node
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
                                        <div className="h-px w-6 bg-indigo-100" /> Active Contract
                                    </div>
                                </div>
                            </div>

                            {/* Zoom/Pan Controls (Visual only) */}
                            <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                                <button className="h-8 w-8 bg-white border rounded-lg shadow-sm flex items-center justify-center font-bold text-stone-600 hover:bg-stone-50">+</button>
                                <button className="h-8 w-8 bg-white border rounded-lg shadow-sm flex items-center justify-center font-bold text-stone-600 hover:bg-stone-50">-</button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Hotspots & Recommendations */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-md bg-stone-900 text-white overflow-hidden">
                        <CardHeader className="pb-2 border-b border-white/10">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-400">Risk Hotspot Feed</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {ecosystem?.riskHotspots.slice(0, 3).map((hotspot: any, i: number) => (
                                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black uppercase tracking-tighter text-indigo-300">{hotspot.sourceSupplier}</h4>
                                        <Badge className={`${hotspot.impactSeverity === 'critical' ? 'bg-red-500' : 'bg-orange-500'} text-xs uppercase font-black px-2 py-0`}>
                                            {hotspot.impactSeverity}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-stone-500">Financial Exposure</p>
                                        <p className="text-lg font-mono font-black italic">₹{hotspot.financialExposure.toLocaleString()}</p>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-[10px] uppercase font-black text-indigo-400 mb-2">Mitigation Action</p>
                                        <p className="text-xs text-stone-300 font-medium leading-relaxed italic">"{hotspot.mitigationOptions[0]}"</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Strategic Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {ecosystem?.recommendations.map((rec: string, i: number) => (
                                <div key={i} className="flex items-start gap-4 group">
                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                        <Zap className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <p className="text-xs font-semibold text-stone-700 leading-normal">{rec}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Button variant="outline" className="w-full border-2 border-indigo-100 font-bold uppercase tracking-widest text-xs h-12 hover:bg-indigo-50 transition-all gap-2">
                        <Layers className="h-4 w-4" /> Download Intelligence Report
                    </Button>
                </div>
            </div>

            {/* Health Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-md bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-black uppercase tracking-tighter text-stone-900 underline decoration-indigo-500 decoration-4 underline-offset-4">Cluster Density Analysis</CardTitle>
                        <CardDescription>Identifying core category dependencies and monopolistic clusters.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ecosystem?.clusters.map((c: any) => ({ name: c.name.split(' ')[0], count: c.supplierIds.length }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-black uppercase tracking-tighter text-stone-900 underline decoration-emerald-500 decoration-4 underline-offset-4">Risk Distribution Portfolio</CardTitle>
                        <CardDescription>Visualizing high-risk nodes vs stable strategic partners.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Critical Risk', value: ecosystem?.riskHotspots.filter((h: any) => h.impactSeverity === 'critical').length || 0 },
                                        { name: 'High Risk', value: ecosystem?.riskHotspots.filter((h: any) => h.impactSeverity === 'high').length || 0 },
                                        { name: 'Moderate', value: ecosystem?.nodes.length - ecosystem?.riskHotspots.length },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#ef4444" />
                                    <Cell fill="#f59e0b" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
