import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { db } from "@/db"
import { users } from "@/db/schema"
import { ilike, or } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { TelemetryService } from "./lib/telemetry"
import { TotpService } from "@/lib/totp";

async function findUser(identifier: string) {
    try {
        const [user] = await db.select().from(users).where(
            ilike(users.email, identifier)
        );
        return user || null;
    } catch (err) {
        console.error("Database error in findUser:", err);
        return null;
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    providers: [
        Credentials({
            credentials: {
                identifier: { label: "Identifier", type: "text" },
                password: { label: "Password", type: "password" },
                code: { label: "2FA Code", type: "text" },
            },
            async authorize(credentials) {
                console.log("[AUTH] Authorize called for:", credentials?.identifier);
                try {
                    const identifier = String(credentials?.identifier || "").trim();
                    const password = String(credentials?.password || "");
                    const code = String(credentials?.code || "");

                    if (!identifier || !password) {
                        console.log("[AUTH] Missing identifier or password");
                        return null;
                    }

                    const user = await findUser(identifier);
                    if (!user) {
                        console.warn(`[AUTH] USER_NOT_FOUND | identifier: ${identifier}`);
                        await TelemetryService.trackEvent("Security", "login_failed_user_not_found", { identifier });
                        return null;
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        // Check for 2FA
                        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
                            // 2FA is fully enabled — require a valid code
                            if (!code || code === 'undefined' || code === 'null' || code === '') {
                                console.log(`[AUTH] 2FA_REQUIRED | user: ${user.email}`);
                                throw new Error("require-2fa");
                            }

                            const isValidToken = TotpService.verifyToken(user.twoFactorSecret, code);
                            if (!isValidToken) {
                                console.warn(`[AUTH] 2FA_FAILED | user: ${user.email}`);
                                await TelemetryService.trackEvent("Security", "login_failed_invalid_2fa", {
                                    userId: user.id,
                                    identifier
                                });
                                return null;
                            }
                        } else if (!user.isTwoFactorEnabled) {
                            // 2FA not yet enabled — user must complete setup before logging in
                            console.log(`[AUTH] 2FA_SETUP_REQUIRED | user: ${user.email}`);
                            throw new Error("setup-2fa");
                        } else {
                            // Edge case: isTwoFactorEnabled=true but secret is missing (corrupt state)
                            // Reset the flag and require fresh setup
                            console.warn(`[AUTH] 2FA_CORRUPT_STATE | user: ${user.email} | enabled but no secret`);
                            await db.update(users).set({ isTwoFactorEnabled: false }).where(ilike(users.email, identifier));
                            throw new Error("setup-2fa");
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
                        }
                    } else {
                        console.warn(`[AUTH] LOGIN_FAILED_WRONG_PASSWORD | identifier: ${identifier}`);
                        await TelemetryService.trackEvent("Security", "login_failed_wrong_password", {
                            identifier,
                            userId: user.id
                        });
                        return null;
                    }
                } catch (error: any) {
                    if (error.message === 'require-2fa' || error.message === 'setup-2fa') {
                        throw error;
                    }
                    console.error(`[AUTH] FATAL_ERROR | identifier: ${credentials?.identifier} | error: ${error.message}`);
                    return null;
                }
            },
        }),
    ],
})
