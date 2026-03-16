'use client'

import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    ZoomableGroup,
} from 'react-simple-maps';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Globe, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useCurrency } from '@/components/currency-provider';
import { getAlpha3 } from '@/lib/utils/geo-currency';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

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

// ISO 3166-1 numeric → alpha-3 mapping for TopoJSON
const NUMERIC_TO_ALPHA3: Record<string, string> = {
    '004': 'AFG', '008': 'ALB', '012': 'DZA', '020': 'AND', '024': 'AGO',
    '028': 'ATG', '032': 'ARG', '036': 'AUS', '040': 'AUT', '044': 'BHS',
    '048': 'BHR', '050': 'BGD', '051': 'ARM', '052': 'BRB', '056': 'BEL',
    '064': 'BTN', '068': 'BOL', '070': 'BIH', '072': 'BWA', '076': 'BRA',
    '084': 'BLZ', '090': 'SLB', '096': 'BRN', '100': 'BGR', '104': 'MMR',
    '108': 'BDI', '112': 'BLR', '116': 'KHM', '120': 'CMR', '124': 'CAN',
    '140': 'CAF', '144': 'LKA', '148': 'TCD', '152': 'CHL', '156': 'CHN',
    '158': 'TWN', '170': 'COL', '174': 'COM', '178': 'COG', '180': 'COD',
    '188': 'CRI', '191': 'HRV', '192': 'CUB', '196': 'CYP', '203': 'CZE',
    '204': 'BEN', '208': 'DNK', '212': 'DMA', '214': 'DOM', '218': 'ECU',
    '222': 'SLV', '226': 'GNQ', '231': 'ETH', '232': 'ERI', '233': 'EST',
    '242': 'FJI', '246': 'FIN', '250': 'FRA', '262': 'DJI', '266': 'GAB',
    '268': 'GEO', '270': 'GMB', '276': 'DEU', '288': 'GHA', '300': 'GRC',
    '308': 'GRD', '320': 'GTM', '324': 'GIN', '328': 'GUY', '332': 'HTI',
    '340': 'HND', '348': 'HUN', '352': 'ISL', '356': 'IND', '360': 'IDN',
    '364': 'IRN', '368': 'IRQ', '372': 'IRL', '376': 'ISR', '380': 'ITA',
    '384': 'CIV', '388': 'JAM', '392': 'JPN', '398': 'KAZ', '400': 'JOR',
    '404': 'KEN', '408': 'PRK', '410': 'KOR', '414': 'KWT', '417': 'KGZ',
    '418': 'LAO', '422': 'LBN', '426': 'LSO', '428': 'LVA', '430': 'LBR',
    '434': 'LBY', '440': 'LTU', '442': 'LUX', '450': 'MDG', '454': 'MWI',
    '458': 'MYS', '462': 'MDV', '466': 'MLI', '470': 'MLT', '478': 'MRT',
    '480': 'MUS', '484': 'MEX', '496': 'MNG', '498': 'MDA', '499': 'MNE',
    '504': 'MAR', '508': 'MOZ', '512': 'OMN', '516': 'NAM', '520': 'NRU',
    '524': 'NPL', '528': 'NLD', '540': 'NCL', '548': 'VUT', '554': 'NZL',
    '558': 'NIC', '562': 'NER', '566': 'NGA', '578': 'NOR', '586': 'PAK',
    '591': 'PAN', '598': 'PNG', '600': 'PRY', '604': 'PER', '608': 'PHL',
    '616': 'POL', '620': 'PRT', '624': 'GNB', '626': 'TLS', '630': 'PRI',
    '634': 'QAT', '642': 'ROU', '643': 'RUS', '646': 'RWA', '682': 'SAU',
    '686': 'SEN', '688': 'SRB', '694': 'SLE', '702': 'SGP', '703': 'SVK',
    '704': 'VNM', '705': 'SVN', '706': 'SOM', '710': 'ZAF', '716': 'ZWE',
    '724': 'ESP', '728': 'SSD', '729': 'SDN', '740': 'SUR', '748': 'SWZ',
    '752': 'SWE', '756': 'CHE', '760': 'SYR', '762': 'TJK', '764': 'THA',
    '768': 'TGO', '780': 'TTO', '784': 'ARE', '788': 'TUN', '792': 'TUR',
    '795': 'TKM', '800': 'UGA', '804': 'UKR', '807': 'MKD', '818': 'EGY',
    '826': 'GBR', '834': 'TZA', '840': 'USA', '854': 'BFA', '858': 'URY',
    '860': 'UZB', '862': 'VEN', '887': 'YEM', '894': 'ZMB',
};

function getCountryAlpha3FromGeo(geo: { id?: string; properties?: { ISO_A3?: string } }): string {
    if (geo.properties?.ISO_A3 && geo.properties.ISO_A3 !== '-99') return geo.properties.ISO_A3;
    if (geo.id && NUMERIC_TO_ALPHA3[geo.id]) return NUMERIC_TO_ALPHA3[geo.id];
    return '';
}

// Country center coordinates [lng, lat, zoom]
const COUNTRY_CENTERS: Record<string, [number, number, number]> = {
    IND: [78, 22, 3],   DEU: [10, 51, 5],   FRA: [2, 46, 5],
    GBR: [-2, 54, 5],   USA: [-98, 39, 2.5], JPN: [138, 36, 5],
    CHN: [105, 35, 3],  AUS: [134, -25, 3],  BRA: [-51, -14, 2.5],
    CAN: [-106, 56, 2.5], KOR: [128, 36, 6], SGP: [104, 1.3, 8],
    ARE: [54, 24, 5],   ZAF: [25, -29, 4],   MEX: [-102, 23, 3],
    SAU: [45, 24, 4],   RUS: [90, 62, 2],    TUR: [35, 39, 4],
    IDN: [118, -2, 3],  MYS: [109, 4, 4],    THA: [101, 15, 4],
    PHL: [122, 12, 5],  VNM: [106, 16, 4],   PAK: [69, 30, 4],
    BGD: [90, 24, 6],   LKA: [81, 8, 7],     ITA: [12, 42, 5],
    ESP: [-4, 40, 5],   NLD: [5, 52, 7],     CHE: [8, 47, 7],
    SWE: [16, 62, 4],   NOR: [10, 64, 4],    POL: [20, 52, 5],
    EGY: [30, 27, 4],   NGA: [8, 10, 4],     KEN: [38, 1, 5],
    ARG: [-64, -34, 3], COL: [-74, 4, 4],    CHL: [-71, -33, 3],
    PER: [-76, -10, 4],
};

interface TooltipState {
    x: number;
    y: number;
    name: string;
    riskScore: number;
}

export function GeoRiskMap({ suppliers }: GeoRiskMapProps) {
    const { geoLocale } = useCurrency();
    const userAlpha3 = useMemo(() => getAlpha3(geoLocale.country), [geoLocale.country]);

    // Build a map of alpha3 → average risk score for countries with suppliers
    const supplierCountryRisk = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        for (const s of suppliers) {
            // Try to get country alpha3 from supplier's countryCode field if available
            // We'll match by rough lat/lng proximity to country centers for now
            // Better: use countryCode from supplier data if available
            const countryCode = (s as any).countryCode;
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

    const defaultZoom = useMemo(() => {
        const center = COUNTRY_CENTERS[userAlpha3];
        if (center) return { coordinates: [center[0], center[1]] as [number, number], zoom: center[2] };
        return { coordinates: [0, 20] as [number, number], zoom: 1 };
    }, [userAlpha3]);

    const [position, setPosition] = useState(defaultZoom);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);

    const highRiskCount = useMemo(() => suppliers.filter(s => s.riskScore > 60).length, [suppliers]);

    const handleZoomIn = useCallback(() => {
        setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 12) }));
    }, []);

    const handleZoomOut = useCallback(() => {
        setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }));
    }, []);

    const handleReset = useCallback(() => {
        setPosition(defaultZoom);
    }, [defaultZoom]);

    const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
        setPosition(pos);
    }, []);

    const getCountryFill = (alpha3: string) => {
        const avgRisk = supplierCountryRisk[alpha3];
        if (avgRisk !== undefined) {
            // Color by risk level
            if (avgRisk > 70) return '#ef4444'; // high risk — red
            if (avgRisk > 45) return '#f59e0b'; // medium risk — amber
            return '#10b981'; // low risk — green
        }
        // User's home country gets a subtle blue tint
        if (alpha3 === userAlpha3) return '#1e3a5f';
        return '#292524'; // default
    };

    const getCountryHover = (alpha3: string) => {
        const avgRisk = supplierCountryRisk[alpha3];
        if (avgRisk !== undefined) {
            if (avgRisk > 70) return '#fca5a5';
            if (avgRisk > 45) return '#fcd34d';
            return '#34d399';
        }
        if (alpha3 === userAlpha3) return '#1e40af';
        return '#44403c';
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

            {/* Interactive Map */}
            <div className="relative w-full h-full min-h-[400px]">
                <ComposableMap
                    projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
                    className="w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                >
                    <ZoomableGroup
                        center={position.coordinates}
                        zoom={position.zoom}
                        onMoveEnd={handleMoveEnd}
                        minZoom={1}
                        maxZoom={12}
                    >
                        <Geographies geography={GEO_URL}>
                            {({ geographies }) =>
                                geographies.map((geo) => {
                                    const alpha3 = getCountryAlpha3FromGeo(geo);
                                    const hasSuppliers = supplierCountryRisk[alpha3] !== undefined;
                                    const isUserCountry = alpha3 === userAlpha3;

                                    return (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            onMouseEnter={() => setHoveredGeo(geo.rsmKey)}
                                            onMouseLeave={() => setHoveredGeo(null)}
                                            style={{
                                                default: {
                                                    fill: getCountryFill(alpha3),
                                                    stroke: hasSuppliers ? '#78716c' : isUserCountry ? '#3b82f6' : '#44403c',
                                                    strokeWidth: hasSuppliers ? 0.6 : 0.4,
                                                    outline: 'none',
                                                    transition: 'fill 0.2s ease',
                                                },
                                                hover: {
                                                    fill: getCountryHover(alpha3),
                                                    stroke: '#a8a29e',
                                                    strokeWidth: 0.8,
                                                    outline: 'none',
                                                    cursor: hasSuppliers ? 'pointer' : 'default',
                                                },
                                                pressed: {
                                                    fill: getCountryHover(alpha3),
                                                    stroke: '#a8a29e',
                                                    strokeWidth: 0.8,
                                                    outline: 'none',
                                                },
                                            }}
                                        />
                                    );
                                })
                            }
                        </Geographies>

                        {/* Supplier Risk Markers */}
                        {suppliers.map((s) => {
                            const isHighRisk = s.riskScore > 60;
                            return (
                                <Marker
                                    key={s.id}
                                    coordinates={[s.longitude, s.latitude]}
                                    onMouseEnter={(e) => {
                                        const svg = (e.target as SVGElement).closest('svg');
                                        const rect = svg?.getBoundingClientRect();
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
                                >
                                    {isHighRisk && (
                                        <circle r={4} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.5}>
                                            <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
                                            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                                        </circle>
                                    )}
                                    <circle
                                        r={isHighRisk ? 3.5 : 2.5}
                                        fill={isHighRisk ? '#ef4444' : '#10b981'}
                                        stroke={isHighRisk ? '#991b1b' : '#065f46'}
                                        strokeWidth={0.8}
                                        className="cursor-pointer"
                                    />
                                </Marker>
                            );
                        })}
                    </ZoomableGroup>
                </ComposableMap>

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

            {/* Zoom Controls */}
            <div className="absolute bottom-4 left-3 z-10 flex flex-col gap-1">
                <button onClick={handleZoomIn} className="bg-black/50 backdrop-blur-md rounded-lg border border-white/10 p-1.5 text-stone-300 hover:text-white hover:bg-black/70 transition-colors" aria-label="Zoom in">
                    <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleZoomOut} className="bg-black/50 backdrop-blur-md rounded-lg border border-white/10 p-1.5 text-stone-300 hover:text-white hover:bg-black/70 transition-colors" aria-label="Zoom out">
                    <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleReset} className="bg-black/50 backdrop-blur-md rounded-lg border border-white/10 p-1.5 text-stone-300 hover:text-white hover:bg-black/70 transition-colors" aria-label="Reset view">
                    <RotateCcw className="h-3.5 w-3.5" />
                </button>
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
