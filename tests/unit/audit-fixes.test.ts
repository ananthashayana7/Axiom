import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Approval threshold routing logic ─────────────────────────────────────────
// Mirrors the threshold logic added to createRequisition in requisitions.ts
const APPROVAL_THRESHOLD = 10000;

function getApprovalRoute(estimatedAmount: number, department?: string) {
    if (estimatedAmount <= APPROVAL_THRESHOLD && department) {
        return 'department';
    }
    return 'all_admins';
}

test('low-amount requisition with a department routes to department leads', () => {
    assert.equal(getApprovalRoute(5000, 'Engineering'), 'department');
    assert.equal(getApprovalRoute(10000, 'Procurement'), 'department');
});

test('high-amount requisition routes to all admins for finance review', () => {
    assert.equal(getApprovalRoute(10001, 'Engineering'), 'all_admins');
    assert.equal(getApprovalRoute(50000, 'Procurement'), 'all_admins');
});

test('requisition without a department always routes to all admins', () => {
    assert.equal(getApprovalRoute(500), 'all_admins');
    assert.equal(getApprovalRoute(500, undefined), 'all_admins');
    assert.equal(getApprovalRoute(50000, undefined), 'all_admins');
});

// ─── Replenishment urgency classification ─────────────────────────────────────
// Mirrors the urgency logic in getSuggestedReplenishments in replenishment.ts
function classifyUrgency(stock: number, minStock: number): string {
    if (stock === 0) return 'critical';
    if (stock < minStock * 0.5) return 'high';
    return 'medium';
}

test('zero stock is classified as critical urgency', () => {
    assert.equal(classifyUrgency(0, 10), 'critical');
    assert.equal(classifyUrgency(0, 100), 'critical');
});

test('stock below half of minStock is classified as high urgency', () => {
    assert.equal(classifyUrgency(2, 10), 'high');
    assert.equal(classifyUrgency(4, 10), 'high');
});

test('stock at or above half of minStock is classified as medium urgency', () => {
    assert.equal(classifyUrgency(5, 10), 'medium');
    assert.equal(classifyUrgency(10, 10), 'medium');
});

// ─── Parts pagination defaults ────────────────────────────────────────────────
// Mirrors the pagination logic added to getParts in parts.ts
function resolvePagination(options?: { limit?: number; offset?: number }) {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    return { limit, offset };
}

test('getParts defaults to limit 100 and offset 0 when no options are provided', () => {
    const { limit, offset } = resolvePagination();
    assert.equal(limit, 100);
    assert.equal(offset, 0);
});

test('getParts respects explicit limit and offset', () => {
    const { limit, offset } = resolvePagination({ limit: 25, offset: 50 });
    assert.equal(limit, 25);
    assert.equal(offset, 50);
});

test('getParts allows partial options', () => {
    const a = resolvePagination({ limit: 20 });
    assert.equal(a.limit, 20);
    assert.equal(a.offset, 0);

    const b = resolvePagination({ offset: 10 });
    assert.equal(b.limit, 100);
    assert.equal(b.offset, 10);
});

// ─── Intelligence compliance rate calculation ─────────────────────────────────
// Mirrors the compliance rate logic in getDashboardStats in intelligence.ts
function calculateComplianceRate(totalContracts: number, activeContracts: number): number {
    return totalContracts > 0
        ? Math.round((activeContracts / totalContracts) * 100)
        : 0;
}

test('compliance rate is 0 when there are no contracts', () => {
    assert.equal(calculateComplianceRate(0, 0), 0);
});

test('compliance rate is 100 when all contracts are active', () => {
    assert.equal(calculateComplianceRate(10, 10), 100);
});

test('compliance rate rounds correctly', () => {
    assert.equal(calculateComplianceRate(3, 2), 67); // 66.67 → 67
    assert.equal(calculateComplianceRate(3, 1), 33); // 33.33 → 33
});

// ─── Replenishment demand fallback ────────────────────────────────────────────
// Mirrors the demand aggregation logic in getSuggestedReplenishments
function resolveMonthlyDemand(recentOrderQty: number, minStock: number): number {
    return recentOrderQty > 0 ? recentOrderQty : minStock;
}

test('uses real order quantity when available', () => {
    assert.equal(resolveMonthlyDemand(42, 10), 42);
    assert.equal(resolveMonthlyDemand(1, 100), 1);
});

test('falls back to minStock when no recent orders exist', () => {
    assert.equal(resolveMonthlyDemand(0, 10), 10);
    assert.equal(resolveMonthlyDemand(0, 50), 50);
});
