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
    BookOpen,
    CreditCard,
    Truck,
    ArrowRightLeft,
    PiggyBank,
    ContactRound,
    LifeBuoy,
    FileUp,
    Inbox,
    ShieldCheck,
    ClipboardList
} from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { AxiomLogo } from "@/components/shared/axiom-logo";
import { NavLink } from "@/components/layout/nav-link";

type SessionUser = {
    role?: string | null;
};

const adminLinks = [
    { label: "Task Inbox", icon: Inbox, href: "/admin/tasks" },
    { label: "Compliance", icon: ShieldCheck, href: "/admin/compliance" },
    { label: "User Management", icon: UserCog, href: "/admin/users" },
    { label: "Support Tickets", icon: LifeBuoy, href: "/admin/support" },
    { label: "Audit Trail", icon: History, href: "/admin/audit" },
    { label: "Import Data", icon: FileUp, href: "/admin/import" },
    { label: "Financial Matching", icon: CreditCard, href: "/admin/financial-matching" },
    { label: "Spend Intelligence", icon: BarChart3, href: "/admin/analytics" },
    { label: "Risk Intelligence", icon: ShieldAlert, href: "/admin/risk" },
    { label: "Admin Settings", icon: Settings, href: "/admin/settings" },
];

const supplierLinks = [
    { label: "My Portal", icon: LayoutDashboard, href: "/portal" },
    { label: "Incoming Bids", icon: FileText, href: "/portal/rfqs" },
    { label: "Active Orders", icon: ShoppingCart, href: "/portal/orders" },
    { label: "My Documents", icon: FileText, href: "/portal/documents" },
    { label: "Requests & Tasks", icon: ClipboardList, href: "/portal/requests" },
];

/* ---- tiny helper for nav links ---- */
const navCls = "flex items-center rounded-sm px-3 py-1 text-[13px] font-medium hover:bg-accent hover:text-accent-foreground transition-colors";

export async function Sidebar({ className }: { className?: string }) {
    const session = await auth();
    const role = (session?.user as SessionUser | undefined)?.role;

    return (
        <div className={cn("w-56 xl:w-72 border-r border-border bg-sidebar flex flex-col h-full overflow-hidden text-sidebar-foreground", className)}>
            <div className="flex-1 overflow-y-auto min-h-0 pb-2">

                {/* ── Brand ── */}
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 bg-primary/10 rounded-sm flex items-center justify-center border border-primary/20 shrink-0">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="currentColor">
                            <path d="M12 4L3 20H7L12 11L17 20H21L12 4Z" opacity="0.3" />
                            <path d="M12 11L8 18H16L12 11Z" />
                            <path d="M2.5 20L10 6L12 10L5 21H2.5Z" />
                            <path d="M21.5 20L14 6L12 10L19 21H21.5Z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-foreground font-mono leading-none tracking-tight">
                        Axiom
                    </h2>
                </div>

                {/* ── Primary Nav ── */}
                <div className="px-3 space-y-0.5">
                    <NavLink href={role === 'supplier' ? '/portal' : '/'} className={navCls}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </NavLink>
                    {role !== 'supplier' && (
                        <NavLink href="/suppliers" className={navCls}>
                            <Users className="mr-2 h-4 w-4" />
                            Suppliers
                        </NavLink>
                    )}
                    <NavLink href="/copilot" className={cn(navCls, "font-bold")}>
                        <AxiomLogo className="mr-2 h-4 w-4" />
                        Axiom Copilot
                    </NavLink>
                    {role === 'admin' && (
                        <Link href="/admin/agents">
                            <span className="flex items-center rounded-sm px-3 py-1 text-[13px] font-medium hover:bg-accent hover:text-accent-foreground bg-muted text-foreground font-bold transition-all border border-border">
                                <AxiomLogo className="mr-2 h-4 w-4" />
                                AI Agents
                            </span>
                        </Link>
                    )}
                </div>

                {/* ── Sourcing ── */}
                {role !== 'supplier' && (
                    <div className="px-3 mt-3">
                        <h2 className="mb-1 px-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            Sourcing
                        </h2>
                        <div className="space-y-0.5">
                            <NavLink href="/sourcing/parts" className={navCls}><Package className="mr-2 h-4 w-4" />Parts Catalog</NavLink>
                            <NavLink href="/sourcing/rfqs" className={navCls}><FileText className="mr-2 h-4 w-4" />Sourcing Requests</NavLink>
                            <NavLink href="/sourcing/requisitions" className={navCls}><ShoppingCart className="mr-2 h-4 w-4" />Requisitions</NavLink>
                            <NavLink href="/sourcing/orders" className={navCls}><ShoppingCart className="mr-2 h-4 w-4" />Orders</NavLink>
                            <NavLink href="/sourcing/goods-receipts" className={navCls}><Truck className="mr-2 h-4 w-4" />Goods Receipts</NavLink>
                            <NavLink href="/sourcing/invoices" className={navCls}><FileText className="mr-2 h-4 w-4" />Invoice Records</NavLink>
                            <NavLink href="/sourcing/contracts" className={navCls}><FileText className="mr-2 h-4 w-4" />Agreements</NavLink>
                            <NavLink href="/transactions" className={navCls}><ArrowRightLeft className="mr-2 h-4 w-4" />Transactions</NavLink>
                            <NavLink href="/contacts" className={navCls}><ContactRound className="mr-2 h-4 w-4" />Contacts</NavLink>
                            <NavLink href="/savings" className={navCls}><PiggyBank className="mr-2 h-4 w-4" />Savings</NavLink>
                        </div>
                    </div>
                )}

                {/* ── Vendor Portal ── */}
                {role === 'supplier' && (
                    <div className="px-3 mt-3">
                        <h2 className="mb-1 px-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            Vendor Portal
                        </h2>
                        <div className="space-y-0.5">
                            {supplierLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <NavLink key={link.href} href={link.href} className={navCls}>
                                        <Icon className="mr-2 h-4 w-4" />
                                        {link.label}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Resources ── */}
                <div className="px-3 mt-3 border-t border-border/50 pt-2">
                    <h2 className="mb-1 px-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                        Resources
                    </h2>
                    <div className="space-y-0.5">
                        {role !== 'supplier' && (
                            <NavLink href="/docs" className={navCls}><BookOpen className="mr-2 h-4 w-4" />Axiom Playbook</NavLink>
                        )}
                        <NavLink href="/support" className={navCls}><LifeBuoy className="mr-2 h-4 w-4" />Help & Support</NavLink>
                    </div>
                </div>

                {/* ── Admin / Intelligence ── */}
                {(role === 'admin' || role === 'user') && (
                    <div className="px-3 mt-3 border-t border-border/50 pt-2">
                        <h2 className="mb-1 px-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-70">
                            {role === 'admin' ? "Admin Control" : "Intelligence & Audit"}
                        </h2>
                        <div className="space-y-0.5">
                            {adminLinks
                                .filter(link => {
                                    if (role === 'admin') return true;
                                const userVisiblePaths = ['/admin/audit', '/admin/analytics', '/admin/risk', '/admin/tasks', '/admin/compliance'];
                                    return userVisiblePaths.includes(link.href);
                                })
                                .map((link) => {
                                    const Icon = link.icon;
                                    return (
                                        <NavLink key={link.href} href={link.href} className="flex items-center rounded-sm px-3 py-1 text-[13px] font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group">
                                            <Icon className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-sidebar-primary transition-colors" />
                                            {link.label}
                                        </NavLink>
                                    );
                                })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
