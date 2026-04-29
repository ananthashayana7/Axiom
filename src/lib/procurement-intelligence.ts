type TrendValue = string | null | undefined;

type CarbonProfile = {
    family: string;
    materialFactor: number;
    defaultWeightKg: number;
    manufacturingFactor: number;
    keywords: string[];
};

const CARBON_PROFILES: CarbonProfile[] = [
    {
        family: 'Primary aluminum',
        materialFactor: 12,
        defaultWeightKg: 1.2,
        manufacturingFactor: 1.8,
        keywords: ['aluminum', 'aluminium', 'extrusion', 'die cast'],
    },
    {
        family: 'Stainless steel',
        materialFactor: 6.2,
        defaultWeightKg: 2.4,
        manufacturingFactor: 1.4,
        keywords: ['steel', 'stainless', 'machined', 'fastener', 'bracket'],
    },
    {
        family: 'Engineering plastics',
        materialFactor: 3.6,
        defaultWeightKg: 0.9,
        manufacturingFactor: 0.9,
        keywords: ['plastic', 'polymer', 'injection', 'molding', 'moulding'],
    },
    {
        family: 'Electronics assembly',
        materialFactor: 8.4,
        defaultWeightKg: 0.45,
        manufacturingFactor: 2.4,
        keywords: ['pcb', 'sensor', 'controller', 'chip', 'battery', 'electronics'],
    },
    {
        family: 'Packaging board',
        materialFactor: 1.2,
        defaultWeightKg: 0.3,
        manufacturingFactor: 0.2,
        keywords: ['packaging', 'carton', 'label', 'corrugated'],
    },
    {
        family: 'Industrial chemicals',
        materialFactor: 4.8,
        defaultWeightKg: 0.65,
        manufacturingFactor: 1.1,
        keywords: ['chemical', 'coating', 'adhesive', 'solvent'],
    },
];

const REGION_GROUPS: Record<string, string[]> = {
    domestic: ['IN'],
    regional: ['AE', 'BD', 'LK', 'MY', 'PH', 'PK', 'SG', 'TH', 'VN'],
    europe: ['AT', 'BE', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'GR', 'HU', 'IE', 'IT', 'NL', 'NO', 'PL', 'PT', 'SE', 'TR'],
    americas: ['AR', 'BR', 'CA', 'CL', 'CO', 'MX', 'PE', 'US'],
    eastAsia: ['AU', 'CN', 'HK', 'ID', 'JP', 'KR', 'NZ', 'TW'],
};

export type CarbonEstimate = {
    materialFamily: string;
    estimatedWeightKg: number;
    materialKgCo2e: number;
    manufacturingKgCo2e: number;
    supplierOverheadKgCo2e: number;
    logisticsKgCo2e: number;
    totalKgCo2e: number;
    carbonAdjustedPrice: number;
    confidence: 'high' | 'medium' | 'low';
    sourceLabel: string;
};

export type AdaptiveReorderPlan = {
    baseReorderPoint: number;
    adjustedReorderPoint: number;
    safetyBufferUnits: number;
    targetStock: number;
    recommendedQty: number;
    riskLevel: 'watch' | 'elevated' | 'high';
    reasons: string[];
};

function round(value: number, precision = 2) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

function normalizeText(parts: Array<string | null | undefined>) {
    return parts.filter(Boolean).join(' ').toLowerCase();
}

function pickCarbonProfile(name: string, category: string, description?: string | null) {
    const haystack = normalizeText([name, category, description]);
    const match = CARBON_PROFILES.find((profile) =>
        profile.keywords.some((keyword) => haystack.includes(keyword))
    );

    if (match) return match;

    if (category.toLowerCase().includes('elect')) {
        return CARBON_PROFILES[3];
    }
    if (category.toLowerCase().includes('mach')) {
        return CARBON_PROFILES[1];
    }
    if (category.toLowerCase().includes('plastic')) {
        return CARBON_PROFILES[2];
    }
    if (category.toLowerCase().includes('pack')) {
        return CARBON_PROFILES[4];
    }

    return {
        family: 'Mixed industrial goods',
        materialFactor: 5,
        defaultWeightKg: 1,
        manufacturingFactor: 1,
        keywords: [],
    };
}

function getLogisticsFactor(countryCode?: string | null) {
    const normalized = String(countryCode || '').trim().toUpperCase();
    if (!normalized) return 2.4;
    if (REGION_GROUPS.domestic.includes(normalized)) return 0.5;
    if (REGION_GROUPS.regional.includes(normalized)) return 1.4;
    if (REGION_GROUPS.europe.includes(normalized)) return 3.2;
    if (REGION_GROUPS.americas.includes(normalized)) return 4.6;
    if (REGION_GROUPS.eastAsia.includes(normalized)) return 3.8;
    return 2.8;
}

function getTrendPressure(trend: TrendValue) {
    switch ((trend || 'stable').toLowerCase()) {
        case 'volatile':
            return 0.18;
        case 'up':
            return 0.1;
        case 'down':
            return 0.03;
        default:
            return 0.06;
    }
}

export function estimatePartCarbonFootprint(args: {
    name: string;
    category: string;
    description?: string | null;
    currentPrice?: number;
    supplierCountryCode?: string | null;
    supplierHasPrimaryData?: boolean;
}) {
    const profile = pickCarbonProfile(args.name, args.category, args.description);
    const logisticsKgCo2e = getLogisticsFactor(args.supplierCountryCode);
    const supplierOverheadKgCo2e = args.supplierHasPrimaryData ? 0.8 : 1.6;
    const materialKgCo2e = profile.materialFactor * profile.defaultWeightKg;
    const manufacturingKgCo2e = profile.manufacturingFactor;
    const totalKgCo2e = materialKgCo2e + manufacturingKgCo2e + supplierOverheadKgCo2e + logisticsKgCo2e;
    const carbonAdjustedPrice = round((args.currentPrice || 0) + ((totalKgCo2e / 1000) * 80));
    const profileMatched = CARBON_PROFILES.some((entry) => entry.family === profile.family);

    return {
        materialFamily: profile.family,
        estimatedWeightKg: round(profile.defaultWeightKg),
        materialKgCo2e: round(materialKgCo2e),
        manufacturingKgCo2e: round(manufacturingKgCo2e),
        supplierOverheadKgCo2e: round(supplierOverheadKgCo2e),
        logisticsKgCo2e: round(logisticsKgCo2e),
        totalKgCo2e: round(totalKgCo2e),
        carbonAdjustedPrice,
        confidence: args.supplierHasPrimaryData ? 'high' : profileMatched ? 'medium' : 'low',
        sourceLabel: args.supplierHasPrimaryData
            ? 'Axiom blended supplier disclosure plus category baseline.'
            : 'Axiom category baseline using material, process, and logistics heuristics.',
    } satisfies CarbonEstimate;
}

export function calculateAdaptiveReorderPlan(args: {
    baseReorderPoint?: number | null;
    minStockLevel?: number | null;
    stockLevel: number;
    marketTrend?: TrendValue;
    delayedOpenOrders?: number;
    openOrders?: number;
    forecastDemand?: number;
}) {
    const baseReorderPoint = Math.max(args.baseReorderPoint || 50, 1);
    const minStockLevel = Math.max(args.minStockLevel || 20, 1);
    const delayedOpenOrders = Math.max(args.delayedOpenOrders || 0, 0);
    const openOrders = Math.max(args.openOrders || 0, 0);
    const forecastDemand = Math.max(args.forecastDemand || 0, 0);
    const reasons: string[] = [];

    const delayBuffer = Math.ceil(baseReorderPoint * Math.min(delayedOpenOrders * 0.15, 0.45));
    if (delayBuffer > 0) {
        reasons.push(`${delayedOpenOrders} delayed inbound order${delayedOpenOrders === 1 ? '' : 's'} increased safety stock.`);
    }

    const trendBuffer = Math.ceil(baseReorderPoint * getTrendPressure(args.marketTrend));
    if (trendBuffer > 0 && String(args.marketTrend || 'stable').toLowerCase() !== 'down') {
        reasons.push(`Market trend ${String(args.marketTrend || 'stable').toLowerCase()} added a volatility buffer.`);
    }

    const forecastBuffer = forecastDemand > 0 ? Math.ceil(forecastDemand * 0.25) : 0;
    if (forecastBuffer > 0) {
        reasons.push(`Upcoming forecast demand added ${forecastBuffer} units of proactive cover.`);
    }

    const openOrderBuffer = openOrders >= 3 ? Math.ceil(baseReorderPoint * 0.08) : 0;
    if (openOrderBuffer > 0) {
        reasons.push(`Multiple open orders suggest coordination risk, so reorder coverage was lifted.`);
    }

    const safetyBufferUnits = delayBuffer + trendBuffer + forecastBuffer + openOrderBuffer;
    const adjustedReorderPoint = baseReorderPoint + safetyBufferUnits;
    const targetStock = Math.max(adjustedReorderPoint + minStockLevel, adjustedReorderPoint * 2);
    const recommendedQty = Math.max(targetStock - args.stockLevel, 1);

    let riskLevel: 'watch' | 'elevated' | 'high' = 'watch';
    if (delayedOpenOrders >= 2 || forecastDemand >= baseReorderPoint) {
        riskLevel = 'high';
    } else if (delayedOpenOrders >= 1 || forecastDemand > minStockLevel) {
        riskLevel = 'elevated';
    }

    if (reasons.length === 0) {
        reasons.push('Current inventory is following baseline reorder logic with no elevated supply signal.');
    }

    return {
        baseReorderPoint,
        adjustedReorderPoint,
        safetyBufferUnits,
        targetStock,
        recommendedQty,
        riskLevel,
        reasons,
    } satisfies AdaptiveReorderPlan;
}
