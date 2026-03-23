'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { type GeoLocale, getGeoLocale, detectUserCountry, formatLocalCurrency, formatLocalCurrencyCompact } from '@/lib/utils/geo-currency';

interface CurrencyContextValue {
    geoLocale: GeoLocale;
    /** Override the auto-detected country with a manual choice */
    setCountry: (code: string) => void;
    /** Format a number as full currency (e.g. ₹1,23,456, €12.345, $12,345) */
    formatCurrency: (amount: number | string | null | undefined) => string;
    /** Compact currency (e.g. ₹1.2Cr, €1.5M, $2.3K) */
    formatCurrencyCompact: (amount: number | string | null | undefined) => string;
    /** Whether geo detection has finished */
    ready: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [country, setCountryState] = useState<string>('IN');
    const [ready, setReady] = useState(false);

    // Detect on mount (client-side only)
    useEffect(() => {
        queueMicrotask(() => {
            const detected = detectUserCountry();
            setCountryState(detected);
            setReady(true);
        });
    }, []);

    const geoLocale = useMemo(() => getGeoLocale(country), [country]);

    const formatCurrencyFn = useCallback(
        (amount: number | string | null | undefined) => formatLocalCurrency(amount, geoLocale),
        [geoLocale]
    );

    const formatCurrencyCompactFn = useCallback(
        (amount: number | string | null | undefined) => formatLocalCurrencyCompact(amount, geoLocale),
        [geoLocale]
    );

    const setCountry = useCallback((code: string) => {
        setCountryState(code.toUpperCase());
    }, []);

    const value = useMemo<CurrencyContextValue>(() => ({
        geoLocale,
        setCountry,
        formatCurrency: formatCurrencyFn,
        formatCurrencyCompact: formatCurrencyCompactFn,
        ready,
    }), [geoLocale, setCountry, formatCurrencyFn, formatCurrencyCompactFn, ready]);

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
}

/** Hook to access the currency context */
export function useCurrency(): CurrencyContextValue {
    const ctx = useContext(CurrencyContext);
    if (!ctx) {
        // Fallback when provider isn't mounted — use defaults
        const geo = getGeoLocale('IN');
        return {
            geoLocale: geo,
            setCountry: () => {},
            formatCurrency: (a) => formatLocalCurrency(a, geo),
            formatCurrencyCompact: (a) => formatLocalCurrencyCompact(a, geo),
            ready: false,
        };
    }
    return ctx;
}
