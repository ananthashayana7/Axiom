import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User, Settings, Search, LogOut, Terminal } from "lucide-react";
import { SearchTrigger } from "./search-trigger";
import { signOut } from "@/auth";
import { cn } from "@/lib/utils";

type SessionUser = {
    role?: string | null;
};

export async function Header() {
    const session = await auth();
    const userName = session?.user?.name || "User";
    const role = (session?.user as SessionUser | undefined)?.role;

    const roleBadgeClass = "bg-muted text-muted-foreground border-border";

    return (
        <header className="sticky top-0 z-40 bg-background border-b border-border h-14 flex items-center justify-between px-4 lg:px-8 transition-all font-sans">
            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                    <h2 className="text-base font-bold text-foreground tracking-tight font-mono leading-tight">Intelligence Hub</h2>
                </div>
                <div className="hidden lg:block h-6 w-[1px] bg-border" />
                <div className="hidden md:flex items-center">
                    <SearchTrigger />
                </div>
            </div>

            <div className="flex items-center gap-5">
                {role === 'admin' && (
                    <Link
                        href="/admin/telemetry"
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-foreground hover:bg-muted rounded-sm transition-all border border-border"
                        title="System Telemetry"
                    >
                        <Terminal className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Vitals</span>
                    </Link>
                )}
                <ThemeToggle />
                <NotificationBell />
                <div className="h-6 w-[1px] bg-border hidden sm:block" />
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-bold text-foreground rounded-sm hover:bg-muted transition-all"
                    >
                        <div className="w-7 h-7 bg-muted rounded-sm flex items-center justify-center text-foreground font-bold text-[10px]">
                            {userName.charAt(0)}
                        </div>
                        <span className="hidden xl:inline">{userName}</span>
                        {role && (
                            <span className={cn(
                                "hidden sm:inline text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                roleBadgeClass
                            )}>
                                {role}
                            </span>
                        )}
                    </Link>
                    <form
                        action={async () => {
                            "use server";
                            await signOut({ redirectTo: '/login' });
                        }}
                    >
                        <Button variant="ghost" size="sm" type="submit" className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-colors">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </header>
    );
}
