'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { convertCurrencyAmount, parseFinanceSettings, type FinanceSettings } from '@/lib/finance';
import {
    type GeoLocale,
    detectUserCountry,
    formatLocalCurrency,
    formatLocalCurrencyCompact,
    getGeoLocale,
    getGeoLocaleForCurrency,
} from '@/lib/utils/geo-currency';

type CurrencyDisplayMode = 'local' | 'reporting';

type CurrencyProviderSettings = {
    defaultCurrency?: string | null;
    exchangeRates?: string | null;
};

interface CurrencyContextValue {
    geoLocale: GeoLocale;
    activeCurrencyCode: string;
    defaultCurrency: string;
    reportingCurrency: string;
    displayMode: CurrencyDisplayMode;
    setCountry: (code: string) => void;
    toggleDisplayMode: () => void;
    formatCurrency: (amount: number | string | null | undefined) => string;
    formatCurrencyCompact: (amount: number | string | null | undefined) => string;
    ready: boolean;
    finance: FinanceSettings;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const COUNTRY_STORAGE_KEY = 'axiom.currency.country';
const DISPLAY_MODE_STORAGE_KEY = 'axiom.currency.mode';

function normalizeAmount(amount: number | string | null | undefined) {
    if (typeof amount === 'number') {
        return Number.isFinite(amount) ? amount : 0;
    }

    const parsed = Number(amount ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function CurrencyProvider({
    children,
    initialSettings,
}: {
    children: React.ReactNode;
    initialSettings?: CurrencyProviderSettings;
}) {
    const [country, setCountryState] = useState<string>('IN');
    const [displayMode, setDisplayMode] = useState<CurrencyDisplayMode>('local');
    const [ready, setReady] = useState(false);
    const finance = useMemo(
        () => parseFinanceSettings(initialSettings?.exchangeRates, initialSettings?.defaultCurrency || 'INR'),
        [initialSettings?.defaultCurrency, initialSettings?.exchangeRates],
    );

    useEffect(() => {
        queueMicrotask(() => {
            const detected = detectUserCountry();
            const storedCountry = window.localStorage.getItem(COUNTRY_STORAGE_KEY);
            const storedMode = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);

            setCountryState((storedCountry || detected).toUpperCase());

            if (storedMode === 'local' || storedMode === 'reporting') {
                setDisplayMode(storedMode);
            }

            setReady(true);
        });
    }, []);

    const localGeoLocale = useMemo(() => getGeoLocale(country), [country]);
    const reportingGeoLocale = useMemo(
        () => getGeoLocaleForCurrency(finance.reportingCurrency, country),
        [country, finance.reportingCurrency],
    );
    const geoLocale = displayMode === 'reporting' ? reportingGeoLocale : localGeoLocale;

    const convertAmount = useCallback((amount: number | string | null | undefined) => {
        const normalizedAmount = normalizeAmount(amount);
        const targetCurrency = displayMode === 'reporting'
            ? finance.reportingCurrency
            : localGeoLocale.currencyCode;

        return convertCurrencyAmount(
            normalizedAmount,
            finance.defaultCurrency,
            targetCurrency,
            finance,
            { preferBookRates: displayMode === 'reporting' },
        );
    }, [displayMode, finance, localGeoLocale.currencyCode]);

    const formatCurrencyFn = useCallback(
        (amount: number | string | null | undefined) => formatLocalCurrency(convertAmount(amount), geoLocale),
        [convertAmount, geoLocale],
    );

    const formatCurrencyCompactFn = useCallback(
        (amount: number | string | null | undefined) => formatLocalCurrencyCompact(convertAmount(amount), geoLocale),
        [convertAmount, geoLocale],
    );

    const setCountry = useCallback((code: string) => {
        const normalizedCode = code.toUpperCase();
        setCountryState(normalizedCode);
        window.localStorage.setItem(COUNTRY_STORAGE_KEY, normalizedCode);
    }, []);

    const toggleDisplayMode = useCallback(() => {
        setDisplayMode((currentMode) => {
            const nextMode = currentMode === 'local' ? 'reporting' : 'local';
            window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, nextMode);
            return nextMode;
        });
    }, []);

    const value = useMemo<CurrencyContextValue>(() => ({
        geoLocale,
        activeCurrencyCode: geoLocale.currencyCode,
        defaultCurrency: finance.defaultCurrency,
        reportingCurrency: finance.reportingCurrency,
        displayMode,
        setCountry,
        toggleDisplayMode,
        formatCurrency: formatCurrencyFn,
        formatCurrencyCompact: formatCurrencyCompactFn,
        ready,
        finance,
    }), [displayMode, finance, formatCurrencyCompactFn, formatCurrencyFn, geoLocale, ready, setCountry, toggleDisplayMode]);

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency(): CurrencyContextValue {
    const ctx = useContext(CurrencyContext);
    if (!ctx) {
        const geo = getGeoLocale('IN');
        const finance = parseFinanceSettings(null, 'INR');
        return {
            geoLocale: geo,
            activeCurrencyCode: geo.currencyCode,
            defaultCurrency: 'INR',
            reportingCurrency: finance.reportingCurrency,
            displayMode: 'local',
            setCountry: () => {},
            toggleDisplayMode: () => {},
            formatCurrency: (amount) => formatLocalCurrency(amount, geo),
            formatCurrencyCompact: (amount) => formatLocalCurrencyCompact(amount, geo),
            ready: false,
            finance,
        };
    }
    return ctx;
}
