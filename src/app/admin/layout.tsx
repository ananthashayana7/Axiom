import { auth } from "@/auth";
import { EnvironmentPill } from "@/components/shared/environment-pill";
import { getEnvironmentStatus } from "@/lib/environment";
import { redirect } from "next/navigation";

type SessionUser = {
    role?: string | null;
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const environment = getEnvironmentStatus();

    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_BYPASS === "true") {
        return (
            <div className="flex min-h-full flex-col">
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold">Admin workspace guardrail</p>
                            <p className="text-xs text-amber-700">{environment.description}</p>
                        </div>
                        <EnvironmentPill />
                    </div>
                </div>
                {children}
            </div>
        );
    }

    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const role = (session.user as SessionUser).role;

    if (role !== "admin") {
        redirect("/");
    }

    return (
        <div className="flex min-h-full flex-col">
            <div className="border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold">Admin workspace guardrail</p>
                        <p className="text-xs text-muted-foreground">{environment.description}</p>
                    </div>
                    <EnvironmentPill />
                </div>
            </div>
            {children}
        </div>
    );
}
