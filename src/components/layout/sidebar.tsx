import Link from "next/link";
import {
    LayoutDashboard,
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
    ClipboardList,
    Warehouse,
    ReceiptText,
    Scale,
    Globe,
    Layers,
    Building2,
    Leaf,
} from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { AxiomLogo } from "@/components/shared/axiom-logo";
import { NavLink } from "@/components/layout/nav-link";

type SessionUser = {
    role?: string | null;
};

const adminPriorityLinks = [
    { label: "Fraud Alerts", icon: ShieldAlert, href: "/admin/fraud-alerts" },
    { label: "Telemetry", icon: History, href: "/admin/telemetry" },
    { label: "Financial Matching", icon: CreditCard, href: "/admin/financial-matching" },
    { label: "Spend Intelligence", icon: BarChart3, href: "/admin/analytics" },
    { label: "Risk Intelligence", icon: ShieldAlert, href: "/admin/risk" },
];

const adminOperationalLinks = [
    { label: "Task Inbox", icon: Inbox, href: "/admin/tasks" },
    { label: "Compliance", icon: ShieldCheck, href: "/admin/compliance" },
    { label: "User Management", icon: UserCog, href: "/admin/users" },
    { label: "Support Tickets", icon: LifeBuoy, href: "/admin/support" },
    { label: "Audit Trail", icon: History, href: "/admin/audit" },
    { label: "Import Data", icon: FileUp, href: "/admin/import" },
    { label: "Admin Settings", icon: Settings, href: "/admin/settings" },
    { label: "Scenario Modeling", icon: BarChart3, href: "/admin/scenarios" },
    { label: "Supplier Ecosystem", icon: Globe, href: "/admin/ecosystem" },
];

const supplierLinks = [
    { label: "My Portal", icon: LayoutDashboard, href: "/portal" },
    { label: "Incoming Bids", icon: FileText, href: "/portal/rfqs" },
    { label: "Active Orders", icon: ShoppingCart, href: "/portal/orders" },
    { label: "My Documents", icon: FileText, href: "/portal/documents" },
    { label: "Requests & Tasks", icon: ClipboardList, href: "/portal/requests" },
];

/* ---- tiny helper for nav links ---- */
const navCls = "flex items-center rounded-md px-3 py-1 text-[13px] font-medium hover:bg-accent hover:text-accent-foreground transition-colors";

export async function Sidebar({ className }: { className?: string }) {
    const session = await auth();
    const role = (session?.user as SessionUser | undefined)?.role;
    const visiblePriorityLinks = role === 'admin' ? adminPriorityLinks : [];
    const visibleOperationalLinks = role === 'admin' ? adminOperationalLinks : [];
    const workspaceLabel = role === 'admin' ? 'Admin Console' : role === 'supplier' ? 'Supplier Portal' : 'Internal Workspace';
    const workspaceDescription = role === 'admin'
        ? 'Restricted controls, approvals, and intelligence'
        : role === 'supplier'
            ? 'External access limited to vendor-facing work'
            : 'Operational sourcing and procurement workspace';
    const workspaceBadgeClass = role === 'admin'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : role === 'supplier'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-blue-200 bg-blue-50 text-blue-700';
    const homeLabel = role === 'admin' ? 'Admin Console' : role === 'supplier' ? 'Supplier Portal' : 'Workspace';

    return (
        <div className={cn("flex h-full w-64 flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground xl:w-72", className)}>
            <div className="show-scrollbar min-h-0 flex-1 overflow-y-auto pb-3">

                {/* ── Brand ── */}
                <div className="px-4 py-4 flex items-center gap-3 border-b border-border/40 mb-1">
                    <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/30 shrink-0">
                        <AxiomLogo className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[16px] font-black tracking-tight text-foreground">Axiom</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Procurement OS</span>
                    </div>
                </div>

                <div className="mx-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <span className={cn("inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]", workspaceBadgeClass)}>
                        {workspaceLabel}
                    </span>
                    <p className="mt-2 text-[12px] font-semibold text-foreground">{workspaceDescription}</p>
                </div>

                {/* ── Primary Nav ── */}
                <div className="px-3 mt-2 space-y-0.5">
                    <NavLink href={role === 'supplier' ? '/portal' : '/'} className={navCls}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {homeLabel}
                    </NavLink>
                    {role !== 'supplier' && (
                        <NavLink href="/suppliers" className={navCls}>
                            <Building2 className="mr-2 h-4 w-4" />
                            Suppliers
                        </NavLink>
                    )}
                </div>
                {/* AI Features - highlighted */}
                <div className="px-3 mt-2 space-y-1">
                    <NavLink href="/copilot" className={cn(navCls, "bg-primary/8 text-primary border border-primary/15 hover:bg-primary/12 font-semibold")}>
                        <AxiomLogo className="mr-2 h-4 w-4 text-primary" />
                        Axiom Copilot
                    </NavLink>
                    {role === 'admin' && (
                        <Link href="/admin/agents">
                            <span className="flex items-center rounded-md px-3 py-1.5 text-[13px] font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-400 transition-all border border-emerald-200/60 dark:border-emerald-800/40">
                                <Layers className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                AI Agents
                                <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">10</span>
                            </span>
                        </Link>
                    )}
                </div>

                {/* ── Sourcing ── */}
                {role !== 'supplier' && (
                    <div className="px-3 mt-4">
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="h-px flex-1 bg-border/50" />
                            <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Sourcing</span>
                            <span className="h-px flex-1 bg-border/50" />
                        </div>
                        <div className="space-y-0.5">
                            <NavLink href="/sourcing/parts" className={navCls}><Package className="mr-2 h-4 w-4" />Parts Catalog</NavLink>
                            <NavLink href="/sourcing/rfqs" className={navCls}><FileText className="mr-2 h-4 w-4" />Sourcing Requests</NavLink>
                            <NavLink href="/sourcing/requisitions" className={navCls}><ClipboardList className="mr-2 h-4 w-4" />Requisitions</NavLink>
                            <NavLink href="/sourcing/orders" className={navCls}><ShoppingCart className="mr-2 h-4 w-4" />Orders</NavLink>
                            <NavLink href="/sourcing/goods-receipts" className={navCls}><Truck className="mr-2 h-4 w-4" />Goods Receipts</NavLink>
                            <NavLink href="/sourcing/contracts" className={navCls}><Scale className="mr-2 h-4 w-4" />Contracts</NavLink>
                        </div>
                    </div>
                )}

                {/* ── Finance ── */}
                {role !== 'supplier' && (
                    <div className="px-3 mt-4">
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="h-px flex-1 bg-border/50" />
                            <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Finance</span>
                            <span className="h-px flex-1 bg-border/50" />
                        </div>
                        <div className="space-y-0.5">
                            <NavLink href="/sourcing/invoices" className={navCls}><ReceiptText className="mr-2 h-4 w-4" />Invoices</NavLink>
                            <NavLink href="/inventory" className={navCls}><Warehouse className="mr-2 h-4 w-4" />Inventory</NavLink>
                            <NavLink href="/transactions" className={navCls}><ArrowRightLeft className="mr-2 h-4 w-4" />Transactions</NavLink>
                            <NavLink href="/contacts" className={navCls}><ContactRound className="mr-2 h-4 w-4" />Contacts</NavLink>
                            <NavLink href="/savings" className={navCls}><PiggyBank className="mr-2 h-4 w-4" />Savings</NavLink>
                            <NavLink href="/sustainability" className={navCls}><Leaf className="mr-2 h-4 w-4" />Sustainability</NavLink>
                        </div>
                    </div>
                )}

                {/* ── Vendor Portal ── */}
                {role === 'supplier' && (
                    <div className="px-3 mt-4">
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="h-px flex-1 bg-border/50" />
                            <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Vendor Portal</span>
                            <span className="h-px flex-1 bg-border/50" />
                        </div>
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
                <div className="px-3 mt-4">
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                        <span className="h-px flex-1 bg-border/50" />
                        <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Resources</span>
                        <span className="h-px flex-1 bg-border/50" />
                    </div>
                    <div className="space-y-0.5">
                        {role !== 'supplier' && (
                            <NavLink href="/docs" className={navCls}><BookOpen className="mr-2 h-4 w-4" />Axiom Playbook</NavLink>
                        )}
                        <NavLink href="/support" className={navCls}><LifeBuoy className="mr-2 h-4 w-4" />Help & Support</NavLink>
                    </div>
                </div>

                {/* ── Admin / Intelligence ── */}
                {role === 'admin' && (
                    <div className="px-3 mt-4">
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className="h-px flex-1 bg-border/50" />
                            <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Intelligence</span>
                            <span className="h-px flex-1 bg-border/50" />
                        </div>
                        <div className="space-y-0.5">
                            {visiblePriorityLinks.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <NavLink key={link.href} href={link.href} className={navCls}>
                                        <Icon className="mr-2 h-4 w-4" />
                                        {link.label}
                                    </NavLink>
                                );
                            })}
                        </div>
                        {visibleOperationalLinks.length > 0 && (
                            <div className="mt-3">
                                <div className="flex items-center gap-2 mb-1.5 px-1">
                                    <span className="h-px flex-1 bg-border/50" />
                                    <span className="text-[9.5px] font-black tracking-[0.12em] text-muted-foreground/50 uppercase">Operations</span>
                                    <span className="h-px flex-1 bg-border/50" />
                                </div>
                                <div className="space-y-0.5">
                                    {visibleOperationalLinks.map((link) => {
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
                    </div>
                )}

            </div>
            {/* ── Footer ── */}
            <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9.5px] font-bold text-muted-foreground/50 uppercase tracking-[0.12em]">System Online</span>
            </div>
        </div>
    );
}
