import { NotificationBell } from "./notification-bell";
import { auth } from "@/auth";

export async function Header() {
    const session = await auth();
    const userName = session?.user?.name || "User";

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-8 shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">Welcome back,</span>
                <span className="text-sm font-bold">{userName}</span>
            </div>

            <div className="flex items-center gap-4">
                <NotificationBell />
            </div>
        </header>
    );
}
