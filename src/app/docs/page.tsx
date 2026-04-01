"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
    ArrowRight,
    Filter,
    ChevronRight,
    Share2,
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
    HardDrive
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
            "LLM Integration — Powered by Google Gemini AI (2.5 Flash) for massive context window and rapid processing.",
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
        diagram: {
            title: "End-to-End Procurement Flow",
            nodes: ["Material Catalog", "Requisition", "RFQ (Bidding)", "Purchase Order", "Goods Receipt", "Invoice Match", "Payment"],
        },
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
        diagram: {
            title: "3-Way Match Verification",
            nodes: ["Purchase Order", "Goods Receipt", "Supplier Invoice", "Match Engine", "Approved / Disputed"],
        },
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
            "Support Inbox — Notifications are routed through `pma.axiom.support@gmail.com` for consistent communication.",
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
    },
    {
        id: "sourcing_workflow",
        title: "Sourcing Request Workflow",
        icon: ShoppingCart,
        content: "A Sourcing Request (RFQ) is the formal process of inviting competitive quotes from qualified suppliers before committing to a purchase. Axiom walks you through each step.",
        diagram: {
            title: "RFQ to PO Flow",
            nodes: ["Create RFQ", "Invite Suppliers", "Collect Quotes", "Compare & Rank", "Award Winner", "Generate PO"],
        },
        steps: [
            "Create New Sourcing Request — Navigate to Sourcing → RFQs → New RFQ. Fill in the Part/SKU, required quantity, target delivery date, and attached specifications.",
            "Supplier Invitation — Add one or more suppliers to the RFQ. Each supplier receives an invitation via their registered email and can respond through the Supplier Portal.",
            "Quote Collection — Suppliers submit their unit price, lead time, and validity period. All quotes are tracked against the original RFQ for a full audit trail.",
            "Quote Comparison — Use the built-in comparison view to rank suppliers by price, lead time, and historical performance score.",
            "Award Decision — Select the winning quote to auto-generate a linked Purchase Order (PO). The rejected suppliers receive notifications.",
            "PO Lifecycle — The PO moves through: Draft → Pending Approval → Approved → Sent to Supplier → Fulfilled (after goods receipt) → Closed."
        ]
    },
    {
        id: "requisitions_workflow",
        title: "Internal Requisitions",
        icon: FileText,
        content: "Internal Requisitions allow any authorized user to request materials or services. They go through an approval workflow before becoming a PO.",
        diagram: {
            title: "Requisition Approval Flow",
            nodes: ["Submit Request", "Pending Approval", "Admin Review", "Approved", "Convert to PO", "Supplier Fulfills"],
        },
        steps: [
            "Submit Requisition — Go to Sourcing → Requisitions → New Requisition. Select the Part/SKU, quantity, urgency, and the department making the request.",
            "Auto-Budget Check — The system validates the request against the department's allocated budget envelope.",
            "Manager Approval — Requisitions above a threshold require manager-level approval. Notifications go to department leads automatically.",
            "PO Conversion — Once approved, Procurement can convert the requisition to a PO with a single click, pre-filling all line items.",
            "Status Tracking — Requisitioners can track approval status in real-time: Draft → Submitted → Under Review → Approved/Rejected → Converted to PO.",
            "Rejection Handling — Rejected requisitions return to the requester with the reason noted, allowing resubmission with corrections."
        ]
    },
    {
        id: "invoice_workflow",
        title: "Invoice Management & 3-Way Match",
        icon: Scale,
        content: "Invoice management in Axiom enforces 3-way matching to prevent fraudulent or erroneous payments. Each invoice must align with its PO and Goods Receipt.",
        diagram: {
            title: "Invoice Lifecycle",
            nodes: ["Invoice Received", "Pending Review", "3-Way Match", "Matched ✓", "Payment Released"],
        },
        steps: [
            "Invoice Receipt — Suppliers submit invoices via the Supplier Portal, or procurement staff manually logs them in Sourcing → Invoice Records.",
            "Currency Integrity — Every invoice preserves its original currency (INR, EUR, USD, etc.). Axiom never auto-converts amounts — what was invoiced is what is shown.",
            "3-Way Match — Admin navigates to Admin → Financial Matching. For each pending invoice, verify: (1) Supplier matches PO, (2) Quantities match GR, (3) Amount matches agreed price.",
            "Match Outcome — Click 'Match' to approve (status → Matched), or 'Dispute' to flag for supplier clarification (status → Disputed).",
            "Payment Release — Only Matched invoices can be moved to 'Paid'. Disputed invoices are frozen until the supplier responds and the admin resolves.",
            "Audit Completeness — Every status change (Pending → Matched → Paid) is logged in the Audit Trail with user ID, timestamp, and invoice reference."
        ]
    },
    {
        id: "process_reorders",
        title: "Process Reorders (Parts Intelligence)",
        icon: Package,
        content: "The 'Process Reorders' action in Parts Intelligence triggers the automated replenishment workflow for critical and low-stock SKUs.",
        steps: [
            "Stock Monitoring — Axiom continuously compares current stock levels against Min Stock Level and Reorder Point thresholds.",
            "Alert Classification — Parts below Reorder Point are 'Low Stock'; parts below Min Stock Level are 'Critical' (highlighted in red).",
            "Process Reorders Click — Clicking 'Process Reorders' on a critical part opens a pre-filled Requisition with the recommended order quantity (up to max stock level).",
            "Auto-Assignment — The system suggests the supplier with the best performance score and last quoted price for the SKU.",
            "Approval Fast-Track — Reorder requisitions above critical threshold can be auto-approved by admin policy for zero-delay procurement.",
            "Replenishment Loop — Once the PO is fulfilled and goods are received, stock levels automatically update and alerts clear."
        ]
    },
    {
        id: "supplier_data",
        title: "Supplier Data: Tier, ESG, Financial, Compliance",
        icon: ShieldCheck,
        content: "Supplier scorecards in Axiom are dynamically computed from transaction history, performance logs, and compliance events — not manual entry.",
        steps: [
            "Tier Classification — Tier 1 (Strategic), Tier 2 (Preferred), Tier 3 (Transactional). Updated by procurement managers based on spend volume and relationship depth.",
            "Financial Health Score — Calculated from: on-time payment rate, invoice dispute rate, order fulfillment rate, and external credit signals (manually entered or API-fed).",
            "ESG Score — Environment, Social, Governance index. Updated via performance log entries tagged as ESG events (e.g., 'Passed ISO 14001 audit', 'CSR Report submitted').",
            "Compliance Status — Tracks certification expiry dates (ISO, SOC2, GDPR, local regulations). Admin can log compliance milestones via Supplier Performance Logs.",
            "Automated Degradation — Repeated disputes, late deliveries, or failed QC inspections progressively lower the performance score automatically.",
            "Manual Overrides — Admin can set scores directly when external audit reports provide authoritative data not captured in transaction logs."
        ]
    },
    {
        id: "risk_intelligence",
        title: "Risk Intelligence",
        icon: ShieldCheck,
        content: "Risk Intelligence gives a real-time view of supply chain vulnerabilities across geopolitical, financial, and operational dimensions.",
        steps: [
            "Risk Score Computation — Each supplier's risk score (0–100) is derived from: financial health, ESG performance, delivery reliability, compliance status, and geographic risk.",
            "Geographic Risk Map — Countries are color-coded: Green = suppliers with low risk (<45), Amber = moderate (45–70), Red = high risk (>70). Only countries with actual suppliers are highlighted.",
            "Risk Categories — Operational Risk (delivery failures), Financial Risk (low health score), ESG Risk (non-compliance), Geopolitical Risk (country risk index).",
            "Intervention Actions — For any high-risk supplier, admin can: open a Sourcing Request to dual-source, add a Performance Log, or place the supplier on watchlist.",
            "Watchlist & Alerts — Suppliers crossing risk thresholds auto-generate alerts visible in the Risk Intelligence panel and the Notification Center.",
            "Reliability of Scores — Risk scores are as reliable as the data entered. Keeping supplier performance logs, QC records, and compliance dates updated directly improves accuracy."
        ]
    },
    {
        id: "ai_agents",
        title: "AI Agents",
        icon: Sparkles,
        content: "Axiom's AI agents are resilient, context-aware autonomous workers that analyze your live procurement data and surface actionable intelligence.",
        steps: [
            "Resilience Design — Every agent has a deterministic fallback path: if the Gemini API is unavailable or returns an error, heuristic algorithms compute the same output using rule-based logic.",
            "Context Injection — Before each agent run, the system injects a snapshot of relevant DB records (suppliers, orders, spend, risk) into the prompt for grounded responses.",
            "Available Agents — (1) Spend Optimizer: finds cost-reduction opportunities, (2) Risk Detector: surfaces new supplier risks, (3) Demand Forecaster: predicts reorder dates.",
            "Agent Execution Log — Every agent run is recorded in `agent_executions` with duration, success status, and output summary for full traceability.",
            "Manual Trigger vs Auto — Agents can be manually triggered by admin or set to run on a schedule (daily/weekly) via the Admin → Agents panel.",
            "Output Actions — Agent insights are surfaced as notifications and, where applicable, auto-draft Requisitions or Risk Alerts for admin review."
        ]
    },
    {
        id: "account_management",
        title: "Account Management & Roles",
        icon: Lock,
        content: "Axiom uses a role-based access control (RBAC) system. Account creation is exclusively the admin's responsibility.",
        steps: [
            "Admin Role — Full access: can see, create, edit, and delete across all modules. Can manage users, configure settings, run financial matching, and purge data.",
            "User Role — Operational access: can view all sections and perform day-to-day actions (create orders, log receipts, submit tickets). Cannot access Admin Settings, User Management, or Financial Matching.",
            "Supplier Role — Portal-only access: can view their RFQs, submit quotes, upload invoices, and track purchase orders. Cannot access internal procurement data.",
            "Account Creation — Only the admin can create user accounts via Admin → User Management. Self-registration is disabled for security.",
            "Password Policy — All passwords are bcrypt-hashed (12 rounds). Users can change passwords via Admin Settings → Security. Admins can reset user passwords.",
            "2FA Enforcement — Two-Factor Authentication (TOTP-based) is required for all logins. Admins enable/manage 2FA status from Admin Settings → Security."
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
                            const sectionWithDiagram = section as { diagram?: { title: string; nodes: string[] } };
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

                                    {/* Workflow Diagram (visual) */}
                                    {sectionWithDiagram.diagram && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-4">
                                                <Share2 size={16} />
                                                {sectionWithDiagram.diagram.title}
                                            </div>
                                            <div className="flex items-center justify-center gap-0 flex-wrap py-6 px-4 bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-2xl border overflow-x-auto">
                                                {sectionWithDiagram.diagram.nodes.map((node: string, i: number) => (
                                                    <div key={i} className="flex items-center shrink-0">
                                                        <div className="px-4 py-2.5 rounded-xl bg-background border-2 border-primary/20 shadow-sm text-xs font-bold text-foreground whitespace-nowrap hover:border-primary hover:shadow-md transition-all">
                                                            {node}
                                                        </div>
                                                        {i < sectionWithDiagram.diagram.nodes.length - 1 && (
                                                            <div className="flex items-center mx-1">
                                                                <div className="w-6 h-0.5 bg-primary/40" />
                                                                <ChevronRight className="h-4 w-4 text-primary/60 -ml-1" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
