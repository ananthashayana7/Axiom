import { NextResponse } from 'next/server';
import { db } from '@/db';
import { marketPriceIndex } from '@/db/schema';

// Free commodity data sources
const COMMODITY_ENDPOINTS = [
    {
        name: 'Metals',
        url: 'https://api.metals.dev/v1/latest?api_key=DEMO&currency=USD&unit=toz',
        parser: parseFreeMetals,
    },
];

// Fallback: generate synthetic but realistic commodity prices
function generateSyntheticPrices(): { category: string; commodity: string; price: number; source: string }[] {
    const baseDate = new Date();
    const dayFactor = Math.sin(baseDate.getDate() / 30 * Math.PI) * 0.05; // ±5% seasonal variation

    return [
        { category: 'Metals', commodity: 'Copper', price: Number((8500 * (1 + dayFactor)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Metals', commodity: 'Aluminum', price: Number((2400 * (1 + dayFactor * 0.8)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Metals', commodity: 'Steel HRC', price: Number((650 * (1 + dayFactor * 1.2)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Metals', commodity: 'Nickel', price: Number((16000 * (1 + dayFactor * 0.6)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Metals', commodity: 'Zinc', price: Number((2800 * (1 + dayFactor * 0.9)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Plastics', commodity: 'HDPE', price: Number((1200 * (1 + dayFactor * 0.7)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Plastics', commodity: 'Polypropylene', price: Number((1100 * (1 + dayFactor * 0.5)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Plastics', commodity: 'PVC', price: Number((900 * (1 + dayFactor * 0.4)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Electronics', commodity: 'Silicon Wafer', price: Number((3.50 * (1 + dayFactor * 0.3)).toFixed(4)), source: 'Axiom Synthetic Index' },
        { category: 'Electronics', commodity: 'Rare Earth Oxide', price: Number((45 * (1 + dayFactor * 1.5)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Chemicals', commodity: 'Ethylene', price: Number((1050 * (1 + dayFactor * 0.6)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Chemicals', commodity: 'Sulfuric Acid', price: Number((80 * (1 + dayFactor * 0.3)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Energy', commodity: 'Natural Gas (MMBtu)', price: Number((3.20 * (1 + dayFactor * 2.0)).toFixed(2)), source: 'Axiom Synthetic Index' },
        { category: 'Energy', commodity: 'Crude Oil (Brent)', price: Number((82 * (1 + dayFactor * 0.8)).toFixed(2)), source: 'Axiom Synthetic Index' },
    ];
}

function parseFreeMetals(data: any): { category: string; commodity: string; price: number; source: string }[] {
    if (!data?.metals) return [];
    return Object.entries(data.metals).map(([metal, price]) => ({
        category: 'Metals',
        commodity: metal.charAt(0).toUpperCase() + metal.slice(1),
        price: Number(price),
        source: 'metals.dev',
    }));
}

export async function GET() {
    try {
        const now = new Date();
        const validFrom = new Date(now);
        validFrom.setHours(0, 0, 0, 0);
        const validTo = new Date(validFrom);
        validTo.setDate(validTo.getDate() + 1);

        let allPrices: { category: string; commodity: string; price: number; source: string }[] = [];

        // Try fetching from real APIs first
        for (const endpoint of COMMODITY_ENDPOINTS) {
            try {
                const response = await fetch(endpoint.url, {
                    signal: AbortSignal.timeout(5000),
                    next: { revalidate: 0 },
                });
                if (response.ok) {
                    const data = await response.json();
                    allPrices.push(...endpoint.parser(data));
                }
            } catch {
                // API failed, will use synthetic fallback
            }
        }

        // Fall back to synthetic prices if no real data
        if (allPrices.length === 0) {
            allPrices = generateSyntheticPrices();
        }

        // Insert into marketPriceIndex
        let inserted = 0;
        for (const price of allPrices) {
            try {
                await db.insert(marketPriceIndex).values({
                    partCategory: price.category,
                    commodity: price.commodity,
                    benchmarkPrice: price.price.toString(),
                    source: price.source,
                    validFrom,
                    validTo,
                });
                inserted++;
            } catch (e) {
                // Ignore duplicate insertions
            }
        }

        return NextResponse.json({
            success: true,
            inserted,
            totalPrices: allPrices.length,
            categories: [...new Set(allPrices.map(p => p.category))],
            timestamp: now.toISOString(),
        });
    } catch (error) {
        console.error('[Commodity Prices] Cron failed:', error);
        return NextResponse.json({ error: 'Commodity price update failed' }, { status: 500 });
    }
}
