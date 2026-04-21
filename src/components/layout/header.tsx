import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SearchTrigger } from "./search-trigger";
import { signOut } from "@/auth";
import { cn } from "@/lib/utils";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

type SessionUser = {
    role?: string | null;
};

export async function Header() {
    const session = await auth();
    const userName = session?.user?.name || "User";
    const role = (session?.user as SessionUser | undefined)?.role;

    const roleBadgeClass =
        role === 'admin'
            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
            : role === 'supplier'
            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800"
            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800";

    return (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/60 h-14 flex items-center justify-between px-4 lg:px-6 transition-all font-sans shadow-sm shadow-black/[0.03]">
            <div className="flex min-w-0 items-center gap-3 md:gap-6">
                <MobileNavigation role={role} />
                <div className="flex flex-col leading-none">
                    <h2 className="text-[13px] font-bold text-foreground tracking-tight">Intelligence Hub</h2>
                    <span className="text-[10px] text-muted-foreground/55 font-medium hidden md:block">Procurement Command Center</span>
                </div>
                <div className="hidden xl:block h-5 w-[1px] bg-border/60" />
                <div className="hidden md:flex items-center">
                    <SearchTrigger />
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                <ThemeToggle />
                <NotificationBell />
                <div className="h-5 w-[1px] bg-border/60 hidden sm:block" />
                <div className="flex min-w-0 items-center gap-2">
                    <Link
                        href="/profile"
                        className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-muted/80 border border-transparent hover:border-border/60"
                    >
                        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black text-[11px] shadow-sm shadow-primary/20">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="hidden truncate xl:inline text-[13px] font-semibold">{userName}</span>
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
                        <Button variant="ghost" size="sm" type="submit" className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors">
                            <LogOut className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </div>
            </div>
        </header>
    );
}
