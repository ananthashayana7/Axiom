import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    Package,
    ShoppingCart,
    UserCog,
    Sparkles,
    ShieldAlert,
    BarChart3,
    FileText,
    Settings,
    History
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
        <div className={cn("w-64 border-r bg-background flex flex-col h-screen overflow-hidden", className)}>
            <div className="flex-1 overflow-y-auto min-h-0 py-4 scrollbar-thin scrollbar-thumb-muted">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                        Axiom
                    </h2>
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
