const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

export function formatDateLabel(
    value: Date | string | number | null | undefined,
    fallback = 'N/A',
) {
    if (!value) {
        return fallback;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return shortDateFormatter.format(date);
}
