import test from 'node:test';
import assert from 'node:assert/strict';

import {
    coerceMoney,
    normalizeDateToIso,
    normalizeInvoiceExtraction,
} from '../../src/lib/invoices/normalization';

test('coerceMoney handles common invoice amount formats', () => {
    assert.equal(coerceMoney('₹1,23,456.78'), 123456.78);
    assert.equal(coerceMoney('$1,234.50'), 1234.5);
    assert.equal(coerceMoney('1.234,56 EUR'), 1234.56);
});

test('normalizeDateToIso handles ISO and day-first invoice dates', () => {
    assert.equal(normalizeDateToIso('2026-04-23'), '2026-04-23');
    assert.equal(normalizeDateToIso('23/04/2026'), '2026-04-23');
    assert.equal(normalizeDateToIso('03/04/2026'), '2026-04-03');
});

test('normalizeInvoiceExtraction coerces model output into UI-safe invoice data', () => {
    const normalized = normalizeInvoiceExtraction({
        invoiceNo: ' INV-42 ',
        amount: 'INR 1,000.00',
        currency: 'rupees',
        supplierName: ' Example Vendor ',
        invoiceDate: '23/04/2026',
        tax: '180',
        items: [
            { description: 'Motor assembly', quantity: '2', unit_price: '410', amount: '820' },
            { description: '', quantity: '', unitPrice: '', totalPrice: '' },
        ],
    });

    assert.equal(normalized.invoiceNumber, 'INV-42');
    assert.equal(normalized.amount, 1000);
    assert.equal(normalized.currency, 'INR');
    assert.equal(normalized.supplierName, 'Example Vendor');
    assert.equal(normalized.invoiceDate, '2026-04-23');
    assert.equal(normalized.taxAmount, 180);
    assert.deepEqual(normalized.lineItems, [
        { description: 'Motor assembly', quantity: 2, unitPrice: 410, totalPrice: 820 },
    ]);
});
