import NextAuth, { CredentialsSignin } from "next-auth"
import { authConfig } from "./auth.config"

class SetupTwoFactorError extends CredentialsSignin {
    code = "setup-2fa"
}

class RequireTwoFactorError extends CredentialsSignin {
    code = "require-2fa"
}

import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id"
import { db } from "@/db"
import { suppliers, users } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { TelemetryService } from "./lib/telemetry"
import { TotpService } from "@/lib/totp";
import crypto from "node:crypto";

function normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
}

function identifierHash(identifier: string) {
    return crypto.createHash("sha256").update(normalizeIdentifier(identifier)).digest("hex").slice(0, 16);
}

function emailEquals(identifier: string) {
    return sql`lower(${users.email}) = ${normalizeIdentifier(identifier)}`;
}

async function findUser(identifier: string) {
    try {
        const normalized = normalizeIdentifier(identifier);
        if (!normalized) return null;

        const [user] = await db.select().from(users).where(
            emailEquals(normalized)
        );
        return user || null;
    } catch (err) {
        console.error("Database error in findUser:", err);
        return null;
    }
}

async function supplierPortalAccessAllowed(supplierId: string | null | undefined) {
    if (!supplierId) {
        return false;
    }

    const [supplier] = await db.select({
        status: suppliers.status,
        lifecycleStatus: suppliers.lifecycleStatus,
    }).from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

    return supplier?.status === 'active' && supplier?.lifecycleStatus === 'active';
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    trustHost: true,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    providers: [
        Credentials({
            credentials: {
                identifier: { label: "Identifier", type: "text" },
                password: { label: "Password", type: "password" },
                code: { label: "2FA Code", type: "text" },
            },
            async authorize(credentials) {
                const requestedIdentifier = String(credentials?.identifier || "");
                console.log("[AUTH] Authorize called", {
                    identifierHash: requestedIdentifier ? identifierHash(requestedIdentifier) : "missing",
                });
                try {
                    const identifier = normalizeIdentifier(requestedIdentifier);
                    const password = String(credentials?.password || "");
                    const code = String(credentials?.code || "");

                    if (!identifier || !password) {
                        console.log("[AUTH] Missing identifier or password");
                        return null;
                    }

                    const user = await findUser(identifier);
                    if (!user) {
                        console.warn(`[AUTH] USER_NOT_FOUND | identifierHash: ${identifierHash(identifier)}`);
                        await TelemetryService.trackEvent("Security", "login_failed_user_not_found", {
                            identifierHash: identifierHash(identifier),
                        });
                        return null;
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        if (user.role === 'supplier') {
                            const portalAccessAllowed = await supplierPortalAccessAllowed(user.supplierId);
                            if (!portalAccessAllowed) {
                                console.warn(`[AUTH] SUPPLIER_PORTAL_LOCKED | user: ${user.email}`);
                                await TelemetryService.trackEvent("Security", "login_failed_supplier_portal_locked", {
                                    userId: user.id,
                                    email: user.email,
                                    supplierId: user.supplierId,
                                });
                                return null;
                            }
                        }

                        // Check for 2FA
                        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
                            // 2FA is fully enabled — require a valid code
                            if (!code || code === 'undefined' || code === 'null' || code === '') {
                                console.log(`[AUTH] 2FA_REQUIRED | user: ${user.email}`);
                                throw new RequireTwoFactorError();
                            }

                            const isValidToken = TotpService.verifyToken(user.twoFactorSecret, code);
                            if (!isValidToken) {
                                console.warn(`[AUTH] 2FA_FAILED | user: ${user.email}`);
                                await TelemetryService.trackEvent("Security", "login_failed_invalid_2fa", {
                                    userId: user.id,
                                    identifierHash: identifierHash(identifier),
                                });
                                return null;
                            }
                        } else if (!user.isTwoFactorEnabled) {
                            // 2FA not yet enabled — user must complete setup before logging in
                            console.log(`[AUTH] 2FA_SETUP_REQUIRED | user: ${user.email}`);
                            throw new SetupTwoFactorError();
                        } else {
                            // Edge case: isTwoFactorEnabled=true but secret is missing (corrupt state)
                            // Reset the flag and require fresh setup
                            console.warn(`[AUTH] 2FA_CORRUPT_STATE | user: ${user.email} | enabled but no secret`);
                            await db.update(users).set({ isTwoFactorEnabled: false }).where(emailEquals(identifier));
                            throw new SetupTwoFactorError();
                        }

                        console.log(`[AUTH] LOGIN_SUCCESS | user: ${user.email} | role: ${user.role}`);
                        await TelemetryService.trackEvent("Security", "login_success", {
                            userId: user.id,
                            email: user.email,
                            role: user.role
                        });
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            accessProfile: user.accessProfile,
                            department: user.department,
                            countryScope: user.countryScope,
                            regionScope: user.regionScope,
                            supplierId: user.supplierId,
                        }
                    } else {
                        console.warn(`[AUTH] LOGIN_FAILED_WRONG_PASSWORD | identifierHash: ${identifierHash(identifier)}`);
                        await TelemetryService.trackEvent("Security", "login_failed_wrong_password", {
                            identifierHash: identifierHash(identifier),
                            userId: user.id
                        });
                        return null;
                    }
                } catch (error: unknown) {
                    if (error instanceof CredentialsSignin) {
                        throw error;
                    }
                    const err = error as Error;
                    if (err.message === 'require-2fa' || err.message === 'setup-2fa') {
                        throw error;
                    }
                    console.error(`[AUTH] FATAL_ERROR | identifierHash: ${requestedIdentifier ? identifierHash(requestedIdentifier) : "missing"} | error: ${err.message}`);
                    return null;
                }
            },
        }),
        // ─── SSO / OAuth Providers (conditionally loaded) ─────────────────────
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [Google({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            })]
            : []),
        ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID
            ? [MicrosoftEntraId({
                clientId: process.env.AZURE_AD_CLIENT_ID,
                clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
                issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
            })]
            : []),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            // For OAuth providers, map to existing Axiom user by email
            if (account?.provider !== 'credentials' && user?.email) {
                const [existingUser] = await db.select()
                    .from(users)
                    .where(emailEquals(user.email))
                    .limit(1);

                if (!existingUser) {
                    // Deny sign-in for OAuth users not pre-registered in Axiom
                    console.warn(`[AUTH] OAuth user ${user.email} not found in Axiom DB`);
                    return false;
                }

                // ISSUE-05 FIX: Block OAuth login if 2FA is enabled on this account.
                // OAuth providers cannot verify TOTP codes, so allowing SSO would
                // silently bypass 2FA enforcement entirely.
                if (existingUser.isTwoFactorEnabled && existingUser.twoFactorSecret) {
                    console.warn(`[AUTH] OAuth login blocked — 2FA is enabled for ${user.email}. Use email/password login.`);
                    await TelemetryService.trackEvent("Security", "oauth_blocked_2fa_enabled", {
                        email: user.email,
                        provider: account?.provider,
                    });
                    return '/login?error=2fa_required';
                }

                if (existingUser.role === 'supplier') {
                    const portalAccessAllowed = await supplierPortalAccessAllowed(existingUser.supplierId);
                    if (!portalAccessAllowed) {
                        console.warn(`[AUTH] OAuth supplier ${user.email} is linked to a locked portal account`);
                        return false;
                    }
                }

                // Map the Axiom user data onto the session
                user.id = existingUser.id;
                user.name = existingUser.name;
                user.role = existingUser.role;
                user.accessProfile = existingUser.accessProfile;
                user.department = existingUser.department;
                user.countryScope = existingUser.countryScope;
                user.regionScope = existingUser.regionScope;
                user.supplierId = existingUser.supplierId;
            }
            return true;
        },
    },
})
