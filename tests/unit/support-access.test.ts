import assert from 'node:assert/strict';
import test from 'node:test';

import { canManageSupportTickets, SUPPORT_FAQS } from '../../src/lib/support';

test('only admins can access support ticket management', () => {
    assert.equal(canManageSupportTickets('admin'), true);
    assert.equal(canManageSupportTickets('user'), false);
    assert.equal(canManageSupportTickets('supplier'), false);
    assert.equal(canManageSupportTickets(), false);
});

test('shared support FAQs remain available as general guidance', () => {
    assert.ok(SUPPORT_FAQS.length > 0);
    assert.ok(SUPPORT_FAQS.some((faq) => faq.q.includes('reset my password')));
    assert.ok(SUPPORT_FAQS.some((faq) => faq.q.includes('Supplier Portal')));
});
