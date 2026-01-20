import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq, or } from "drizzle-orm"
import bcrypt from "bcryptjs"

async function findUser(identifier: string) {
    try {
        // Search by email OR employeeId
        const [user] = await db.select().from(users).where(
            or(
                eq(users.email, identifier),
                eq(users.employeeId, identifier)
            )
        );
        return user || null;
    } catch {
        // Fallback to default admin if DB not ready
        if (identifier === "admin@example.com" || identifier === "ADMIN001") {
            return {
                id: "00000000-0000-0000-0000-000000000000",
                name: "Admin User",
                email: "admin@example.com",
                employeeId: "ADMIN001",
                password: await bcrypt.hash("password", 10),
                role: "admin" as const,
                createdAt: new Date(),
            }
        }
        return null;
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    secret: "2f8b4c9d3e7a1f6c5b8a2d9e4f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({
                        identifier: z.string().min(3), // Can be email or employeeId
                        password: z.string().min(6)
                    })
                    .safeParse(credentials)

                if (parsedCredentials.success) {
                    const { identifier, password } = parsedCredentials.data
                    const user = await findUser(identifier)
                    if (!user) return null

                    const passwordsMatch = await bcrypt.compare(password, user.password)
                    if (passwordsMatch) {
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                        }
                    }
                }
                return null;
            },
        }),
    ],
})
