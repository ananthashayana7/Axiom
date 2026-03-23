export interface InfographicMonthlyDatum {
    [key: string]: string | number | undefined;
    name: string;
    total: number;
    orders?: number;
}

export interface InfographicCategoryDatum {
    [key: string]: string | number | undefined;
    name: string;
    value: number;
    count?: number;
}

export interface InfographicSupplierDatum {
    [key: string]: string | number | undefined;
    name: string;
    spend: number;
    orders: number;
    reliability: number;
}

export interface InfographicRiskSupplierDatum {
    id: string;
    name: string;
    riskScore: number | null;
}

export function getPeakSpendMonth(monthlyData: InfographicMonthlyDatum[]) {
    return monthlyData.reduce<InfographicMonthlyDatum | null>((peak, item) => {
        if (!peak || item.total > peak.total) return item;
        return peak;
    }, null);
}

export function getSpendMomentum(monthlyData: InfographicMonthlyDatum[]) {
    const current = monthlyData.at(-1);
    const previous = monthlyData.at(-2);

    if (!current) {
        return { change: null, current: null, previous: null };
    }

    if (!previous || previous.total <= 0) {
        return { change: null, current, previous: previous ?? null };
    }

    return {
        change: ((current.total - previous.total) / previous.total) * 100,
        current,
        previous,
    };
}

export function buildCategoryMix(categoryData: InfographicCategoryDatum[], maxSegments = 5) {
    const sorted = [...categoryData].sort((a, b) => b.value - a.value);

    if (sorted.length <= maxSegments) return sorted;

    const visible = sorted.slice(0, maxSegments - 1);
    const otherValue = sorted.slice(maxSegments - 1).reduce((total, item) => total + item.value, 0);

    return [
        ...visible,
        {
            name: "Others",
            value: otherValue,
            count: sorted.slice(maxSegments - 1).reduce((total, item) => total + (item.count ?? 0), 0),
        },
    ];
}

export function getInfographicHighlights(params: {
    monthlyData: InfographicMonthlyDatum[];
    categoryData: InfographicCategoryDatum[];
    supplierData: InfographicSupplierDatum[];
    riskySuppliers: InfographicRiskSupplierDatum[];
    totalSpend: number;
    supplierCount: number;
}) {
    const { monthlyData, categoryData, supplierData, riskySuppliers, totalSpend, supplierCount } = params;
    const peakMonth = getPeakSpendMonth(monthlyData);
    const momentum = getSpendMomentum(monthlyData);
    const criticalSuppliers = riskySuppliers.filter((supplier) => Number(supplier.riskScore ?? 0) >= 60).length;
    const topSupplier = [...supplierData].sort((a, b) => b.spend - a.spend)[0] ?? null;

    return {
        peakMonth,
        momentum,
        criticalSuppliers,
        topSupplier,
        activeCategories: categoryData.length,
        totalSpend,
        supplierCount,
    };
}
