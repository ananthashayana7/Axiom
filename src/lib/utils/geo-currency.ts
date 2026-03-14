/**
 * Geo-Currency Detection Utility
 * ─────────────────────────────────
 * Auto-detects the user's country from browser locale / timezone
 * and maps it to the correct currency code + symbol + locale.
 *
 * No conversion is performed — amounts are displayed in the local currency.
 */

/* ─── Country → Currency Mapping (ISO 4217) ─── */
const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string; locale: string }> = {
    IN: { code: 'INR', symbol: '₹', locale: 'en-IN' },
    DE: { code: 'EUR', symbol: '€', locale: 'de-DE' },
    FR: { code: 'EUR', symbol: '€', locale: 'fr-FR' },
    IT: { code: 'EUR', symbol: '€', locale: 'it-IT' },
    ES: { code: 'EUR', symbol: '€', locale: 'es-ES' },
    NL: { code: 'EUR', symbol: '€', locale: 'nl-NL' },
    BE: { code: 'EUR', symbol: '€', locale: 'nl-BE' },
    AT: { code: 'EUR', symbol: '€', locale: 'de-AT' },
    PT: { code: 'EUR', symbol: '€', locale: 'pt-PT' },
    IE: { code: 'EUR', symbol: '€', locale: 'en-IE' },
    FI: { code: 'EUR', symbol: '€', locale: 'fi-FI' },
    GR: { code: 'EUR', symbol: '€', locale: 'el-GR' },
    US: { code: 'USD', symbol: '$', locale: 'en-US' },
    GB: { code: 'GBP', symbol: '£', locale: 'en-GB' },
    JP: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
    CN: { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
    KR: { code: 'KRW', symbol: '₩', locale: 'ko-KR' },
    AU: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
    CA: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
    BR: { code: 'BRL', symbol: 'R$', locale: 'pt-BR' },
    MX: { code: 'MXN', symbol: 'MX$', locale: 'es-MX' },
    ZA: { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
    AE: { code: 'AED', symbol: 'د.إ', locale: 'ar-AE' },
    SA: { code: 'SAR', symbol: '﷼', locale: 'ar-SA' },
    SG: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
    MY: { code: 'MYR', symbol: 'RM', locale: 'ms-MY' },
    TH: { code: 'THB', symbol: '฿', locale: 'th-TH' },
    ID: { code: 'IDR', symbol: 'Rp', locale: 'id-ID' },
    PH: { code: 'PHP', symbol: '₱', locale: 'en-PH' },
    VN: { code: 'VND', symbol: '₫', locale: 'vi-VN' },
    RU: { code: 'RUB', symbol: '₽', locale: 'ru-RU' },
    TR: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
    CH: { code: 'CHF', symbol: 'CHF', locale: 'de-CH' },
    SE: { code: 'SEK', symbol: 'kr', locale: 'sv-SE' },
    NO: { code: 'NOK', symbol: 'kr', locale: 'nb-NO' },
    DK: { code: 'DKK', symbol: 'kr', locale: 'da-DK' },
    PL: { code: 'PLN', symbol: 'zł', locale: 'pl-PL' },
    CZ: { code: 'CZK', symbol: 'Kč', locale: 'cs-CZ' },
    HU: { code: 'HUF', symbol: 'Ft', locale: 'hu-HU' },
    NZ: { code: 'NZD', symbol: 'NZ$', locale: 'en-NZ' },
    HK: { code: 'HKD', symbol: 'HK$', locale: 'en-HK' },
    TW: { code: 'TWD', symbol: 'NT$', locale: 'zh-TW' },
    IL: { code: 'ILS', symbol: '₪', locale: 'he-IL' },
    EG: { code: 'EGP', symbol: 'E£', locale: 'ar-EG' },
    NG: { code: 'NGN', symbol: '₦', locale: 'en-NG' },
    KE: { code: 'KES', symbol: 'KSh', locale: 'en-KE' },
    PK: { code: 'PKR', symbol: '₨', locale: 'en-PK' },
    BD: { code: 'BDT', symbol: '৳', locale: 'bn-BD' },
    LK: { code: 'LKR', symbol: 'Rs', locale: 'si-LK' },
    CO: { code: 'COP', symbol: 'COL$', locale: 'es-CO' },
    AR: { code: 'ARS', symbol: 'AR$', locale: 'es-AR' },
    CL: { code: 'CLP', symbol: 'CL$', locale: 'es-CL' },
    PE: { code: 'PEN', symbol: 'S/', locale: 'es-PE' },
};

/* ─── Timezone → Country Heuristic ─── */
const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
    'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Mumbai': 'IN',
    'Europe/Berlin': 'DE', 'Europe/Munich': 'DE',
    'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
    'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Vienna': 'AT',
    'Europe/Lisbon': 'PT', 'Europe/Dublin': 'IE', 'Europe/Helsinki': 'FI',
    'Europe/Athens': 'GR', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Istanbul': 'TR',
    'Europe/Moscow': 'RU', 'Europe/London': 'GB',
    'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
    'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
    'America/Toronto': 'CA', 'America/Vancouver': 'CA',
    'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
    'America/Bogota': 'CO', 'America/Argentina/Buenos_Aires': 'AR',
    'America/Santiago': 'CL', 'America/Lima': 'PE',
    'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK',
    'Asia/Seoul': 'KR', 'Asia/Taipei': 'TW', 'Asia/Singapore': 'SG',
    'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID',
    'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Karachi': 'PK',
    'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Dubai': 'AE',
    'Asia/Riyadh': 'SA', 'Asia/Jerusalem': 'IL',
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
    'Pacific/Auckland': 'NZ',
    'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
    'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
};

export interface GeoLocale {
    country: string;          // ISO 2-char country code
    countryName: string;      // Human-readable
    currencyCode: string;     // e.g. 'EUR', 'INR', 'USD'
    currencySymbol: string;   // e.g. '€', '₹', '$'
    locale: string;           // Intl locale string, e.g. 'de-DE'
}

const COUNTRY_NAMES: Record<string, string> = {
    IN: 'India', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
    NL: 'Netherlands', BE: 'Belgium', AT: 'Austria', PT: 'Portugal',
    IE: 'Ireland', FI: 'Finland', GR: 'Greece', US: 'United States',
    GB: 'United Kingdom', JP: 'Japan', CN: 'China', KR: 'South Korea',
    AU: 'Australia', CA: 'Canada', BR: 'Brazil', MX: 'Mexico',
    ZA: 'South Africa', AE: 'UAE', SA: 'Saudi Arabia', SG: 'Singapore',
    MY: 'Malaysia', TH: 'Thailand', ID: 'Indonesia', PH: 'Philippines',
    VN: 'Vietnam', RU: 'Russia', TR: 'Turkey', CH: 'Switzerland',
    SE: 'Sweden', NO: 'Norway', DK: 'Denmark', PL: 'Poland',
    CZ: 'Czech Republic', HU: 'Hungary', NZ: 'New Zealand',
    HK: 'Hong Kong', TW: 'Taiwan', IL: 'Israel', EG: 'Egypt',
    NG: 'Nigeria', KE: 'Kenya', PK: 'Pakistan', BD: 'Bangladesh',
    LK: 'Sri Lanka', CO: 'Colombia', AR: 'Argentina', CL: 'Chile', PE: 'Peru',
};

/** Detect user country from browser environment (client-side only) */
export function detectUserCountry(): string {
    if (typeof window === 'undefined') return 'IN'; // SSR fallback

    // 1. Check timezone → country mapping
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const fromTz = TIMEZONE_COUNTRY_MAP[tz];
        if (fromTz) return fromTz;
    } catch { /* ignore */ }

    // 2. Infer from navigator language (e.g. 'de-DE' → 'DE', 'en-IN' → 'IN')
    try {
        const langs = navigator.languages || [navigator.language];
        for (const lang of langs) {
            const parts = lang.split('-');
            if (parts.length >= 2) {
                const regionCode = parts[parts.length - 1].toUpperCase();
                if (COUNTRY_CURRENCY_MAP[regionCode]) return regionCode;
            }
        }
    } catch { /* ignore */ }

    return 'IN'; // Ultimate fallback
}

/** Get full geo-locale info for a country code */
export function getGeoLocale(countryCode?: string): GeoLocale {
    const cc = countryCode || detectUserCountry();
    const entry = COUNTRY_CURRENCY_MAP[cc] || COUNTRY_CURRENCY_MAP['IN'];
    return {
        country: cc,
        countryName: COUNTRY_NAMES[cc] || cc,
        currencyCode: entry.code,
        currencySymbol: entry.symbol,
        locale: entry.locale,
    };
}

/** Format a number as currency for the detected/specified locale */
export function formatLocalCurrency(
    amount: number | string | null | undefined,
    geoLocale?: GeoLocale
): string {
    const geo = geoLocale || getGeoLocale();
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    if (isNaN(num)) return `${geo.currencySymbol}0`;

    return new Intl.NumberFormat(geo.locale, {
        style: 'currency',
        currency: geo.currencyCode,
        maximumFractionDigits: 0,
    }).format(num);
}

/** Compact format (e.g. ₹1.2Cr, €1.5M, $2.3K) */
export function formatLocalCurrencyCompact(
    amount: number | string | null | undefined,
    geoLocale?: GeoLocale
): string {
    const geo = geoLocale || getGeoLocale();
    const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    if (isNaN(num)) return `${geo.currencySymbol}0`;
    const abs = Math.abs(num);

    // For INR use Indian number system (Lakh/Crore)
    if (geo.currencyCode === 'INR') {
        if (abs >= 1e7) return `${geo.currencySymbol}${(num / 1e7).toFixed(2)}Cr`;
        if (abs >= 1e5) return `${geo.currencySymbol}${(num / 1e5).toFixed(2)}L`;
        if (abs >= 1e3) return `${geo.currencySymbol}${(num / 1e3).toFixed(1)}K`;
        return `${geo.currencySymbol}${num.toFixed(0)}`;
    }

    // For all others use Western system (K/M/B)
    if (abs >= 1e9) return `${geo.currencySymbol}${(num / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${geo.currencySymbol}${(num / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${geo.currencySymbol}${(num / 1e3).toFixed(1)}K`;
    return `${geo.currencySymbol}${num.toFixed(0)}`;
}

/** React hook-friendly: returns memoization-safe country code */
export function getUserCountryCode(): string {
    return detectUserCountry();
}

/** Get the ISO 3166-1 alpha-3 code (needed for react-simple-maps) */
const ALPHA2_TO_ALPHA3: Record<string, string> = {
    IN: 'IND', DE: 'DEU', FR: 'FRA', IT: 'ITA', ES: 'ESP',
    NL: 'NLD', BE: 'BEL', AT: 'AUT', PT: 'PRT', IE: 'IRL',
    FI: 'FIN', GR: 'GRC', US: 'USA', GB: 'GBR', JP: 'JPN',
    CN: 'CHN', KR: 'KOR', AU: 'AUS', CA: 'CAN', BR: 'BRA',
    MX: 'MEX', ZA: 'ZAF', AE: 'ARE', SA: 'SAU', SG: 'SGP',
    MY: 'MYS', TH: 'THA', ID: 'IDN', PH: 'PHL', VN: 'VNM',
    RU: 'RUS', TR: 'TUR', CH: 'CHE', SE: 'SWE', NO: 'NOR',
    DK: 'DNK', PL: 'POL', CZ: 'CZE', HU: 'HUN', NZ: 'NZL',
    HK: 'HKG', TW: 'TWN', IL: 'ISR', EG: 'EGY', NG: 'NGA',
    KE: 'KEN', PK: 'PAK', BD: 'BGD', LK: 'LKA', CO: 'COL',
    AR: 'ARG', CL: 'CHL', PE: 'PER',
};

export function getAlpha3(alpha2: string): string {
    return ALPHA2_TO_ALPHA3[alpha2.toUpperCase()] || alpha2;
}

/** Get all supported country codes */
export function getAllCountryCodes(): string[] {
    return Object.keys(COUNTRY_CURRENCY_MAP);
}
