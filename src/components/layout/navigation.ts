import type { ComponentType } from "react";
import {
    AlertTriangle,
    ArrowRightLeft,
    BarChart3,
    BookOpen,
    ClipboardList,
    ContactRound,
    CreditCard,
    FileText,
    FileUp,
    History,
    Inbox,
    LayoutDashboard,
    LifeBuoy,
    LineChart,
    Package,
    PiggyBank,
    Settings,
    ShieldAlert,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Truck,
    UserCog,
    Users,
    Warehouse,
} from "lucide-react";
import { canAccessAIFleet, canAccessAdminPath, type SessionAccessUser } from "@/lib/rbac";

export type NavigationRole = SessionAccessUser | null | undefined;

export type NavigationLink = {
    href: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    emphasis?: 'copilot' | 'agents';
};

export type NavigationSection = {
    id: string;
    title?: string;
    links: NavigationLink[];
};

const adminControlLinks: NavigationLink[] = [
    { label: 'Fraud Alerts',       icon: ShieldAlert, href: '/admin/fraud-alerts'      },
    { label: 'Telemetry',          icon: History,     href: '/admin/telemetry'           },
    { label: 'Financial Matching', icon: CreditCard,  href: '/admin/financial-matching'  },
    { label: 'Spend Intelligence', icon: BarChart3,   href: '/admin/analytics'           },
    { label: 'Risk Intelligence',  icon: ShieldAlert, href: '/admin/risk'                },
];

const adminOperationLinks: NavigationLink[] = [
    { label: 'Task Inbox',         icon: Inbox,       href: '/admin/tasks'      },
    { label: 'Compliance',         icon: ShieldCheck, href: '/admin/compliance' },
    { label: 'User Management',    icon: UserCog,     href: '/admin/users'      },
    { label: 'Support Tickets',    icon: LifeBuoy,    href: '/admin/support'    },
    { label: 'Audit Trail',        icon: History,     href: '/admin/audit'      },
    { label: 'Import Data',        icon: FileUp,      href: '/admin/import'     },
    { label: 'Admin Settings',     icon: Settings,    href: '/admin/settings'   },
    { label: 'Scenario Modeling',  icon: BarChart3,   href: '/admin/scenarios'  },
    { label: 'Supplier Ecosystem', icon: Users,       href: '/admin/ecosystem'  },
];

export function getNavigationSections(user: NavigationRole): NavigationSection[] {
    const role = user?.role;
    const workspaceLabel =
        role === 'admin'
            ? 'Admin Console'
            : role === 'supplier'
                ? 'Supplier Portal'
                : 'Workspace';

    const sections: NavigationSection[] = [
        {
            id: 'primary',
            links: [
                { label: workspaceLabel,    icon: LayoutDashboard, href: role === 'supplier' ? '/portal' : '/' },
                ...(role !== 'supplier' ? [{ label: 'Suppliers',        icon: Users,       href: '/suppliers'   }] : []),
                // NEW: Analytics Studio — the selling-point visualization section
                ...(role !== 'supplier' ? [{ label: 'Analytics Studio', icon: LineChart,   href: '/analytics'   }] : []),
                ...(role !== 'supplier' ? [{ label: 'Axiom Copilot',    icon: Sparkles,    href: '/copilot', emphasis: 'copilot' as const }] : []),
                ...(role === 'admin' && canAccessAIFleet(user) ? [{ label: 'AI Agents', icon: Sparkles, href: '/admin/agents', emphasis: 'agents' as const }] : []),
            ],
        },
        ...(role !== 'supplier'
            ? [{
                id: 'sourcing',
                title: 'Sourcing',
                links: [
                    { label: 'Parts Catalog',        icon: Package,       href: '/sourcing/parts'          },
                    { label: 'Sourcing Requests',    icon: FileText,      href: '/sourcing/rfqs'           },
                    { label: 'Requisitions',         icon: ShoppingCart,  href: '/sourcing/requisitions'   },
                    { label: 'Orders',               icon: ShoppingCart,  href: '/sourcing/orders'         },
                    { label: 'Goods Receipts',       icon: Truck,         href: '/sourcing/goods-receipts' },
                    { label: 'Exception Management', icon: AlertTriangle, href: '/sourcing/exceptions'     },
                    { label: 'Invoice Records',      icon: FileText,      href: '/sourcing/invoices'       },
                    { label: 'Agreements',           icon: FileText,      href: '/sourcing/contracts'      },
                    // NEW: Inventory (was a hidden route, now surfaced in nav)
                    { label: 'Inventory',            icon: Warehouse,     href: '/inventory'               },
                    { label: 'Transactions',         icon: ArrowRightLeft, href: '/transactions'           },
                    { label: 'Contacts',             icon: ContactRound,  href: '/contacts'                },
                    { label: 'Savings',              icon: PiggyBank,     href: '/savings'                 },
                ],
            }]
            : [{
                id: 'vendor-portal',
                title: 'Vendor Portal',
                links: [
                    { label: 'My Portal',        icon: LayoutDashboard, href: '/portal'           },
                    { label: 'Incoming Bids',    icon: FileText,        href: '/portal/rfqs'      },
                    { label: 'Active Orders',    icon: ShoppingCart,    href: '/portal/orders'    },
                    { label: 'My Documents',     icon: FileText,        href: '/portal/documents' },
                    { label: 'Requests & Tasks', icon: ClipboardList,   href: '/portal/requests'  },
                ],
            }]),
        {
            id: 'resources',
            title: 'Resources',
            links: [
                ...(role !== 'supplier' ? [{ label: 'Axiom Playbook', icon: BookOpen, href: '/docs'    }] : []),
                { label: 'Help & Support', icon: LifeBuoy, href: '/support' },
            ],
        },
        ...(role === 'admin'
            ? [
                {
                    id: 'admin-control',
                    title: 'Admin Control',
                    links: adminControlLinks.filter((link) => canAccessAdminPath(user, link.href)),
                },
                {
                    id: 'admin-operations',
                    title: 'Operations',
                    links: adminOperationLinks.filter((link) => canAccessAdminPath(user, link.href)),
                },
            ]
            : []),
    ];

    return sections.filter((section) => section.links.length > 0);
}