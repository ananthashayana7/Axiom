import { NextResponse } from 'next/server';
import { db } from '@/db';
import { marketPriceIndex } from '@/db/schema';
import { isCronAuthorized } from '@/lib/api-security';
import { withPgAdvisoryLock } from '@/lib/db-locks';

const COMMODITY_ENDPOINTS = [
    {
        name: 'Metals',
        url: 'https://api.metals.dev/v1/latest?api_key=DEMO&currency=USD&unit=toz',
        parser: parseFreeMetals,
    },
];

function parseFreeMetals(data: unknown): { category: string; commodity: string; price: number; source: string }[] {
    if (!data || typeof data !== 'object' || !('metals' in data) || typeof data.metals !== 'object' || !data.metals) {
        return [];
    }

    return Object.entries(data.metals as Record<string, unknown>)
        .map(([metal, price]) => ({
            category: 'Metals',
            commodity: metal.charAt(0).toUpperCase() + metal.slice(1),
            price: Number(price),
            source: 'metals.dev',
        }))
        .filter((row) => Number.isFinite(row.price) && row.price > 0);
}

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const locked = await withPgAdvisoryLock('cron:commodity-prices', async () => {
            const now = new Date();
            const validFrom = new Date(now);
            validFrom.setHours(0, 0, 0, 0);
            const validTo = new Date(validFrom);
            validTo.setDate(validTo.getDate() + 1);

            const allPrices: { category: string; commodity: string; price: number; source: string }[] = [];

            for (const endpoint of COMMODITY_ENDPOINTS) {
                try {
                    const response = await fetch(endpoint.url, {
                        signal: AbortSignal.timeout(5000),
                        next: { revalidate: 0 },
                    });

                    if (!response.ok) {
                        continue;
                    }

                    const data = await response.json();
                    allPrices.push(...endpoint.parser(data));
                } catch {
                    // Live feed failed. We intentionally keep the benchmark layer unchanged
                    // rather than generating synthetic commodity prices.
                }
            }

            if (allPrices.length === 0) {
                return NextResponse.json({
                    success: false,
                    degraded: true,
                    inserted: 0,
                    totalPrices: 0,
                    reason: 'live_feeds_unavailable',
                    timestamp: now.toISOString(),
                }, { status: 202 });
            }

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
                    inserted += 1;
                } catch {
                    // Ignore duplicate insertions for the same validity window.
                }
            }

            return NextResponse.json({
                success: true,
                inserted,
                totalPrices: allPrices.length,
                categories: [...new Set(allPrices.map((price) => price.category))],
                timestamp: now.toISOString(),
            });
        });

        if (!locked.acquired) {
            return NextResponse.json({ success: true, skipped: true, reason: 'already_running' }, { status: 202 });
        }

        return locked.value;
    } catch (error) {
        console.error('[Commodity Prices] Cron failed:', error);
        return NextResponse.json({ error: 'Commodity price update failed' }, { status: 500 });
    }
}
