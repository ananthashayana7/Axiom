'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { AxiomLogo } from "@/components/shared/axiom-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getNavigationSections, type NavigationRole, type NavigationLink } from "@/components/layout/navigation";
import { cn } from "@/lib/utils";

function getLinkClasses(link: NavigationLink, isActive: boolean) {
    if (link.emphasis === 'agents') {
        return cn(
            "flex items-center rounded-xl border px-3 py-3 text-sm font-bold transition-colors",
            isActive
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/10 dark:text-emerald-400 dark:hover:bg-emerald-950/20",
        );
    }

    if (link.emphasis === 'copilot') {
        return cn(
            "flex items-center rounded-xl px-3 py-3 text-sm font-bold transition-colors",
            isActive
                ? "bg-primary/10 text-primary"
                : "text-primary hover:bg-accent",
        );
    }

    return cn(
        "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-colors",
        isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-accent hover:text-accent-foreground",
    );
}

export function MobileNavigation({ role }: { role: NavigationRole }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const sections = getNavigationSections(role);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open navigation</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="left-0 top-0 grid h-[100dvh] w-[min(92vw,380px)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-r p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-none">
                <div className="flex items-center gap-3 border-b px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/10 bg-primary/5">
                        <AxiomLogo className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-base font-bold">Navigation</DialogTitle>
                        <p className="text-xs text-muted-foreground">Everything stays reachable on laptop widths.</p>
                    </div>
                </div>

                <div className="show-scrollbar min-h-0 overflow-y-auto px-4 py-4">
                    <div className="space-y-6">
                        {sections.map((section) => (
                            <div key={section.id}>
                                {section.title ? (
                                    <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                                        {section.title}
                                    </p>
                                ) : null}
                                <div className="space-y-1">
                                    {section.links.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

                                        return (
                                            <DialogClose asChild key={link.href}>
                                                <Link href={link.href} className={getLinkClasses(link, isActive)}>
                                                    <Icon className="mr-3 h-4 w-4 shrink-0" />
                                                    {link.label}
                                                </Link>
                                            </DialogClose>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
