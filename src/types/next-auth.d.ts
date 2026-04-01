import type { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: string;
            supplierId?: string | null;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string | null;
        supplierId?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        supplierId?: string | null;
    }
}
