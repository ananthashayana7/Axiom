import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCurrency } from '../../src/lib/utils/currency';
import {
    detectUserCountry,
    formatLocalCurrency,
    formatLocalCurrencyCompact,
    getAlpha3,
    getGeoLocale,
} from '../../src/lib/utils/geo-currency';

function mockBrowserEnvironment(timeZone: string, languages: string[]) {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const originalDateTimeFormat = Intl.DateTimeFormat;

    Object.defineProperty(globalThis, 'window', {
        value: {},
        configurable: true,
        writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
        value: { language: languages[0], languages },
        configurable: true,
        writable: true,
    });

    Intl.DateTimeFormat = ((..._args: ConstructorParameters<typeof Intl.DateTimeFormat>) => ({
        resolvedOptions: () => ({ timeZone }),
    })) as unknown as typeof Intl.DateTimeFormat;

    return () => {
        if (originalWindow) {
            Object.defineProperty(globalThis, 'window', originalWindow);
        } else {
            Reflect.deleteProperty(globalThis, 'window');
        }

        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', originalNavigator);
        } else {
            Reflect.deleteProperty(globalThis, 'navigator');
        }

        Intl.DateTimeFormat = originalDateTimeFormat;
    };
}

test('detectUserCountry prefers timezone mapping when available', () => {
    const restore = mockBrowserEnvironment('Europe/Berlin', ['en-US']);
    try {
        assert.equal(detectUserCountry(), 'DE');
    } finally {
        restore();
    }
});

test('detectUserCountry falls back to navigator languages when timezone is unknown', () => {
    const restore = mockBrowserEnvironment('Etc/Unknown', ['en-US', 'fr-FR']);
    try {
        assert.equal(detectUserCountry(), 'US');
    } finally {
        restore();
    }
});

test('formatCurrency integrates browser geo detection for locale-aware output', () => {
    const restore = mockBrowserEnvironment('America/New_York', ['en-US']);
    try {
        assert.equal(formatCurrency(1234.5), '$1,234.50');
    } finally {
        restore();
    }
});

test('geo currency helpers format Indian and western compact values correctly', () => {
    const india = getGeoLocale('IN');
    const unitedStates = getGeoLocale('US');

    assert.equal(formatLocalCurrency('2500.4', india), '₹2,500');
    assert.equal(formatLocalCurrencyCompact(12_500_000, india), '₹1.25Cr');
    assert.equal(formatLocalCurrencyCompact(1_250_000, unitedStates), '$1.25M');
});

test('geo currency helper lookups return stable metadata', () => {
    const germany = getGeoLocale('DE');

    assert.deepEqual(
        {
            country: germany.country,
            currencyCode: germany.currencyCode,
            locale: germany.locale,
            alpha3: getAlpha3('de'),
        },
        {
            country: 'DE',
            currencyCode: 'EUR',
            locale: 'de-DE',
            alpha3: 'DEU',
        },
    );
});
