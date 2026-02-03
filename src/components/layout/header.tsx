import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User, Settings, Search, LogOut, Terminal } from "lucide-react";
import { SearchTrigger } from "./search-trigger";
import { signOut } from "@/auth";

export async function Header() {
    const session = await auth();
    const userName = session?.user?.name || "User";
    const role = (session?.user as any)?.role;

    return (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-8 transition-all font-sans">
            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                    <h2 className="text-base font-bold text-foreground tracking-tight font-heading leading-tight">Intelligence Hub</h2>
                </div>
                <div className="hidden lg:block h-6 w-[1px] bg-zinc-200" />
                <div className="hidden md:flex items-center">
                    <SearchTrigger />
                </div>
            </div>

            <div className="flex items-center gap-5">
                {role === 'admin' && (
                    <Link
                        href="/admin/telemetry"
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-emerald-100"
                        title="System Telemetry"
                    >
                        <Terminal className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Vitals</span>
                    </Link>
                )}
                <ThemeToggle />
                <NotificationBell />
                <div className="h-6 w-[1px] bg-zinc-200 hidden sm:block" />
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-bold text-zinc-700 rounded-lg hover:bg-zinc-100 transition-all"
                    >
                        <div className="w-7 h-7 bg-emerald-100 rounded-md flex items-center justify-center text-emerald-700 font-bold text-[10px]">
                            {userName.charAt(0)}
                        </div>
                        <span className="hidden xl:inline">{userName}</span>
                    </Link>
                    <form
                        action={async () => {
                            "use server";
                            await signOut();
                        }}
                    >
                        <Button variant="ghost" size="sm" type="submit" className="h-9 w-9 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </header>
    );
}
