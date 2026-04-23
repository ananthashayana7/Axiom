const ISO_CURRENCY_CODES = new Set([
    "AED", "AUD", "BRL", "CAD", "CHF", "CNY", "EUR", "GBP", "INR", "JPY",
    "KRW", "MYR", "SEK", "SGD", "THB", "USD",
]);

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
    [/₹|rs\.?|inr/i, "INR"],
    [/\$|usd/i, "USD"],
    [/€|eur/i, "EUR"],
    [/£|gbp/i, "GBP"],
    [/¥|jpy/i, "JPY"],
];

export type NormalizedInvoiceLineItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
};

export type NormalizedInvoiceExtraction = {
    invoiceNumber: string | null;
    amount: number | null;
    currency: string | null;
    supplierName: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    taxAmount: number | null;
    subtotal: number | null;
    lineItems: NormalizedInvoiceLineItem[];
    paymentTerms: string | null;
    purchaseOrderRef: string | null;
};

function cleanText(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const text = String(value).replace(/\s+/g, " ").trim();
    if (!text || /^null$/i.test(text) || /^undefined$/i.test(text) || /^n\/a$/i.test(text)) {
        return null;
    }

    return text;
}

function hasInput(value: unknown): boolean {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

function parseLocalizedNumber(raw: string): number | null {
    let value = raw.trim();
    if (!value) return null;

    value = value.replace(/^\((.*)\)$/, "-$1");
    value = value.replace(/[^\d,.\-]/g, "");

    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");

    if (lastComma >= 0 && lastDot >= 0) {
        value = lastComma > lastDot
            ? value.replace(/\./g, "").replace(",", ".")
            : value.replace(/,/g, "");
    } else if (lastComma >= 0) {
        const parts = value.split(",");
        const decimalPart = parts[parts.length - 1];
        value = parts.length === 2 && decimalPart.length > 0 && decimalPart.length <= 2
            ? `${parts[0]}.${decimalPart}`
            : value.replace(/,/g, "");
    }

    value = value.replace(/(?!^)-/g, "");
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function coerceInvoiceNumber(value: unknown): string | null {
    const text = cleanText(value);
    return text ? text.slice(0, 120) : null;
}

export function coerceMoney(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    const text = cleanText(value);
    if (!text) return null;

    return parseLocalizedNumber(text);
}

export function normalizeCurrencyCode(value: unknown, fallback: string | null = null): string | null {
    const text = cleanText(value);
    if (text) {
        const upper = text.toUpperCase();
        const code = upper.match(/[A-Z]{3}/)?.[0];
        if (code && ISO_CURRENCY_CODES.has(code)) return code;

        for (const [pattern, currency] of CURRENCY_SYMBOLS) {
            if (pattern.test(text)) return currency;
        }
    }

    if (!fallback) return null;
    const normalizedFallback = fallback.toUpperCase();
    return ISO_CURRENCY_CODES.has(normalizedFallback) ? normalizedFallback : null;
}

export function inferCurrencyFromMoneyFields(...values: unknown[]): string | null {
    for (const value of values) {
        const text = cleanText(value);
        if (!text) continue;

        for (const [pattern, currency] of CURRENCY_SYMBOLS) {
            if (pattern.test(text)) return currency;
        }
    }

    return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toIsoDate(year: number, month: number, day: number): string | null {
    if (!isValidDateParts(year, month, day)) return null;

    const yyyy = String(year).padStart(4, "0");
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export function normalizeDateToIso(value: unknown): string | null {
    const text = cleanText(value);
    if (!text) return null;

    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    const separated = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (separated) {
        const first = Number(separated[1]);
        const second = Number(separated[2]);
        const year = Number(separated[3].length === 2 ? `20${separated[3]}` : separated[3]);
        const dayFirst = first > 12 || second <= 12;
        return dayFirst ? toIsoDate(year, second, first) : toIsoDate(year, first, second);
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

export function normalizeInvoiceLineItems(value: unknown): NormalizedInvoiceLineItem[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            if (!item || typeof item !== "object") return null;
            const row = item as Record<string, unknown>;
            const description = cleanText(row.description) || cleanText(row.item) || cleanText(row.name) || "";
            const quantity = coerceMoney(row.quantity) ?? 0;
            const unitPrice = coerceMoney(row.unitPrice ?? row.unit_price ?? row.rate) ?? 0;
            const explicitTotal = coerceMoney(row.totalPrice ?? row.total_price ?? row.amount);
            const totalPrice = explicitTotal ?? quantity * unitPrice;

            if (!description && quantity === 0 && unitPrice === 0 && totalPrice === 0) return null;

            return {
                description: description || "Line item",
                quantity,
                unitPrice,
                totalPrice,
            };
        })
        .filter((item): item is NormalizedInvoiceLineItem => item !== null);
}

export function normalizeInvoiceExtraction(input: unknown): NormalizedInvoiceExtraction {
    const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const amount = coerceMoney(record.amount ?? record.total ?? record.totalAmount);
    const subtotal = coerceMoney(record.subtotal ?? record.subTotal);
    const taxAmount = coerceMoney(record.taxAmount ?? record.tax);

    return {
        invoiceNumber: coerceInvoiceNumber(record.invoiceNumber ?? record.invoiceNo ?? record.invoice_id),
        amount: amount ?? (subtotal !== null && taxAmount !== null ? subtotal + taxAmount : null),
        currency: normalizeCurrencyCode(record.currency, inferCurrencyFromMoneyFields(record.amount, record.subtotal, record.taxAmount) ?? "INR"),
        supplierName: cleanText(record.supplierName ?? record.vendorName ?? record.vendor),
        invoiceDate: normalizeDateToIso(record.invoiceDate ?? record.date),
        dueDate: normalizeDateToIso(record.dueDate),
        taxAmount,
        subtotal,
        lineItems: normalizeInvoiceLineItems(record.lineItems ?? record.items),
        paymentTerms: cleanText(record.paymentTerms),
        purchaseOrderRef: cleanText(record.purchaseOrderRef ?? record.poNumber ?? record.purchaseOrderNumber),
    };
}

export function optionalDecimalString(value: unknown, fieldLabel: string): { value?: string; error?: string } {
    if (!hasInput(value)) return {};

    const parsed = coerceMoney(value);
    if (parsed === null || parsed < 0) {
        return { error: `${fieldLabel} must be a valid non-negative amount` };
    }

    return { value: parsed.toFixed(2) };
}
