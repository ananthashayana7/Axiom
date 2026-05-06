import type { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            role: string;
            accessProfile?: string | null;
            department?: string | null;
            countryScope?: string | null;
            regionScope?: string | null;
            supplierId?: string | null;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string | null;
        accessProfile?: string | null;
        department?: string | null;
        countryScope?: string | null;
        regionScope?: string | null;
        supplierId?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        accessProfile?: string | null;
        department?: string | null;
        countryScope?: string | null;
        regionScope?: string | null;
        supplierId?: string | null;
    }
}
