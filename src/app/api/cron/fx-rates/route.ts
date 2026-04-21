import { NextResponse } from 'next/server';
import { db } from '@/db';
import { platformSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isCronAuthorized } from '@/lib/api-security';
import { withPgAdvisoryLock } from '@/lib/db-locks';

const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

interface FxRates {
    base: string;
    date: string;
    rates: Record<string, number>;
    fetchedAt: string;
}

function parseEcbXml(xml: string): FxRates {
    const dateMatch = xml.match(/time='(\d{4}-\d{2}-\d{2})'/);
    const date = dateMatch?.[1] || new Date().toISOString().split('T')[0];

    const rates: Record<string, number> = { EUR: 1 };
    const rateRegex = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;
    let match;
    while ((match = rateRegex.exec(xml)) !== null) {
        rates[match[1]] = parseFloat(match[2]);
    }

    return {
        base: 'EUR',
        date,
        rates,
        fetchedAt: new Date().toISOString(),
    };
}

export async function GET(req: Request) {
    try {
        if (!isCronAuthorized(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const locked = await withPgAdvisoryLock('cron:fx-rates', async () => {
            const response = await fetch(ECB_URL, {
                headers: { 'Accept': 'application/xml' },
                next: { revalidate: 0 },
                signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) {
                throw new Error(`ECB API returned ${response.status}`);
            }

            const xml = await response.text();
            const fxRates = parseEcbXml(xml);

            if (Object.keys(fxRates.rates).length <= 1) {
                throw new Error('No exchange rates parsed from ECB response');
            }

            const [existing] = await db.select().from(platformSettings).limit(1);
            if (existing) {
                await db
                    .update(platformSettings)
                    .set({ exchangeRates: JSON.stringify(fxRates) })
                    .where(eq(platformSettings.id, existing.id));
            }

            return NextResponse.json({
                success: true,
                currencyCount: Object.keys(fxRates.rates).length,
                date: fxRates.date,
                sampleRates: {
                    USD: fxRates.rates['USD'],
                    GBP: fxRates.rates['GBP'],
                    INR: fxRates.rates['INR'],
                    JPY: fxRates.rates['JPY'],
                },
            });
        });

        if (!locked.acquired) {
            return NextResponse.json({ success: true, skipped: true, reason: 'already_running' }, { status: 202 });
        }

        return locked.value;
    } catch (error) {
        console.error('[FX Rates] Fetch failed:', error);
        return NextResponse.json(
            { error: 'Failed to fetch exchange rates', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 },
        );
    }
}
