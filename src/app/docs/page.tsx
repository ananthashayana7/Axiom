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
    Scale
} from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS = [
    {
        id: "overview",
        title: "Platform Overview",
        icon: LayoutDashboard,
        content: "Axiom is a high-performance Procurement Intelligence platform. It turns fragmented data into clear, strategic actions. Our mission is to move you away from 'buying' and towards 'Strategic Sourcing'.",
        steps: [
            "Visibility — Stop guessing where your money goes. Axiom tracks every cent across suppliers and departments.",
            "Intelligence — We use AI to spot risks and savings that humans often miss.",
            "Accountability — Every action is recorded in the Audit Trail. There are no 'shadow' purchases here.",
            "Efficiency — Automated workflows replace slow email chains and spreadsheets."
        ]
    },
    {
        id: "foundations",
        title: "Procurement 101",
        icon: BookOpen,
        content: "Before you click anything, understand the 'Golden Rule': Never spend company money without a digital trail. Here is how professional procurement works.",
        steps: [
            "1. The Identification — It starts with a need (e.g., 'We need 50 laptops'). This is not an order yet; it's just a request.",
            "2. The Sourcing (RFQ) — Don't buy from the first seller. Ask at least 3 companies for their best price. This is 'Request for Quote'.",
            "3. The Award — Choose a winner based on Price, Quality, and Speed. AI can help you calculate this 'Best Pick' automatically.",
            "4. The Contract — Convert the winning quote into a Purchase Order (PO). This is a legal promise to pay.",
            "5. The Receipt — When goods arrive, verify them immediately. If you don't mark them 'Fulfilled', finance won't pay the bill.",
            "PRO-TIP: Always aim for a 3-Way Match. Ensure the Order, the Delivery Note, and the Invoice all show the same quantity and price.",
            "PITFALL: Buying 'Off-Contract' (Maverick Spend) is the #1 way companies lose money. If it's not in Axiom, don't buy it."
        ]
    },
    {
        id: "parts",
        title: "Parts & Catalog",
        icon: Package,
        content: "The Catalog is your 'Single Source of Truth'. If the data here is messy, your analytics will be useless. Keep it clean.",
        steps: [
            "Naming Conventions — Use 'Noun, Descriptor' format (e.g., 'Laptop, Dell XPS' instead of 'My New XPS Laptop'). This makes searching easy.",
            "Category Accuracy — Select the right category (Mechanical, HR, IT). This determines how we analyze your department's budget.",
            "Standard Pricing — Set a realistic 'Benchmark Price'. Axiom uses this to tell you if a supplier is overcharging you in the future.",
            "The 2-Minute Rule — If you see a duplicate part or a typo, fix it immediately. Data debt grows like high interest.",
            "PRO-TIP: Use the 'Critical' flag for items that stop production. It helps the buying team prioritize their workload.",
            "PITFALL: Creating duplicate SKUs for the same item. Check the search bar twice before adding a new part."
        ]
    },
    {
        id: "rfqs",
        title: "Strategic Sourcing (RFQs)",
        icon: FileText,
        content: "This is the 'War Room' for price negotiation. Use RFQs to create competition among your suppliers and drive costs down.",
        steps: [
            "Rule of Three — Never launch an RFQ with fewer than 3 suppliers. Competition is your only leverage.",
            "Specific Specs — Upload clear documents. Suppliers will quote lower if they have zero uncertainty about what you want.",
            "AI Analysis — Once quotes arrive, click 'AI Comparison'. It will highlight 'Low-Ball' offers that seem too good to be true.",
            "Closing the RFQ — Always send a 'Thank You' or 'Regret' note to every participant. Professionalism ensures they quote again next time.",
            "PRO-TIP: Check the 'Lead Time' as much as the 'Price'. A cheap part that arrives 6 months late is actually very expensive.",
            "PITFALL: Forgetting to set a 'Closing Date'. Suppliers need a deadline to move quickly."
        ]
    },
    {
        id: "contracts",
        title: "Framework Agreements",
        icon: ShieldCheck,
        content: "Legal safety for long-term relationships. Framework Agreements ensure you are always buying at pre-negotiated terms without launching an RFQ every single time.",
        steps: [
            "Contract Activation — New contracts start as 'Draft'. You must 'Activate' them before they can be linked to any Purchase Order.",
            "Linking Orders — When creating an order, select the 'Contract' field. This automatically inherits the agreed-upon Incoterms and legal protections.",
            "Renewal Alerts — Axiom monitors the 'Valid To' date. Check the 'Contracts' page regularly to spot agreements that are about to expire.",
            "Termination — If a supplier fails their SLA, use the 'Terminate' action to block any new spend against that contract.",
            "PRO-TIP: Use 'Auto-Renew' for low-risk, high-volume service contracts to avoid service interruptions.",
            "PITFALL: Buying without a contract when one exists. Always link your PO to the Framework Agreement to ensure pricing compliance."
        ]
    },
    {
        id: "requisitions",
        title: "Internal Requests",
        icon: ShoppingCart,
        content: "For people who need things but don't have the authority to spend. Think of this as a formal 'Proposal' to your manager.",
        steps: [
            "Clarity is Value — Don't just say 'Tools'. List the part numbers and why you need them. Managers hate vague requests.",
            "Budget Check — Ensure you have the budget before submitting. The 'Estimated Amount' must include taxes and shipping.",
            "Approval Hierarchy — Once you hit submit, your manager gets a notification. They can Approve, Reject, or ask for more info.",
            "Notification Tracking — Click the Bell icon in the header. You will get a ping the second your request is green-lit.",
            "PRO-TIP: Batch your needs. One requisition for 10 items is processed 5x faster than 10 separate requisitions.",
            "PITFALL: Submitting 'Emergency' requests for things that weren't actually emergencies. It destroys your credibility."
        ]
    },
    {
        id: "orders",
        title: "Purchase Orders (PO)",
        icon: ShoppingCart,
        content: "The PO is a legal contract. It protects the company by locking in prices and delivery dates before money moves.",
        steps: [
            "Auto-Creation — Always convert an Approved Requisition or RFQ into a PO. Do not type details manually to avoid errors.",
            "The Tracking Loop — Once a PO is 'Sent', the clock starts. Use the 'Status' column to monitor if the supplier is late.",
            "The Three-Way Match — A critical audit step. Axiom compares the PO Amount, the Goods Receipt (GRN), and the Invoice. If they don't match, it is flagged as 'Disputed'.",
            "Receipting (GRN) — When the box hits the warehouse, mark it as 'Fulfilled' in Axiom. This is the only way to trigger a payment.",
            "Closing the Loop — A 'Fulfilled' order moves to the 'History' tab for your next year's budget planning.",
            "PRO-TIP: If a supplier sends 95% of an order, don't mark as fulfilled. Keep it open until the last 5% arrives.",
            "PITFALL: Verbally telling a supplier to 'send it' without a PO in the system. If it's not in Axiom, it doesn't exist."
        ]
    },
    {
        id: "suppliers",
        title: "Supplier Risk & Health",
        icon: Users,
        content: "Your suppliers are your biggest risk. We monitor their 'Vital Signs' to ensure they don't go bust or fail you.",
        steps: [
            "Red Flag: Performance — If a score drops below 60, stop giving them new work until they explain why they are late.",
            "Red Flag: Risk — A high risk score (80+) means they might be financially unstable or have ethical issues.",
            "ESG Compliance — Monitor if your partners are using green energy or ethical labor. This protects your brand's reputation.",
            "Manual Performance Audits — Go to a Supplier's page and click 'Record Performance'. This calculates a live scorecard based on Delivery, Quality, and Collaboration.",
            "The Master List — Only buy from 'Active' suppliers. 'Blacklisted' suppliers are blocked from the system for a reason.",
            "PRO-TIP: Review your Top 10 suppliers every quarter. Don't let your business depend too heavily on just one partner.",
            "PITFALL: Ignoring the 'Reliability' metric. A supplier who is 'always just 2 days late' is costing you hours of project delay."
        ]
    },
    {
        id: "analytics",
        title: "Telemetry & Intelligence",
        icon: Sparkles,
        content: "Data is just noise until you use Telemetry. This section turns your spending habits into a clear roadmap for savings.",
        steps: [
            "The Spend Spike — Look for sudden jumps in costs. It usually means a part price changed or a department is overspending.",
            "Savings Realized — This metric shows the boss how much money *you* saved the company through smart negotiation.",
            "AI Insights — The AI looks across the whole company. It might notice that 'Site A' is paying 20% more than 'Site B' for the same part.",
            "Technical Health — Check the 'System Telemetry' in the header to ensure all AI integrations and data streams are live.",
            "PRO-TIP: Download the 'Monthly Recap' PDF and send it to your manager. It proves your value every single month.",
            "PITFALL: Looking at the charts but taking no action. Analytics are a compass, not a trophy."
        ]
    },
    {
        id: "sharing",
        title: "Onboarding & Access",
        icon: Share2,
        content: "Axiom works best when the whole team is inside. Here is how to bring your colleagues into the project safely.",
        steps: [
            "The Invite — Go to 'User Management' to add your team. Assign them roles (User, Admin, or Supplier).",
            "The Local Link — If you are in the office, share your internal IP address (e.g., http://192.168.1.5:3001).",
            "The Global Tunnel — To share with people working from home, use the 'Tunnel' method. Run `npx localtunnel --port 3001` in your console.",
            "Security First — Tell your team to *never* share their passwords. Use the 'Inactivity Tracker'—Axiom will auto-log-out for safety.",
            "PRO-TIP: Make 'Procurement 101' mandatory reading for every new hire before they get their login.",
            "PITFALL: Sharing one login between multiple people. It destroys the 'Audit Trail'—you won't know who actually made a mistake."
        ]
    },
    {
        id: "maintenance",
        title: "System Maintenance",
        icon: RefreshCcw,
        content: "Keeping the engine running. As an Admin, you have the power to reset data and manage the technical health of the workspace.",
        steps: [
            "The Reset Utility — Found in Admin Settings. This wipes all orders, suppliers, and parts while keeping your User account intact.",
            "Database Hygiene — Always ensure your DATABASE_URL is backed up before a reset. These actions are permanent and irreversible.",
            "Audit Trail Integrity — Axiom logs every major system action. If you reset the database, the activity logs are also cleared to start fresh.",
            "Role Management — Regularly audit who has 'Admin' access. Restricted access is the best defense against data accidents.",
            "PRO-TIP: Perform a 'Workspace Reset' only after your annual audit is complete and data is archived.",
            "PITFALL: Resetting the database during active procurement cycles. This will disconnect suppliers and cancel pending orders."
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
