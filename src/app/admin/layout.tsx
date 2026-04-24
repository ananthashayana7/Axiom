import { auth } from "@/auth";
import { redirect } from "next/navigation";

type SessionUser = {
    role?: string | null;
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_BYPASS === "true") {
        return <>{children}</>;
    }

    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = (session.user as SessionUser).role;

    if (role !== "admin") {
        redirect("/");
    }

    return <>{children}</>;
}
