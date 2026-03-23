import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPmaId } from '../../src/lib/utils/format-id';

test('formatPmaId formats known entity prefixes with provided dates', () => {
    assert.equal(
        formatPmaId('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'order', '2026-03-15T12:00:00.000Z'),
        'PMA-ORD-2026-03-A1B2C3',
    );
});

test('formatPmaId falls back to a derived prefix for unknown entity types', () => {
    assert.equal(
        formatPmaId('12345678-1234-5678-9999-abcdefabcdef', 'supplier', '2025-12-01T00:00:00.000Z'),
        'PMA-SUP-2025-12-123456',
    );
});

test('formatPmaId uses the current month when createdAt is omitted', () => {
    const id = formatPmaId('abcdef12-3456-7890-abcd-ef1234567890', 'receipt');
    assert.match(id, /^PMA-GRN-\d{4}-\d{2}-ABCDEF$/);
});
