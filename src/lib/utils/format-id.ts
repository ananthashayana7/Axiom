/**
 * Generates a PMA-prefixed display ID from a UUID and creation date.
 *
 * Format: PMA-{PREFIX}-{YYYY}-{MM}-{SHORT_ID}
 *
 * Examples:
 *   PMA-ORD-2026-03-A1B2C3
 *   PMA-INV-2025-12-D4E5F6
 *   PMA-CON-2026-01-789ABC
 *   PMA-REQ-2026-03-DEF012
 */

const ENTITY_PREFIX: Record<string, string> = {
    order: 'ORD',
    invoice: 'INV',
    contract: 'CON',
    requisition: 'REQ',
    rfq: 'RFQ',
    receipt: 'GRN',
    part: 'PRT',
};

export function formatPmaId(
    uuid: string,
    entityType: string,
    createdAt?: Date | string | null,
): string {
    const prefix = ENTITY_PREFIX[entityType] || entityType.slice(0, 3).toUpperCase();
    const date = createdAt ? new Date(createdAt) : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // Use first 6 hex chars from UUID for a short readable ID
    const shortId = uuid.replace(/-/g, '').slice(0, 6).toUpperCase();
    return `PMA-${prefix}-${year}-${month}-${shortId}`;
}
