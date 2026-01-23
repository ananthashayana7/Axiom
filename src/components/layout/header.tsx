import { NotificationBell } from "./notification-bell";
import { auth } from "@/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User, Settings, Search, LogOut } from "lucide-react";
import { SearchTrigger } from "./search-trigger";
import { signOut } from "@/auth";

export async function Header() {
    const session = await auth();
    const userName = session?.user?.name || "User";

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-8 shrink-0">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Welcome back,</span>
                    <span className="text-sm font-bold">{userName}</span>
                </div>
                <div className="hidden md:flex items-center">
                    <SearchTrigger />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <NotificationBell />
                <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <User className="h-4 w-4" />
                    Profile
                </Link>
                <form
                    action={async () => {
                        "use server";
                        await signOut();
                    }}
                >
                    <Button variant="ghost" size="sm" type="submit" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-2">
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </form>
            </div>
        </header>
    );
}
