import bcrypt from 'bcryptjs';

export function normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
}

export async function verifyPassword(plainPassword: string, storedPassword: string | null | undefined) {
    if (!storedPassword) return false;
    if (!plainPassword) return false;

    if (storedPassword.startsWith('$2') || storedPassword.startsWith('$2a') || storedPassword.startsWith('$2b')) {
        try {
            return await bcrypt.compare(plainPassword, storedPassword);
        } catch {
            return false;
        }
    }

    return plainPassword === storedPassword;
}
