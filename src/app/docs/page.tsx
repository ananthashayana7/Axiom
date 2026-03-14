"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    BookOpen,
    LayoutDashboard,
    Users,
    Package,
    FileText,
    ShoppingCart,
    MessageSquare,
    Sparkles,
    ShieldCheck,
    Search,
    Filter,
    ArrowRight,
    ChevronRight,
    Share2,
    CheckCircle2,
    Info,
    RefreshCcw,
    Scale,
    Database,
    TrendingUp,
    Cpu,
    Lock,
    History,
    Cloud,
    Terminal,
    HardDrive,
    Fingerprint,
    Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS = [
    {
        id: "overview",
        title: "Platform Vision",
        icon: LayoutDashboard,
        content: "Axiom is a high-performance Procurement Intelligence platform designed to turn fragmented supply chain data into strategic leverage. It moves organizations from reactive 'buying' to proactive 'Strategic Sourcing'.",
        steps: [
            "Visibility — Unified data layer eliminates 'Shadow Spend' by tracking every transaction across all departments.",
            "Intelligence — Native AI integration identifies risk patterns and cost-saving opportunities in real-time.",
            "Accountability — Every single change in the system is cryptographically linked to a user via the Audit Trail.",
            "Efficiency — Automated reorder loops and 3-way matching replace manual administrative overhead.",
            "Strategic Depth — Move beyond transactions to manage Supplier Lifecycle, ESG compliance, and Risk Control Towers."
        ]
    },
    {
        id: "tech_stack",
        title: "Architecture & Stack",
        icon: Database,
        content: "Modern, scalable, and secure. Axiom is built on a 'Full-Stack TypeScript' philosophy for maximum speed and type safety.",
        steps: [
            "Frontend — Next.js 14 (App Router) with React Server Components for near-instant page loads and optimal SEO.",
            "Styling — Vanilla CSS with Tailwind utilities and Framer Motion for high-fidelity, fluid user experiences.",
            "Database — PostgreSQL with Drizzle ORM for type-safe, performance-optimized relational queries and migrations.",
            "State Management — React Hooks and Server Actions for a 'zero-client-side-boilerplate' architecture.",
            "Deployment — Dockerized environment ensuring identical behavior across Local, Staging, and Production environments."
        ]
    },
    {
        id: "ai_engine",
        title: "AI Intelligence Engine",
        icon: Cpu,
        content: "Powering the Axiom Copilot and Automated Insights. We use Retrieval-Augmented Generation (RAG) to keep AI grounded in your actual data snapshot.",
        steps: [
            "LLM Integration — Powered by Google Gemini AI (1.5 Flash/Pro) for massive context window and rapid processing.",
            "RAG Architecture — The system injects live DB context (Spend, Risks, Parts) into prompts before AI processing.",
            "Deterministic Fallbacks — If the AI API is unreachable, heuristic-based scrapers maintain core analysis functionality.",
            "Natural Language Queries — 'Axiom Copilot' understands complex procurement intents like 'Show me suppliers with risk > 50'.",
            "Auto-Replenishment AI — Predictive stock monitoring triggers Requisition Drafts based on historical consumption velocity."
        ]
    },
    {
        id: "traceability",
        title: "Audit & Traceability",
        icon: History,
        content: "In procurement, 'Who' and 'When' are as important as 'What'. Axiom maintains an immutable record of every action.",
        steps: [
            "The Activity Log — Every Create, Update, or Delete action is recorded in the `audit_logs` table automatically.",
            "Identity Mapping — Log entries capture User ID, Action Type, Entity ID (Part/PO/Supplier), and a technical summary.",
            "Immutable Trail — Audit logs are write-only to ensure they remains a 'Source of Truth' for annual external audits.",
            "System Telemetry — Real-time performance monitoring tracks AI latency, token usage, and database query health.",
            "Data Versioning — Ability to trace back an Invoice to the specific RFQ and Quote that originated 6 months prior."
        ]
    },
    {
        id: "data_modeling",
        title: "Data Modeling & Logic",
        icon: HardDrive,
        content: "Transparent and robust data structures. Our schema is designed for high-performance relational analytics.",
        steps: [
            "Relational Core — Highly normalized schema linking Users, Suppliers, Parts, and Orders with strict Foreign Keys.",
            "Enums & Constraints — Standardized statuses (Active/Blacklisted/Draft) ensure data integrity at the DB level.",
            "Complex Joins — Optimized Drizzle queries handle deep relations like 'Order -> Supplier -> Performance Logs' efficiently.",
            "Telemetry Streams — A dedicated table tracks System Events, Metrics, and Errors for dev-ops visibility.",
            "Flexible Documentation — Documents table handles multi-type attachments (Invoices, Contracts) linked to any entity."
        ]
    },
    {
        id: "foundations",
        title: "Procurement Workflows",
        icon: BookOpen,
        content: "Axiom enforces industry-standard procurement cycles to ensure financial discipline and legal compliance.",
        steps: [
            "1. Material Catalog — Defining the 'Digital Twin' of every part with SKU, Category, and Benchmark Pricing.",
            "2. Demand Generation — Needs enter as Requisitions. Managers approve based on live department budget visibility.",
            "3. Competitive Sourcing (RFQ) — Multi-vendor bidding (Rule of Three) ensures the organization gets the 'Best Pick'.",
            "4. The Commitment (PO) — Winning quotes become legal Purchase Orders, locking in price, lead time, and terms.",
            "5. Supply Chain Execution — Goods Receipt (GRN) marking at the warehouse triggers the financial downstream flow."
        ]
    },
    {
        id: "compliance",
        title: "Financial Compliance",
        icon: Scale,
        content: "Closing 'The Loop'. Axiom's matching engine prevents overpayment, fraud, and maverick spend.",
        steps: [
            "The 3-Way Match — The system automatically flags discrepancies between PO Price, GRN Quantity, and Invoice Amount.",
            "Dispute Management — Orders with mismatch (Amber status) are locked from payment until a Buyer resolves the data.",
            "Performance Scoring — Suppliers are dynamically graded on delivery accuracy (OIF) and quality consistency.",
            "ESG Validation — Tracking 'Green Energy' usage and Labor Compliance as mandatory gates in the onboarding process.",
            "Risk Control Tower — Real-time monitoring of supplier risk scores based on financial health and delivery history."
        ]
    },
    {
        id: "security",
        title: "Enterprise Security",
        icon: Lock,
        content: "Multi-layered defense for sensitive financial data. Axiom prioritizes the 'Principle of Least Privilege'.",
        steps: [
            "RBAC Control — Role-Based Access (Admin/User/Supplier) ensures restricted visibility of financial PII.",
            "2FA Enforcement — Two-Factor Authentication via TOTP (Authenticator Apps) for all high-authority accounts.",
            "Secure Auth — Built on Auth.js (NextAuth) using industry-standard JWT and database-backed session logic.",
            "Row-Level Logic — Application-level middleware prevents cross-tenant data access attempts.",
            "Encryption at Rest — Sensitive fields like 2FA secrets and API keys are stored with high-entropy encryption."
        ]
    },
    {
        id: "connectivity",
        title: "Global Connectivity",
        icon: Cloud,
        content: "Axiom isn't just a local app. It bridges the gap between your desktop and the global supply chain.",
        steps: [
            "LocalTunnel Integration — Instantly share your local development instance with remote stakeholders via secure tunnels.",
            "Electron Framework — Portable `.exe` and `.dmg` builds allow Axiom to run as a native desktop application.",
            "Static Optimization — High-performance document serving and caching for large-scale procurement catalogs.",
            "External API Support — Ready for integration with external ERPs (SAP/Oracle) via standard REST patterns."
        ]
    },
    {
        id: "contacts_module",
        title: "Contacts Module",
        icon: Users,
        content: "The Contacts directory centralizes supplier-side and internal stakeholder phonebook data with searchable metadata for continent, country, and region.",
        steps: [
            "Unified Directory — Capture Name, Email, Phone, Company, Job Title, and notes in a single indexed table.",
            "Regional Tagging — Every contact can be tagged by Country, Region, Continent, and preferred Currency for faster routing.",
            "Actionable Profiles — One-click `mailto:` links and status switches reduce handoffs between buyers and category managers.",
            "Exportability — Contacts can be exported to CSV for governance, audits, and cross-system synchronization.",
            "Data Hygiene — Active/Inactive/On Hold lifecycle states keep stale contacts from polluting operational communication."
        ]
    },
    {
        id: "savings_module",
        title: "Savings Intelligence",
        icon: TrendingUp,
        content: "Savings Intelligence transforms negotiation outcomes into quantified business impact with transparent formulas and drill-down analytics.",
        steps: [
            "Baseline Capture — The platform stores `initialQuoteAmount` and `totalAmount` at order level for factual savings math.",
            "Core Formula — Realized Savings = max(0, Sum(Initial Quote) - Sum(Final Spend)).",
            "Savings Rate — Savings Rate = Realized Savings / Sum(Initial Quote), expressed as a percentage.",
            "Dimensional Insights — Savings can be sliced by Supplier, Month, and Savings Type (negotiation, volume, strategic).",
            "Decision Support — Top savings orders and supplier-level contribution reveal where sourcing effort yields highest returns."
        ]
    },
    {
        id: "transactions_module",
        title: "Transactions Hub",
        icon: RefreshCcw,
        content: "The Transactions page creates a single operational ledger for Orders, Goods Receipts, Invoices, and Quantity Contracts.",
        steps: [
            "Unified Feed — Cross-module records are normalized into one timeline with sortable type labels.",
            "Operational Filtering — Users can filter by transaction type, date windows, and reference search terms.",
            "Financial Visibility — Amounts render dynamically in INR or EUR for multinational procurement teams.",
            "Faster Reconciliation — Shared references reduce lookup time during three-way match investigations.",
            "Audit Readiness — CSV exports preserve a point-in-time trail of transactional activity for compliance."
        ]
    },
    {
        id: "support_module",
        title: "Help & Support",
        icon: MessageSquare,
        content: "Axiom includes a built-in support workflow with ticketing and knowledge guidance to reduce downtime and user friction.",
        steps: [
            "Ticket Lifecycle — Submit, track, and resolve requests through Open, In Progress, Resolved, and Closed states.",
            "Priority Routing — Low/Medium/High/Critical prioritization enables operational triage.",
            "Support Inbox — Notifications are routed through `axiom-no_reply@outlook.com` for consistent communication.",
            "Knowledge Base — FAQ prompts cover login recovery, imports, currency logic, and module access.",
            "Role Governance — Admins can oversee all tickets while end users only access their own request history."
        ]
    },
    {
        id: "currency_geo",
        title: "Currency & Regional Support",
        icon: Filter,
        content: "Cross-region procurement requires localization by geography and currency; Axiom applies this across invoices, contacts, and analytics.",
        steps: [
            "Dual Currency UX — INR/EUR toggles provide immediate executive and operational comparability.",
            "Regional Metadata — Invoices and contacts capture Country, Region, and Continent for risk heatmaps and planning.",
            "Export Consistency — CSV outputs include currency and geography so downstream teams retain context.",
            "Scalable Standardization — Shared dimensions simplify rollups across India and Germany business units.",
            "Future Extension — Exchange-rate feeds can replace fixed conversion when treasury controls are introduced."
        ]
    },
    {
        id: "devops",
        title: "System Operations",
        icon: Terminal,
        content: "Maintaining the engine. Axiom is designed for developer ease and operational stability.",
        steps: [
            "Docker Orchestration — Single-command `docker-compose up` spins up Next.js, Postgres, and Adminer.",
            "Next.js Standalone — Optimized build output for containerized environments to minimize image size.",
            "Database Hygiene — Integrated Reset Utilities allow admins to clear transactional data while preserving configurations.",
            "Real-time Logs — Telemetry-driven error tracking provides deep visibility into server-side failures.",
            "CI/CD Ready — Built-in linting and type-checking ensure code quality remains high during iterative development."
        ]
    }
];

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState("overview");

    return (
        <div className="flex h-screen bg-background overflow-hidden font-sans">
            {/* Sidebar Navigation */}
            <div className="w-72 border-r bg-muted/20 flex flex-col shrink-0">
                <div className="pt-4 pb-6 px-6 border-b bg-background">
                    <div className="flex items-center gap-4 mb-1">
                        <div className="h-10 w-10 rounded-sm bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                                <path d="M12 4L3 20H7L12 11L17 20H21L12 4Z" opacity="0.3" />
                                <path d="M12 11L8 18H16L12 11Z" />
                                <path d="M2.5 20L10 6L12 10L5 21H2.5Z" />
                                <path d="M21.5 20L14 6L12 10L19 21H21.5Z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight font-display text-primary">AXIOM PLAYBOOK</h1>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
                    {SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                                        : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                                <span className="font-bold text-sm tracking-tight">{section.title}</span>
                                {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 border-t bg-background/50">
                    <div className="rounded-xl p-4 bg-primary/5 border border-primary/10 mb-4">
                        <p className="text-xs text-primary font-bold mb-1 italic">Need extra help?</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Use the <span className="text-primary font-semibold">Axiom Copilot</span> for real-time natural language answers about your specific data.
                        </p>
                    </div>
                    <div className="px-2 py-1 border-l-2 border-primary/20">
                        <p className="text-[10px] font-black tracking-widest text-muted-foreground/40 uppercase">Architected & Developed By</p>
                        <p className="text-sm font-bold text-foreground font-display tracking-tight">A. Anantha Shayana, <span className="text-primary/70 text-[11px]">AI Expert</span></p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-background to-muted/30 scrollbar-thin">
                <div className="max-w-5xl mx-auto p-12 py-16">
                    <AnimatePresence mode="wait">
                        {SECTIONS.filter(s => s.id === activeSection).map((section) => {
                            const Icon = section.icon;
                            return (
                                <motion.div
                                    key={section.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="space-y-10"
                                >
                                    {/* Header Section */}
                                    <div className="space-y-4">
                                        <Badge variant="outline" className="px-3 py-1 bg-background font-black text-xs uppercase tracking-widest border-primary/20 text-primary">
                                            {section.id.replace('_', ' ')}
                                        </Badge>
                                        <div className="flex items-center gap-4">
                                            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                                                <Icon className="h-8 w-8 text-white" />
                                            </div>
                                            <h2 className="text-5xl font-black tracking-tighter">{section.title}</h2>
                                        </div>
                                        <p className="text-xl text-muted-foreground leading-relaxed font-medium">
                                            {section.content}
                                        </p>
                                    </div>

                                    {/* Detailed Guide */}
                                    {section.steps && (
                                        <div className="grid gap-6">
                                            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-4">
                                                <Info size={16} />
                                                Step-by-Step Workflow
                                            </div>
                                            <div className="space-y-4">
                                                {section.steps.map((step, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-start gap-6 p-6 rounded-2xl bg-background border shadow-sm transition-all hover:shadow-md hover:border-primary/20 group"
                                                    >
                                                        <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-black text-lg text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                                                            {index + 1}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-lg font-bold text-foreground leading-snug">
                                                                {step.split('—')[0]}
                                                            </p>
                                                            {step.includes('—') && (
                                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                                    {step.split('—')[1]}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Empty State / Overview Footer */}
                                    {!section.steps && (
                                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-3xl bg-muted/10 opacity-60">
                                            <Sparkles className="h-12 w-12 text-primary" />
                                            <p className="max-w-xs text-sm font-medium">
                                                This section provides a high-level summary of your operational metrics. Navigate using the sidebar to explore specific workflow guides.
                                            </p>
                                        </div>
                                    )}

                                    {/* Navigation Footer */}
                                    <div className="pt-12 border-t flex items-center justify-between group cursor-pointer" onClick={() => {
                                        const currentIndex = SECTIONS.findIndex(s => s.id === activeSection);
                                        const nextIndex = (currentIndex + 1) % SECTIONS.length;
                                        setActiveSection(SECTIONS[nextIndex].id);
                                    }}>
                                        <div className="text-sm">
                                            <p className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest mb-1">Up Next</p>
                                            <p className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors">
                                                {SECTIONS[(SECTIONS.findIndex(s => s.id === activeSection) + 1) % SECTIONS.length].title}
                                            </p>
                                        </div>
                                        <div className="h-12 w-12 rounded-full border flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all group-hover:border-primary group-hover:scale-110">
                                            <ArrowRight />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
