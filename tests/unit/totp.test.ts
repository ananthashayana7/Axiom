import assert from 'node:assert/strict';
import test from 'node:test';

import { TotpService } from '../../src/lib/totp';

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function withMockedNow<T>(timestampMs: number, callback: () => T): T {
    const originalNow = Date.now;
    Date.now = () => timestampMs;
    try {
        return callback();
    } finally {
        Date.now = originalNow;
    }
}

test('generateSecret returns a base32 secret with the expected default length', () => {
    const secret = TotpService.generateSecret();
    assert.equal(secret.length, 32);
    assert.match(secret, /^[A-Z2-7]+$/);
});

test('generateToken matches the known RFC 6238 value reduced to six digits', () => {
    const token = withMockedNow(59_000, () => TotpService.generateToken(RFC_SECRET));
    assert.equal(token, '287082');
});

test('verifyToken accepts tokens from the current and adjacent time windows', () => {
    const currentToken = withMockedNow(90_000, () => TotpService.generateToken(RFC_SECRET));
    const previousWindowToken = withMockedNow(60_000, () => TotpService.generateToken(RFC_SECRET));
    const nextWindowToken = withMockedNow(120_000, () => TotpService.generateToken(RFC_SECRET));

    assert.equal(withMockedNow(90_000, () => TotpService.verifyToken(RFC_SECRET, currentToken)), true);
    assert.equal(withMockedNow(90_000, () => TotpService.verifyToken(RFC_SECRET, previousWindowToken)), true);
    assert.equal(withMockedNow(90_000, () => TotpService.verifyToken(RFC_SECRET, nextWindowToken)), true);
});

test('verifyToken rejects empty and incorrect tokens', () => {
    assert.equal(TotpService.verifyToken('', '123456'), false);
    assert.equal(TotpService.verifyToken(RFC_SECRET, ''), false);
    assert.equal(withMockedNow(90_000, () => TotpService.verifyToken(RFC_SECRET, '000000')), false);
});

test('getOtpAuthUrl encodes the issuer and label', () => {
    assert.equal(
        TotpService.getOtpAuthUrl('SECRET123', 'Jane Doe', 'Axiom QA'),
        'otpauth://totp/Axiom%20QA:Jane%20Doe?secret=SECRET123&issuer=Axiom%20QA',
    );
});
