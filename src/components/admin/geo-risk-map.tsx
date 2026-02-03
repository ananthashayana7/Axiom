'use client'

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface SupplierMarker {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    riskScore: number;
}

interface GeoRiskMapProps {
    suppliers: SupplierMarker[];
}

// Simple projection: Lat/Lng to SVG coordinates
function project(lat: number, lng: number, width: number, height: number) {
    const x = (lng + 180) * (width / 360);
    const y = (90 - lat) * (height / 180);
    return { x, y };
}

export function GeoRiskMap({ suppliers }: GeoRiskMapProps) {
    const width = 800;
    const height = 400;

    return (
        <Card className="h-full border-none shadow-none bg-stone-900 overflow-hidden relative group">
            <CardHeader className="absolute top-4 left-4 z-10 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-4">
                <CardTitle className="text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Global Risk Control Tower
                </CardTitle>
                <CardDescription className="text-stone-400 text-xs">Geographic concentration & disruption monitoring.</CardDescription>
            </CardHeader>

            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <div className="w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(16,185,129,0.1)_0%,transparent_70%)]" />
            </div>

            <div className="relative w-full h-full flex items-center justify-center p-8 mt-12">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full text-stone-700 fill-stone-800"
                >
                    {/* Detailed World Outline */}
                    <g className="fill-stone-800/50 stroke-stone-700/50">
                        {/* North America */}
                        <path d="M50,50 L150,50 L200,100 L180,180 L100,180 L50,150 Z" />
                        {/* South America */}
                        <path d="M180,180 L220,200 L200,350 L150,350 L130,220 Z" />
                        {/* Eurasia */}
                        <path d="M350,50 L750,50 L780,150 L700,220 L550,220 L400,150 Z" />
                        {/* Africa */}
                        <path d="M400,150 L550,220 L530,350 L420,350 L380,250 Z" />
                        {/* Australia */}
                        <path d="M650,280 L720,280 L720,340 L650,340 Z" />
                    </g>
                    <rect width={width} height={height} fill="transparent" />

                    {/* Grid Lines */}
                    {[...Array(12)].map((_, i) => (
                        <line
                            key={`h-${i}`}
                            x1="0" y1={(height / 12) * i}
                            x2={width} y2={(height / 12) * i}
                            stroke="white" strokeOpacity="0.03" strokeWidth="0.5"
                        />
                    ))}
                    {[...Array(24)].map((_, i) => (
                        <line
                            key={`v-${i}`}
                            x1={(width / 24) * i} y1="0"
                            x2={(width / 24) * i} y2={height}
                            stroke="white" strokeOpacity="0.03" strokeWidth="0.5"
                        />
                    ))}

                    {/* Supplier Markers */}
                    {suppliers.map((s) => {
                        const { x, y } = project(s.latitude, s.longitude, width, height);
                        const isHighRisk = s.riskScore > 60;

                        return (
                            <g key={s.id} className="cursor-pointer group">
                                <title>{s.name} - Risk Score: {s.riskScore}/100</title>
                                {isHighRisk && (
                                    <motion.circle
                                        cx={x} cy={y}
                                        r={6}
                                        fill="none"
                                        stroke="#ef4444"
                                        initial={{ scale: 1, opacity: 0.6 }}
                                        animate={{ scale: 3, opacity: 0 }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    />
                                )}

                                <motion.circle
                                    cx={x} cy={y}
                                    r={isHighRisk ? 4 : 3}
                                    fill={isHighRisk ? "#ef4444" : "#10b981"}
                                    className="transition-transform group-hover:scale-150"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                />
                            </g>
                        );
                    })}
                    {/* Continent Labels */}
                    <g className="text-[10px] fill-stone-500 font-medium pointer-events-none">
                        <text x="80" y="100">NORTH AMERICA</text>
                        <text x="160" y="280">SOUTH AMERICA</text>
                        <text x="450" y="100">EURASIA</text>
                        <text x="440" y="250">AFRICA</text>
                        <text x="660" y="310">OCEANIA</text>
                    </g>

                    <rect width={width} height={height} fill="transparent" />
                </svg>
            </div>

            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Geographic Distribution</span>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-xs text-stone-300">Total Suppliers</span>
                            <span className="text-xs font-bold text-white">{suppliers.length}</span>
                        </div>
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-xs text-stone-300">At Risk Clusters</span>
                            <span className="text-xs font-bold text-red-400">
                                {suppliers.filter(s => s.riskScore > 60).length}
                            </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <span className="text-[9px] text-stone-500 font-bold uppercase block mb-1">Top Hotspot</span>
                            <span className="text-[11px] text-white font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                {suppliers.filter(s => s.riskScore > 60).length > 0
                                    ? "Multiple Regions Detected"
                                    : "No Active Hotspots"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 right-4 flex gap-4 bg-black/20 backdrop-blur-sm p-2 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Operational
                </div>
                <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> High Risk
                </div>
            </div>
        </Card>
    );
}
