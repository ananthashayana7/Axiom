const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function normalizeCsvValue(value: unknown) {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();

    let text = String(value);
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    if (CSV_FORMULA_PREFIX.test(text)) {
        text = `'${text}`;
    }

    return text;
}

export function csvEscape(value: unknown) {
    const text = normalizeCsvValue(value);

    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

export function buildCsv(rows: Array<Array<unknown>>, options?: { includeBom?: boolean }) {
    const body = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    return `${options?.includeBom === false ? "" : "\uFEFF"}${body}`;
}
