import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCategoryMix,
    getInfographicHighlights,
    getPeakSpendMonth,
    getSpendMomentum,
} from '../../src/lib/dashboard-infographic';

test('buildCategoryMix keeps the largest categories and groups the remainder into Others', () => {
    const categoryMix = buildCategoryMix([
        { name: 'Electronics', value: 500 },
        { name: 'Logistics', value: 400 },
        { name: 'Packaging', value: 300 },
        { name: 'Machining', value: 200 },
        { name: 'Software', value: 100 },
        { name: 'MRO', value: 50 },
    ]);

    assert.equal(categoryMix.length, 5);
    assert.equal(categoryMix[0]?.name, 'Electronics');
    assert.equal(categoryMix[3]?.name, 'Machining');
    assert.equal(categoryMix[4]?.name, 'Others');
    assert.equal(categoryMix[4]?.value, 150);
});

test('getPeakSpendMonth and getSpendMomentum summarize monthly trend data', () => {
    const monthlyData = [
        { name: 'Jan', total: 1200 },
        { name: 'Feb', total: 1800 },
        { name: 'Mar', total: 1500 },
    ];

    const peakMonth = getPeakSpendMonth(monthlyData);
    const momentum = getSpendMomentum(monthlyData);

    assert.equal(peakMonth?.name, 'Feb');
    assert.equal(momentum.current?.name, 'Mar');
    assert.ok(momentum.change !== null);
    assert.equal(Number(momentum.change?.toFixed(1)), -16.7);
});

test('getInfographicHighlights counts critical suppliers and identifies the top supplier', () => {
    const highlights = getInfographicHighlights({
        monthlyData: [{ name: 'Jan', total: 1200 }, { name: 'Feb', total: 1800 }],
        categoryData: [{ name: 'Electronics', value: 600 }, { name: 'Logistics', value: 400 }],
        supplierData: [
            { name: 'Vertex', spend: 700, orders: 4, reliability: 91 },
            { name: 'Nova', spend: 1300, orders: 6, reliability: 84 },
        ],
        riskySuppliers: [
            { id: '1', name: 'High Risk One', riskScore: 70 },
            { id: '2', name: 'Monitor', riskScore: 55 },
            { id: '3', name: 'High Risk Two', riskScore: 88 },
        ],
        totalSpend: 2200,
        supplierCount: 12,
    });

    assert.equal(highlights.criticalSuppliers, 2);
    assert.equal(highlights.topSupplier?.name, 'Nova');
    assert.equal(highlights.activeCategories, 2);
    assert.equal(highlights.peakMonth?.name, 'Feb');
});
