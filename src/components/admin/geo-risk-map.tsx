'use client'

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Globe, MapPin } from "lucide-react";
import { useCurrency } from '@/components/currency-provider';
import { getAlpha3 } from '@/lib/utils/geo-currency';

interface SupplierMarker {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    riskScore: number;
    countryCode?: string | null;
}

interface GeoRiskMapProps {
    suppliers: SupplierMarker[];
}

interface TooltipState {
    x: number;
    y: number;
    name: string;
    riskScore: number;
}

export function GeoRiskMap({ suppliers }: GeoRiskMapProps) {
    const { geoLocale } = useCurrency();
    const userAlpha3 = useMemo(() => getAlpha3(geoLocale.country), [geoLocale.country]);

    const supplierCountryRisk = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        for (const s of suppliers) {
            const countryCode = s.countryCode;
            if (countryCode) {
                const alpha3 = getAlpha3(countryCode) || countryCode;
                if (!map[alpha3]) map[alpha3] = { total: 0, count: 0 };
                map[alpha3].total += s.riskScore;
                map[alpha3].count++;
            }
        }
        return Object.fromEntries(
            Object.entries(map).map(([k, v]) => [k, v.total / v.count])
        );
    }, [suppliers]);

    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const highRiskCount = useMemo(() => suppliers.filter(s => s.riskScore > 60).length, [suppliers]);

    const countryLeaders = useMemo(() => {
        return Object.entries(supplierCountryRisk)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [supplierCountryRisk]);

    const regionSummary = useMemo(() => {
        const regions = {
            AMER: { count: 0, highRisk: 0 },
            EMEA: { count: 0, highRisk: 0 },
            APAC: { count: 0, highRisk: 0 },
        };

        for (const supplier of suppliers) {
            let bucket: keyof typeof regions = 'EMEA';
            if (supplier.longitude <= -20) bucket = 'AMER';
            if (supplier.longitude > 60) bucket = 'APAC';

            regions[bucket].count += 1;
            if (supplier.riskScore > 60) regions[bucket].highRisk += 1;
        }

        return regions;
    }, [suppliers]);

    // Converts geo coordinates to a flat world projection for marker placement.
    const markerPosition = (longitude: number, latitude: number) => {
        const x = ((longitude + 180) / 360) * 100;
        const y = ((90 - latitude) / 180) * 100;
        return {
            left: `${Math.min(100, Math.max(0, x))}%`,
            top: `${Math.min(100, Math.max(0, y))}%`,
        };
    };

    return (
        <Card className="h-full border-none shadow-none bg-stone-900 overflow-hidden relative group">
            {/* Title Overlay */}
            <CardHeader className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3">
                <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-emerald-400" />
                    Global Risk Control Tower
                </CardTitle>
                <CardDescription className="text-stone-400 text-[11px]">
                    Monitoring from <span className="text-emerald-400 font-medium">{geoLocale.countryName}</span> &middot; {geoLocale.currencySymbol} {geoLocale.currencyCode}
                </CardDescription>
            </CardHeader>

            {/* Radial glow */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <div className="w-[150%] h-[150%] bg-[radial-gradient(circle,rgba(16,185,129,0.1)_0%,transparent_70%)]" />
            </div>

            {/* Interactive risk surface */}
            <div className="relative w-full h-full min-h-[400px] p-4 pt-20 md:pt-16">
                <div className="relative h-full min-h-[340px] rounded-2xl border border-white/10 bg-gradient-to-b from-stone-800/60 to-stone-900/80 overflow-hidden">
                    <div className="absolute inset-0 opacity-25 bg-[linear-gradient(0deg,transparent_24%,rgba(255,255,255,0.08)_25%,rgba(255,255,255,0.08)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.08)_75%,rgba(255,255,255,0.08)_76%,transparent_77%),linear-gradient(90deg,transparent_24%,rgba(255,255,255,0.08)_25%,rgba(255,255,255,0.08)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.08)_75%,rgba(255,255,255,0.08)_76%,transparent_77%)] bg-[length:40px_40px]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.14),transparent_55%)]" />

                    <div className="absolute left-2 top-2 rounded-md bg-black/40 px-2 py-1 text-[10px] text-stone-300 border border-white/10">AMER</div>
                    <div className="absolute left-1/2 -translate-x-1/2 top-2 rounded-md bg-black/40 px-2 py-1 text-[10px] text-stone-300 border border-white/10">EMEA</div>
                    <div className="absolute right-2 top-2 rounded-md bg-black/40 px-2 py-1 text-[10px] text-stone-300 border border-white/10">APAC</div>

                    {suppliers.map((s) => {
                        const isHighRisk = s.riskScore > 60;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                className="absolute -translate-x-1/2 -translate-y-1/2"
                                style={markerPosition(s.longitude, s.latitude)}
                                onMouseEnter={(e) => {
                                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                    if (rect) {
                                        setTooltip({
                                            x: e.clientX - rect.left,
                                            y: e.clientY - rect.top - 10,
                                            name: s.name,
                                            riskScore: s.riskScore,
                                        });
                                    }
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                aria-label={`${s.name} risk ${s.riskScore}`}
                            >
                                <span className={`relative flex h-3.5 w-3.5 rounded-full border ${isHighRisk ? 'bg-red-500 border-red-900' : 'bg-emerald-500 border-emerald-900'}`}>
                                    {isHighRisk && (
                                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
                                    )}
                                </span>
                            </button>
                        );
                    })}

                    {suppliers.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-400">
                            No supplier geo points available.
                        </div>
                    )}
                </div>

                {/* Marker Tooltip */}
                <AnimatePresence>
                    {tooltip && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute z-30 pointer-events-none bg-black/80 backdrop-blur-lg rounded-lg border border-white/10 px-3 py-2"
                            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
                        >
                            <p className="text-xs font-medium text-white">{tooltip.name}</p>
                            <p className={`text-[10px] ${tooltip.riskScore > 60 ? 'text-red-400' : 'text-emerald-400'}`}>
                                Risk Score: {tooltip.riskScore}/100
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Stats Overlay */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                <div className="bg-black/50 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Geographic Distribution</span>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-xs text-stone-300">Total Suppliers</span>
                            <span className="text-xs font-bold text-white">{suppliers.length}</span>
                        </div>
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-xs text-stone-300">At Risk Clusters</span>
                            <span className="text-xs font-bold text-red-400">{highRiskCount}</span>
                        </div>
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-xs text-stone-300">Home Country</span>
                            <span className="text-xs font-bold text-blue-300">{userAlpha3 || 'N/A'}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <span className="text-[9px] text-stone-500 font-bold uppercase block mb-1">Base Currency</span>
                            <span className="text-sm text-emerald-400 font-bold">
                                {geoLocale.currencySymbol} {geoLocale.currencyCode}
                            </span>
                        </div>
                        <div className="mt-1 pt-1 border-t border-white/5">
                            <span className="text-[9px] text-stone-500 font-bold uppercase block mb-1">Top Hotspot</span>
                            <span className="text-[11px] text-white font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                {highRiskCount > 0
                                    ? `${highRiskCount} Regions at Risk`
                                    : 'No Active Hotspots'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-3">
                    <span className="text-[9px] text-stone-500 font-bold uppercase block mb-2">Risk By Region</span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {Object.entries(regionSummary).map(([region, stats]) => (
                            <div key={region} className="rounded-lg bg-white/5 p-2 border border-white/10">
                                <p className="text-[10px] text-stone-400">{region}</p>
                                <p className="text-sm font-semibold text-white">{stats.count}</p>
                                <p className="text-[10px] text-red-400">{stats.highRisk} high</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 p-3">
                    <span className="text-[9px] text-stone-500 font-bold uppercase block mb-2">Country Hotspots</span>
                    <div className="space-y-1.5">
                        {countryLeaders.length === 0 && (
                            <p className="text-[11px] text-stone-400">No country risk data.</p>
                        )}
                        {countryLeaders.map(([code, risk]) => (
                            <div key={code} className="flex items-center justify-between text-[11px] text-stone-200">
                                <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-stone-400" />
                                    {code}
                                </span>
                                <span className={risk > 60 ? 'text-red-400 font-semibold' : risk > 45 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                                    {Math.round(risk)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-3 flex gap-3 bg-black/40 backdrop-blur-sm p-2 rounded-lg border border-white/5 z-10">
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-blue-800" /> Home Base
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Suppliers (Low Risk)
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Moderate Risk
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> High Risk
                </div>
            </div>
        </Card>
    );
}
