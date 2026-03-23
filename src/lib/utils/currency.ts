import { formatLocalCurrency, getGeoLocale } from '@/lib/utils/geo-currency';

/**
 * Format a value as currency using the geo-detected locale.
 * Falls back to INR for SSR or when detection is unavailable.
 */
export function formatCurrency(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined) return "₹0.00";
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return "₹0.00";

    const geo = getGeoLocale();
    return new Intl.NumberFormat(geo.locale, {
        style: 'currency',
        currency: geo.currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numericAmount);
}

const CURRENCY_LOCALE: Record<string, string> = {
    INR: 'en-IN',
    EUR: 'de-DE',
    USD: 'en-US',
    GBP: 'en-GB',
    JPY: 'ja-JP',
};

export function formatCurrencyByCode(
    amount: number | string | null | undefined,
    currencyCode = 'INR',
): string {
    if (amount === null || amount === undefined) return formatCurrency(0);
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount)) return formatCurrency(0);

    const locale = CURRENCY_LOCALE[currencyCode] || 'en-US';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericAmount);
    } catch {
        return `${numericAmount.toLocaleString(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })} ${currencyCode}`;
    }
}
