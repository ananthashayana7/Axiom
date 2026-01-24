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
    Atom
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";

const adminLinks = [
    { label: "User Management", icon: UserCog, href: "/admin/users" },
    { label: "Audit Trail", icon: History, href: "/admin/audit" },
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
        <div className={cn("w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-hidden", className)}>
            <div className="flex-1 overflow-y-auto min-h-0 py-4 scrollbar-thin scrollbar-thumb-muted">
                <div className="px-3 py-2">
                    <div className="mb-6 px-4 flex items-center gap-3">
                        {/* Abstract Hidden 'AS' Icon */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-zinc-200 to-zinc-500 rounded-lg blur-[2px] opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative h-12 w-12 bg-black rounded-lg flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-zinc-800">
                                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    {/* Abstract 'A' (Chevron) & 'S' (Curve) fused into a cryptic glyph */}
                                    <path d="M12 2L2 22h20L12 2z" className="opacity-0" />
                                    <path d="M12 3L4 20h16L12 3z" stroke="currentColor" strokeLinecap="square" className="drop-shadow-[0_0_2px_white]" />
                                    <path d="M12 8c-2 0-3 1-3 3s2 3 2 5-2 4-4 4" stroke="currentColor" className="text-zinc-500" />
                                    <path d="M15 14c1 1 2.5 1 3.5 0" stroke="currentColor" className="text-zinc-600" />
                                </svg>
                                {/* Gloss shine on the icon */}
                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-lg"></div>
                            </div>
                        </div>

                        {/* Shiny Text */}
                        <div className="relative">
                            <h2 className={`text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground/60 via-foreground to-foreground font-display drop-shadow-sm`}>
                                Axiom
                            </h2>
                            {/* Specular Highlight for 'Shiny' effect */}
                            <div className="absolute top-[2px] left-0 w-full h-[40%] bg-gradient-to-b from-white/20 to-transparent opacity-50 bg-clip-text text-transparent select-none pointer-events-none font-display text-4xl font-black tracking-tighter">
                                Axiom
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Link href={role === 'supplier' ? '/portal' : '/'}>
                            <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Dashboard
                            </span>
                        </Link>
                        {role !== 'supplier' && (
                            <Link href="/suppliers">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <Users className="mr-2 h-4 w-4" />
                                    Suppliers
                                </span>
                            </Link>
                        )}
                        <Link href="/copilot">
                            <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-primary font-semibold">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Axiom Copilot
                            </span>
                        </Link>
                    </div>
                </div>

                {role !== 'supplier' && (
                    <div className="px-3 py-2">
                        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                            Sourcing
                        </h2>
                        <div className="space-y-1">
                            <Link href="/sourcing/parts">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <Package className="mr-2 h-4 w-4" />
                                    Parts Catalog
                                </span>
                            </Link>
                            <Link href="/sourcing/rfqs">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Sourcing Requests
                                </span>
                            </Link>
                            <Link href="/sourcing/requisitions">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Internal Requisitions
                                </span>
                            </Link>
                            <Link href="/sourcing/orders">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Orders
                                </span>
                            </Link>
                            <Link href="/sourcing/contracts">
                                <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Framework Agreements
                                </span>
                            </Link>
                        </div>
                    </div>
                )}

                {role === 'supplier' && (
                    <div className="px-3 py-2">
                        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                            Vendor Portal
                        </h2>
                        <div className="space-y-1">
                            {supplierLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                            <Icon className="mr-2 h-4 w-4" />
                                            {link.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {role === 'admin' && (
                    <div className="px-3 py-2">
                        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                            Admin
                        </h2>
                        <div className="space-y-1">
                            {adminLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link key={link.href} href={link.href}>
                                        <span className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                                            <Icon className="mr-2 h-4 w-4" />
                                            {link.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
