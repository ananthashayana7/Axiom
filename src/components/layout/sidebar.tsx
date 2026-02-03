import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    UserCog,
    ShieldAlert,
    BarChart3,
    FileText,
    Settings,
    History,
    Sparkles,
    BookOpen,
    Atom,
    Terminal,
    CreditCard,
    Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";

const adminLinks = [
    { label: "User Management", icon: UserCog, href: "/admin/users" },
    { label: "Audit Trail", icon: History, href: "/admin/audit" },
    { label: "Financial Matching", icon: CreditCard, href: "/sourcing/invoices?mode=match" },
    { label: "Spend Intelligence", icon: BarChart3, href: "/admin/analytics" },
    { label: "Risk Intelligence", icon: ShieldAlert, href: "/admin/risk" },
    { label: "Admin Settings", icon: Settings, href: "/admin/settings" },
];

const supplierLinks = [
    { label: "My Portal", icon: LayoutDashboard, href: "/portal" },
    { label: "Incoming Bids", icon: FileText, href: "/portal/rfqs" },
    { label: "Active Orders", icon: ShoppingCart, href: "/portal/orders" },
    { label: "My Documents", icon: FileText, href: "/portal/documents" },
];

export async function Sidebar({ className }: { className?: string }) {
    const session = await auth();
    const role = (session?.user as any)?.role;

    return (
        <div className={cn("w-72 border-r border-border bg-sidebar flex flex-col h-full overflow-hidden text-sidebar-foreground", className)}>
            <div className="flex-1 overflow-y-auto min-h-0 pt-2 pb-10 scrollbar-thin scrollbar-thumb-muted">
                <div className="px-3 py-2">
                    <div className="mb-4 px-4 flex items-center gap-4">
                        {/* Minimalist Geometric 'A' Logo */}
                        <div className="relative shrink-0">
                            <div className="h-10 w-10 bg-primary/5 rounded-sm flex items-center justify-center border border-primary/10">
                                <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary" fill="currentColor">
                                    <path d="M12 4L3 20H7L12 11L17 20H21L12 4Z" opacity="0.3" />
                                    <path d="M12 11L8 18H16L12 11Z" />
                                    <path d="M2.5 20L10 6L12 10L5 21H2.5Z" />
                                    <path d="M21.5 20L14 6L12 10L19 21H21.5Z" />
                                </svg>
                            </div>
                        </div>

                        {/* Classic Cinematic Serif Title */}
                        <div className="flex flex-col tracking-tight">
                            <h2 className="text-[28px] font-bold text-foreground font-display leading-none">
                                Axiom
                            </h2>
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <Link href={role === 'supplier' ? '/portal' : '/'}>
                            <span className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Dashboard
                            </span>
                        </Link>
                        {role !== 'supplier' && (
                            <Link href="/suppliers">
                                <span className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <Users className="mr-2 h-4 w-4" />
                                    Suppliers
                                </span>
                            </Link>
                        )}
                        <Link href="/copilot">
                            <span className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-primary dark:text-primary font-bold transition-colors">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Axiom Copilot
                            </span>
                        </Link>
                    </div>
                </div>

                {role !== 'supplier' && (
                    <div className="px-3 py-2">
                        <h2 className="mb-1.5 px-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            Sourcing
                        </h2>
                        <div className="space-y-0.5">
                            <Link href="/sourcing/parts">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <Package className="mr-2 h-4 w-4" />
                                    Parts Catalog
                                </span>
                            </Link>
                            <Link href="/sourcing/rfqs">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Sourcing Requests
                                </span>
                            </Link>
                            <Link href="/sourcing/requisitions">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Internal Requisitions
                                </span>
                            </Link>
                            <Link href="/sourcing/orders">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Orders
                                </span>
                            </Link>
                            <Link href="/sourcing/goods-receipts">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <Truck className="mr-2 h-4 w-4" />
                                    Goods Receipts
                                </span>
                            </Link>
                            <Link href="/sourcing/invoices">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Invoice Records
                                </span>
                            </Link>
                            <Link href="/sourcing/contracts">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Framework Agreements
                                </span>
                            </Link>
                        </div>
                    </div>
                )}

                {role === 'supplier' && (
                    <div className="px-3 py-2">
                        <h2 className="mb-1.5 px-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            Vendor Portal
                        </h2>
                        <div className="space-y-0.5">
                            {supplierLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <span className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                            <Icon className="mr-2 h-4 w-4" />
                                            {link.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {role !== 'supplier' && (
                    <div className="px-3 py-2 border-t border-border/50 mt-2 pt-2">
                        <h2 className="mb-1.5 px-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            Resources
                        </h2>
                        <div className="space-y-0.5">
                            <Link href="/docs">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                                    <BookOpen className="mr-2 h-4 w-4" />
                                    Axiom Playbook
                                </span>
                            </Link>
                        </div>
                    </div>
                )}

                {(role === 'admin' || role === 'user') && (
                    <div className="px-3 py-2 border-t border-border/50 mt-2 pt-2">
                        <h2 className="mb-1.5 px-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            {role === 'admin' ? "Admin Control" : "Intelligence & Audit"}
                        </h2>
                        <div className="space-y-0.5">
                            {adminLinks
                                .filter(link => {
                                    if (role === 'admin') return true;
                                    const userVisiblePaths = ['/admin/audit', '/admin/analytics', '/admin/risk'];
                                    return userVisiblePaths.includes(link.href);
                                })
                                .map((link) => {
                                    const Icon = link.icon;
                                    return (
                                        <Link key={link.href} href={link.href}>
                                            <span className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group">
                                                <Icon className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary transition-colors" />
                                                {link.label}
                                            </span>
                                        </Link>
                                    );
                                })}
                            <div className="h-20" aria-hidden="true" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
