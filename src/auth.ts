
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"

async function getUser(email: string) {
    try {
        const [user] = await db.select().from(users).where(eq(users.email, email));
        return user || null;
    } catch {
        // Fallback to default admin if DB not ready
        if (email === "admin@example.com") {
            return {
                id: "default-admin",
                name: "Admin User",
                email: "admin@example.com",
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
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials)

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data
                    const user = await getUser(email)
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
                console.log('Invalid credentials')
                return null
            },
        }),
    ],
})
