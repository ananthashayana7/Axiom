import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateThreeWayMatchStatus,
    getThreeWayMatchReasonLabel,
    getThreeWayMatchSuccessCriteria,
} from '../../src/lib/utils/three-way-match';
import { formatCurrencyByCode } from '../../src/lib/utils/currency';

test('calculateThreeWayMatchStatus returns matched only when receipt, qc, and price match are all satisfied', () => {
    const result = calculateThreeWayMatchStatus({
        poAmount: 1000,
        invoiceAmounts: [400, 600],
        hasReceipt: true,
        qcPassed: true,
    });

    assert.equal(result.isMatched, true);
    assert.equal(result.status, 'matched');
    assert.equal(result.reason, 'MATCHED');
});

test('calculateThreeWayMatchStatus marks mismatched invoices as disputed', () => {
    const result = calculateThreeWayMatchStatus({
        poAmount: 1000,
        invoiceAmounts: [1100],
        hasReceipt: true,
        qcPassed: true,
    });

    assert.equal(result.isMatched, false);
    assert.equal(result.status, 'disputed');
    assert.equal(result.reason, 'PRICE_MISMATCH');
});

test('calculateThreeWayMatchStatus explains missing receipt and qc prerequisites', () => {
    const result = calculateThreeWayMatchStatus({
        poAmount: 1000,
        invoiceAmounts: [1000],
        hasReceipt: false,
        qcPassed: false,
    });

    assert.equal(result.status, 'pending');
    assert.equal(result.reason, 'MISSING_RECEIPT');
});

test('three-way match guidance explains the blocking reason and success criteria', () => {
    assert.equal(
        getThreeWayMatchReasonLabel('PRICE_MISMATCH'),
        'Verification is pending because the recorded invoice total does not match the PO amount.',
    );
    assert.equal(
        getThreeWayMatchReasonLabel('MATCHED'),
        'Verification is successful because the PO, receipt/QC, and supplier invoice all align.',
    );
    assert.match(
        getThreeWayMatchSuccessCriteria(),
        /goods receipt is logged.*QC inspection passes.*invoice total matches the PO amount/i,
    );
});

test('formatCurrencyByCode preserves the requested currency code', () => {
    const eur = formatCurrencyByCode(1234.5, 'EUR');
    const inr = formatCurrencyByCode(1234.5, 'INR');

    assert.match(eur, /€|EUR/);
    assert.match(inr, /₹|INR/);
});
