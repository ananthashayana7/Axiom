import crypto from 'crypto';

/**
 * Custom TOTP implementation to avoid external dependencies
 * RFC 6238
 */

const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32ToBuffer(base32: string): Buffer {
    let bits = '';
    const cleanBase32 = base32.replace(/[\s=]+/g, '').toUpperCase();
    for (let i = 0; i < cleanBase32.length; i++) {
        const val = base32chars.indexOf(cleanBase32.charAt(i));
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

function bufferToBase32(buffer: Buffer): string {
    let bits = '';
    for (let i = 0; i < buffer.length; i++) {
        bits += buffer[i].toString(2).padStart(8, '0');
    }
    let base32 = '';
    // Pad bits to be multiple of 5
    while (bits.length % 5 !== 0) {
        bits += '0';
    }
    for (let i = 0; i < bits.length; i += 5) {
        base32 += base32chars.charAt(parseInt(bits.substring(i, i + 5), 2));
    }
    return base32;
}

export class TotpService {
    /**
     * Generates a new random Base32 secret for a user
     * 20 bytes = 160 bits = 32 Base32 characters (perfect alignment)
     */
    static generateSecret(length = 20): string {
        return bufferToBase32(crypto.randomBytes(length));
    }

    /**
     * Calculates the current TOTP token for a given secret
     */
    static generateToken(secret: string): string {
        const key = base32ToBuffer(secret);
        const epoch = Math.floor(Date.now() / 1000);
        const time = Math.floor(epoch / 30);

        // Counter as 8-byte big-endian buffer
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64BE(BigInt(time));

        const hmac = crypto.createHmac('sha1', key);
        hmac.update(buf);
        const hmacResult = hmac.digest();

        const offset = hmacResult[hmacResult.length - 1] & 0xf;
        const code = (
            ((hmacResult[offset] & 0x7f) << 24) |
            ((hmacResult[offset + 1] & 0xff) << 16) |
            ((hmacResult[offset + 2] & 0xff) << 8) |
            (hmacResult[offset + 3] & 0xff)
        ) % 1000000;

        return code.toString().padStart(6, '0');
    }

    /**
     * Verifies if a token is valid for a given secret
     * Checks current, previous, and next window to allow for clock drift
     */
    static verifyToken(secret: string, token: string): boolean {
        if (!secret || !token) return false;

        try {
            const key = base32ToBuffer(secret);
            const epoch = Math.floor(Date.now() / 1000);
            const time = Math.floor(epoch / 30);

            console.log(`[TOTP] Verifying token: ${token} at server time: ${new Date().toISOString()}`);

            // Check window of -2, -1, 0, +1, +2 (Allowing for 1 minute drift)
            const validCodes = [];
            for (let i = -2; i <= 2; i++) {
                const buf = Buffer.alloc(8);
                buf.writeBigUInt64BE(BigInt(time + i));

                const hmac = crypto.createHmac('sha1', key);
                hmac.update(buf);
                const hmacResult = hmac.digest();

                const offset = hmacResult[hmacResult.length - 1] & 0xf;
                const code = (
                    ((hmacResult[offset] & 0x7f) << 24) |
                    ((hmacResult[offset + 1] & 0xff) << 16) |
                    ((hmacResult[offset + 2] & 0xff) << 8) |
                    (hmacResult[offset + 3] & 0xff)
                ) % 1000000;

                const formattedCode = code.toString().padStart(6, '0');
                validCodes.push(formattedCode);

                if (formattedCode === token) {
                    console.log(`[TOTP] Match found at window ${i}`);
                    return true;
                }
            }
            console.log(`[TOTP] No match. Expected one of: ${validCodes.join(', ')}`);
        } catch (err) {
            console.error("[TOTP] Verification error:", err);
        }

        return false;
    }

    /**
     * Generates the otpauth URL for QR codes
     */
    static getOtpAuthUrl(secret: string, label: string, issuer = 'Axiom'): string {
        return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    }
}
