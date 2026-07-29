import crypto from 'crypto';

/**
 * Generates a secure random token for email verification
 * @returns Random token string
 */
export function generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates expiration timestamp (24 hours from now)
 * @returns Date object
 */
export function getVerificationTokenExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    return expiresAt;
}

/**
 * Checks if a verification token is still valid
 * @param expiresAt Token expiration timestamp
 * @returns boolean
 */
export function isVerificationTokenValid(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    return new Date() < new Date(expiresAt);
}

/**
 * Generates email verification link
 * @param token Verification token
 * @param baseUrl Application base URL
 * @returns Full verification link
 */
export function getVerificationLink(token: string, baseUrl: string): string {
    return `${baseUrl}/api/suppliers/verify-email?token=${token}`;
}
