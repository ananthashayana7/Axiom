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
import { canAccessAIFleet, canAccessAdminPath } from "@/lib/rbac";

type SessionUser = {
    role?: string | null;
    accessProfile?: string | null;
    department?: string | null;
    countryScope?: string | null;
    regionScope?: string | null;
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

const navCls = "flex items-center rounded-md px-3 py-1 text-[13px] font-medium text-sidebar-foreground/92 transition-colors hover:bg-accent hover:text-accent-foreground";
const sectionLabelCls = "text-[10.5px] font-black uppercase tracking-[0.16em] text-sidebar-foreground/78";
const sectionDividerCls = "h-px flex-1 bg-sidebar-foreground/18";

export async function Sidebar({ className }: { className?: string }) {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const role = user?.role;
    const visiblePriorityLinks = role === "admin" ? adminPriorityLinks.filter((link) => canAccessAdminPath(user, link.href)) : [];
    const visibleOperationalLinks = role === "admin" ? adminOperationalLinks.filter((link) => canAccessAdminPath(user, link.href)) : [];
    const workspaceLabel = role === "admin" ? "Admin Console" : role === "supplier" ? "Supplier Portal" : "Internal Workspace";
    const workspaceDescription = role === "admin"
        ? "Platform controls, approvals, intelligence, and operating oversight"
        : role === "supplier"
            ? "Vendor-facing workspace for bids, orders, documents, and requests"
            : "Operational sourcing, requisitions, and invoice coordination";
    const workspaceBadgeClass = role === "admin"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : role === "supplier"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-blue-200 bg-blue-50 text-blue-700";
    const homeLabel = role === "admin" ? "Admin Console" : role === "supplier" ? "Supplier Portal" : "Workspace";

    return (
        <div
            className={cn(
                "flex h-[100dvh] min-h-[100dvh] w-[17rem] min-w-[17rem] flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground xl:w-[18rem] xl:min-w-[18rem]",
                className,
            )}
        >
            <div className="show-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
                <div className="mb-1 flex items-center gap-3 border-b border-sidebar-border/70 px-4 py-4">
                    <div className="h-8 w-8 shrink-0 rounded-lg bg-primary shadow-md shadow-primary/30 flex items-center justify-center">
                        <AxiomLogo className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="text-[16px] font-black tracking-tight text-sidebar-foreground">Axiom</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/60">Procurement OS</span>
                    </div>
                </div>

                <div className="mx-3 rounded-2xl border border-sidebar-foreground/12 bg-white/70 px-3 py-3 text-slate-900">
                    <span className={cn("inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]", workspaceBadgeClass)}>
                        {workspaceLabel}
                    </span>
                    <p className="mt-2 text-[12px] font-semibold text-slate-900">{workspaceDescription}</p>
                </div>

                <div className="mt-2 space-y-0.5 px-3">
                    <NavLink href={role === "supplier" ? "/portal" : "/"} className={navCls}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {homeLabel}
                    </NavLink>
                    {role !== "supplier" && (
                        <NavLink href="/suppliers" className={navCls}>
                            <Building2 className="mr-2 h-4 w-4" />
                            Suppliers
                        </NavLink>
                    )}
                </div>

                <div className="mt-2 space-y-1 px-3">
                    {role !== "supplier" && (
                        <NavLink href="/copilot" className={cn(navCls, "border border-primary/25 bg-primary/12 text-emerald-100 font-semibold hover:bg-primary/18")}>
                            <AxiomLogo className="mr-2 h-4 w-4 text-primary" />
                            Axiom Copilot
                        </NavLink>
                    )}
                    {role === "admin" && canAccessAIFleet(user) && (
                        <Link href="/admin/agents">
                            <span className="flex items-center rounded-md border border-emerald-400/25 bg-emerald-500/14 px-3 py-1.5 text-[13px] font-semibold text-emerald-100 transition-all hover:bg-emerald-500/20">
                                <Layers className="mr-2 h-4 w-4 text-emerald-200" />
                                AI Agents
                                <span className="ml-auto rounded-full bg-emerald-300/18 px-1.5 py-0.5 text-[9px] font-black text-emerald-100">10</span>
                            </span>
                        </Link>
                    )}
                </div>

                {role !== "supplier" && (
                    <div className="mt-4 px-3">
                        <div className="mb-1.5 flex items-center gap-2 px-1">
                            <span className={sectionDividerCls} />
                            <span className={sectionLabelCls}>Sourcing</span>
                            <span className={sectionDividerCls} />
                        </div>
                        <div className="space-y-0.5">
                            <NavLink href="/sourcing/parts" className={navCls}><Package className="mr-2 h-4 w-4" />Parts Catalog</NavLink>
                            <NavLink href="/sourcing/rfqs" className={navCls}><FileText className="mr-2 h-4 w-4" />Sourcing Requests</NavLink>
                            <NavLink href="/sourcing/requisitions" className={navCls}><ClipboardList className="mr-2 h-4 w-4" />Requisitions</NavLink>
                            <NavLink href="/sourcing/orders" className={navCls}><ShoppingCart className="mr-2 h-4 w-4" />Orders</NavLink>
                            <NavLink href="/sourcing/goods-receipts" className={navCls}><Truck className="mr-2 h-4 w-4" />Goods Receipts</NavLink>
                            <NavLink href="/sourcing/exceptions" className={navCls}><ShieldAlert className="mr-2 h-4 w-4" />Exception Management</NavLink>
                            <NavLink href="/sourcing/contracts" className={navCls}><Scale className="mr-2 h-4 w-4" />Contracts</NavLink>
                        </div>
                    </div>
                )}

                {role !== "supplier" && (
                    <div className="mt-4 px-3">
                        <div className="mb-1.5 flex items-center gap-2 px-1">
                            <span className={sectionDividerCls} />
                            <span className={sectionLabelCls}>Finance</span>
                            <span className={sectionDividerCls} />
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

                {role === "supplier" && (
                    <div className="mt-4 px-3">
                        <div className="mb-1.5 flex items-center gap-2 px-1">
                            <span className={sectionDividerCls} />
                            <span className={sectionLabelCls}>Vendor Portal</span>
                            <span className={sectionDividerCls} />
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

                <div className="mt-4 px-3">
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                        <span className={sectionDividerCls} />
                        <span className={sectionLabelCls}>Resources</span>
                        <span className={sectionDividerCls} />
                    </div>
                    <div className="space-y-0.5">
                        {role !== "supplier" && (
                            <NavLink href="/docs" className={navCls}><BookOpen className="mr-2 h-4 w-4" />Axiom Playbook</NavLink>
                        )}
                        <NavLink href="/support" className={navCls}><LifeBuoy className="mr-2 h-4 w-4" />Help & Support</NavLink>
                    </div>
                </div>

                {role === "admin" && (visiblePriorityLinks.length > 0 || visibleOperationalLinks.length > 0) && (
                    <div className="mt-4 px-3">
                        {visiblePriorityLinks.length > 0 && (
                            <>
                                <div className="mb-1.5 flex items-center gap-2 px-1">
                                    <span className={sectionDividerCls} />
                                    <span className={sectionLabelCls}>Intelligence</span>
                                    <span className={sectionDividerCls} />
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
                            </>
                        )}
                        {visibleOperationalLinks.length > 0 && (
                            <div className="mt-3">
                                <div className="mb-1.5 flex items-center gap-2 px-1">
                                    <span className={sectionDividerCls} />
                                    <span className={sectionLabelCls}>Operations</span>
                                    <span className={sectionDividerCls} />
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
        </div>
    );
}
