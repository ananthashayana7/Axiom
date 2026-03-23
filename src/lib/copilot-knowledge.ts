import { AGENT_REGISTRY } from "@/app/actions/agents/registry";

const APP_MODULES = [
    { label: "Dashboard", route: "/", description: "Monitors enterprise spend, supplier coverage, sourcing activity, and operational KPIs." },
    { label: "Suppliers", route: "/suppliers", description: "Manages supplier records, performance, risk visibility, and onboarding context." },
    { label: "Axiom Copilot", route: "/copilot", description: "Answers product questions, analyzes procurement data, and reviews uploaded business documents." },
    { label: "AI Agents", route: "/admin/agents", description: "Runs specialized AI workflows such as fraud detection, demand forecasting, and scenario modeling." },
    { label: "Parts Catalog", route: "/sourcing/parts", description: "Maintains part masters, benchmark pricing, and sourcing attributes." },
    { label: "Sourcing Requests", route: "/sourcing/rfqs", description: "Creates and tracks RFQs and competitive bidding events." },
    { label: "Requisitions", route: "/sourcing/requisitions", description: "Captures internal demand and approval routing before purchase orders are issued." },
    { label: "Orders", route: "/sourcing/orders", description: "Tracks purchase orders, fulfillment status, and negotiated pricing." },
    { label: "Goods Receipts", route: "/sourcing/goods-receipts", description: "Records warehouse receipts that feed three-way match and inventory visibility." },
    { label: "Invoice Records", route: "/sourcing/invoices", description: "Stores supplier invoices and supports reconciliation against orders and receipts." },
    { label: "Agreements", route: "/sourcing/contracts", description: "Tracks contracts, commercial clauses, and renewal obligations." },
    { label: "Transactions", route: "/transactions", description: "Provides a unified ledger across orders, receipts, invoices, and related references." },
    { label: "Contacts", route: "/contacts", description: "Maintains internal and supplier-side contacts with regional metadata." },
    { label: "Savings", route: "/savings", description: "Quantifies sourcing savings, realized value, and supplier-level contribution." },
    { label: "Axiom Playbook", route: "/docs", description: "Explains product workflows, architecture, governance, and procurement operating model." },
    { label: "Help & Support", route: "/support", description: "Provides support workflows, FAQs, and ticketing guidance." },
    { label: "Import Data", route: "/admin/import", description: "Imports structured procurement data into Axiom using CSV-based flows." },
    { label: "Admin Settings", route: "/admin/settings", description: "Configures AI keys, platform settings, and operational controls." },
];

const APP_WORKFLOWS = [
    {
        name: "RFQ to PO Flow",
        summary: "Parts enter the catalog, demand is raised as requisitions, sourcing requests collect supplier bids, and winning quotes become purchase orders.",
        actions: ["Review parts in /sourcing/parts", "Launch sourcing in /sourcing/rfqs", "Convert approved demand into orders in /sourcing/orders"],
    },
    {
        name: "3-Way Match Verification",
        summary: "Axiom compares purchase order terms, goods receipt quantities, and supplier invoice values before finance approval.",
        actions: ["Check receipt status in /sourcing/goods-receipts", "Inspect invoice records in /sourcing/invoices", "Investigate mismatches through /transactions"],
    },
    {
        name: "Requisition Approval Flow",
        summary: "Internal teams create requisitions, managers review them against budget and policy, and approved demand moves into sourcing or purchasing.",
        actions: ["Open /sourcing/requisitions", "Review approval status and buyer actions", "Escalate unusual demand through AI Agents if needed"],
    },
    {
        name: "Document and Invoice Analysis",
        summary: "Copilot can analyze procurement documents and guide users toward imports, matching, cost analysis, or risk review.",
        actions: ["Upload PDFs, images, CSV, TSV, TXT, JSON, or XLSX to Copilot", "Use /admin/import for structured CSV ingestion", "Use /sourcing/invoices or /transactions for reconciliation"],
    },
];

const COPILOT_FILE_CAPABILITIES = [
    "Native analysis for PDF and image uploads.",
    "Structured text analysis for CSV, TSV, TXT, JSON, and log-style files.",
    "Spreadsheet preview support for modern Excel .xlsx workbooks.",
    "Graceful fallback guidance for unsupported or partially readable files instead of silent failure.",
];

export function getCopilotKnowledgeContext() {
    return {
        modules: APP_MODULES,
        workflows: APP_WORKFLOWS,
        agents: AGENT_REGISTRY.map(({ name, displayName, description, category, triggers, requiresApproval }) => ({
            name,
            displayName,
            description,
            category,
            triggers,
            requiresApproval,
        })),
        fileCapabilities: COPILOT_FILE_CAPABILITIES,
    };
}
