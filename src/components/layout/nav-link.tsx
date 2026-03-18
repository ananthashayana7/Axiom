'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
    href,
    className,
    children,
}: {
    href: string;
    className: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

    return (
        <Link href={href}>
            <span className={cn(
                className,
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-primary"
            )}>
                {children}
            </span>
        </Link>
    );
}
