export type BookRatePeriod = 'monthly' | 'quarterly';

export type LiveFxSnapshot = {
    base: string;
    date: string;
    rates: Record<string, number>;
    fetchedAt: string;
};

export type FinanceSettings = {
    defaultCurrency: string;
    reportingCurrency: string;
    bookRatePeriod: BookRatePeriod;
    bookRateEffectiveDate: string;
    bookRates: Record<string, number>;
    liveRates: LiveFxSnapshot | null;
};

const DEFAULT_BOOK_RATE_PERIOD: BookRatePeriod = 'monthly';

function buildDefaultEffectiveDate() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function normalizeCurrencyCode(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim()
        ? value.trim().toUpperCase()
        : fallback.toUpperCase();
}

function normalizeBookRates(raw: unknown) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {} as Record<string, number>;
    }

    return Object.entries(raw).reduce<Record<string, number>>((accumulator, [currency, rate]) => {
        const numericRate = typeof rate === 'number' ? rate : Number(rate);
        if (Number.isFinite(numericRate) && numericRate > 0) {
            accumulator[currency.toUpperCase()] = numericRate;
        }
        return accumulator;
    }, {});
}

function parseLiveRates(raw: unknown): LiveFxSnapshot | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }

    const candidate = raw as Partial<LiveFxSnapshot>;
    if (!candidate.base || !candidate.date || !candidate.rates) {
        return null;
    }

    const rates = normalizeBookRates(candidate.rates);
    const base = String(candidate.base).toUpperCase();

    if (!rates[base]) {
        rates[base] = 1;
    }

    return {
        base,
        date: String(candidate.date),
        fetchedAt: candidate.fetchedAt ? String(candidate.fetchedAt) : new Date().toISOString(),
        rates,
    };
}

function parseRawFinanceSettings(raw: string | null | undefined) {
    if (!raw?.trim()) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

function convertViaLiveRates(amount: number, sourceCurrency: string, targetCurrency: string, liveRates: LiveFxSnapshot | null) {
    if (!liveRates) {
        return null;
    }

    const source = sourceCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (source === target) {
        return amount;
    }

    const sourceRate = source === liveRates.base ? 1 : liveRates.rates[source];
    const targetRate = target === liveRates.base ? 1 : liveRates.rates[target];

    if (!sourceRate || !targetRate) {
        return null;
    }

    const amountInBase = amount / sourceRate;
    return amountInBase * targetRate;
}

export function parseFinanceSettings(raw: string | null | undefined, defaultCurrency = 'INR'): FinanceSettings {
    const parsed = parseRawFinanceSettings(raw);
    const normalizedDefaultCurrency = defaultCurrency.toUpperCase();
    const liveRates = parseLiveRates(parsed);
    const reportingCurrency = normalizeCurrencyCode(parsed?.reportingCurrency, normalizedDefaultCurrency);
    const bookRatePeriod = parsed?.bookRatePeriod === 'quarterly' ? 'quarterly' : DEFAULT_BOOK_RATE_PERIOD;
    const bookRateEffectiveDate =
        typeof parsed?.bookRateEffectiveDate === 'string' && parsed.bookRateEffectiveDate
            ? parsed.bookRateEffectiveDate
            : buildDefaultEffectiveDate();
    const bookRates = normalizeBookRates(parsed?.bookRates);

    bookRates[reportingCurrency] = 1;

    if (!bookRates[normalizedDefaultCurrency]) {
        const derivedDefaultRate = convertViaLiveRates(1, normalizedDefaultCurrency, reportingCurrency, liveRates);
        if (derivedDefaultRate && Number.isFinite(derivedDefaultRate) && derivedDefaultRate > 0) {
            bookRates[normalizedDefaultCurrency] = Number(derivedDefaultRate.toFixed(6));
        }
    }

    return {
        defaultCurrency: normalizedDefaultCurrency,
        reportingCurrency,
        bookRatePeriod,
        bookRateEffectiveDate,
        bookRates,
        liveRates,
    };
}

export function serializeFinanceSettings(settings: FinanceSettings) {
    const payload: Record<string, unknown> = {
        reportingCurrency: settings.reportingCurrency,
        bookRatePeriod: settings.bookRatePeriod,
        bookRateEffectiveDate: settings.bookRateEffectiveDate,
        bookRates: settings.bookRates,
    };

    if (settings.liveRates) {
        payload.base = settings.liveRates.base;
        payload.date = settings.liveRates.date;
        payload.fetchedAt = settings.liveRates.fetchedAt;
        payload.rates = settings.liveRates.rates;
    }

    return JSON.stringify(payload);
}

export function mergeFinanceSettings(
    raw: string | null | undefined,
    defaultCurrency: string,
    updates: Partial<Omit<FinanceSettings, 'defaultCurrency'>>,
) {
    const current = parseFinanceSettings(raw, defaultCurrency);

    return serializeFinanceSettings({
        ...current,
        ...updates,
        defaultCurrency: defaultCurrency.toUpperCase(),
        reportingCurrency: normalizeCurrencyCode(updates.reportingCurrency, current.reportingCurrency),
        bookRates: updates.bookRates ?? current.bookRates,
        liveRates: updates.liveRates === undefined ? current.liveRates : updates.liveRates,
    });
}

export function convertCurrencyAmount(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string,
    financeSettings: Pick<FinanceSettings, 'reportingCurrency' | 'bookRates' | 'liveRates'>,
    options?: { preferBookRates?: boolean },
) {
    if (!Number.isFinite(amount)) {
        return 0;
    }

    const source = sourceCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (source === target) {
        return amount;
    }

    if (options?.preferBookRates && target === financeSettings.reportingCurrency.toUpperCase()) {
        const bookRate = financeSettings.bookRates[source];
        if (bookRate && Number.isFinite(bookRate)) {
            return amount * bookRate;
        }
    }

    const liveConverted = convertViaLiveRates(amount, source, target, financeSettings.liveRates);
    if (liveConverted !== null && Number.isFinite(liveConverted)) {
        return liveConverted;
    }

    if (target === financeSettings.reportingCurrency.toUpperCase()) {
        const fallbackBookRate = financeSettings.bookRates[source];
        if (fallbackBookRate && Number.isFinite(fallbackBookRate)) {
            return amount * fallbackBookRate;
        }
    }

    return amount;
}

export function getSuggestedBookRateCurrencies(defaultCurrency: string, reportingCurrency: string) {
    return Array.from(new Set([
        defaultCurrency.toUpperCase(),
        reportingCurrency.toUpperCase(),
        'USD',
        'EUR',
        'GBP',
        'HUF',
        'CNY',
        'JPY',
        'MXN',
    ]));
}
