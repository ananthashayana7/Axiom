import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';

import { normalizeIdentifier, verifyPassword } from '../../src/lib/auth-credentials';

test('normalizeIdentifier trims and lowercases the supplied identifier', () => {
    assert.equal(normalizeIdentifier('  Anantha.Shayana@Prettl.com  '), 'anantha.shayana@prettl.com');
    assert.equal(normalizeIdentifier('EMP-1001'), 'emp-1001');
});

test('verifyPassword accepts bcrypt hashes and legacy plaintext values', async () => {
    const hashedPassword = await bcrypt.hash('Ananth@1', 1);

    assert.equal(await verifyPassword('Ananth@1', hashedPassword), true);
    assert.equal(await verifyPassword('WrongPassword', hashedPassword), false);
    assert.equal(await verifyPassword('Ananth@1', 'Ananth@1'), true);
    assert.equal(await verifyPassword('Ananth@1', 'different-password'), false);
});
