import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSectionFlowPlan } from '../../src/lib/section-flow';

test('default section flow plan marks dashboard complete and suppliers as the next section', () => {
    const plan = buildSectionFlowPlan();

    assert.equal(plan.completedCount, 1);
    assert.equal(plan.totalCount, 7);
    assert.equal(plan.currentSection?.key, 'suppliers');
    assert.equal(plan.sections[0]?.status, 'complete');
    assert.equal(plan.sections[1]?.status, 'current');
    assert.equal(plan.sections[2]?.status, 'pending');
});

test('section flow plan advances the current focus after additional sections are complete', () => {
    const plan = buildSectionFlowPlan(['dashboard', 'suppliers', 'sourcing']);

    assert.equal(plan.completedCount, 3);
    assert.equal(plan.currentSection?.key, 'copilot');
    assert.equal(plan.sections[3]?.status, 'current');
    assert.equal(plan.sections[4]?.status, 'pending');
});

test('section flow plan clears the current focus when every section is complete', () => {
    const plan = buildSectionFlowPlan([
        'dashboard',
        'suppliers',
        'sourcing',
        'copilot',
        'portal',
        'intelligence',
        'support',
    ]);

    assert.equal(plan.completedCount, plan.totalCount);
    assert.equal(plan.currentSection, null);
    assert.equal(plan.percentComplete, 100);
});
