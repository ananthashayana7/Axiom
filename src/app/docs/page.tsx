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
    Info
} from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS = [
    {
        id: "overview",
        title: "Platform Overview",
        icon: LayoutDashboard,
        content: "Axiom is your central hub for strategic procurement. It focuses on transparency, risk mitigation, and efficient sourcing through data-driven insights."
    },
    {
        id: "foundations",
        title: "Procurement 101",
        icon: BookOpen,
        content: "New to procurement? This section explains the basic concepts of how a professional supply chain works and why these steps are vital for a healthy business.",
        steps: [
            "The Goal — Procurement isn't just 'buying things'. It's about getting the best value, ensuring items arrive on time, and building relationships with reliable partners.",
            "The Cycle — It starts with a 'Requisition' (identifying a need), moves to 'Sourcing' (finding the best price), and ends with an 'Order' (the actual purchase).",
            "Why it matters — Good procurement prevents overspending, avoids running out of critical parts, and ensures your company only works with ethical, low-risk suppliers.",
            "Key Terms — RFQ (Request for Quote), PO (Purchase Order), SKU (Stock Keeping Unit), and Lead Time (how long it takes for an item to arrive)."
        ]
    },
    {
        id: "parts",
        title: "Managing Your Goods",
        icon: Package,
        content: "Everything your company owns or needs to buy is listed here. Keeping this 'Catalog' clean is the foundation of all other work.",
        steps: [
            "Organization — All items are categorized. This helps you see how much you are spending on specific types of parts, like 'Mechanical' vs 'Electronic'.",
            "Searching — Use the search bar to see if a part already exists before adding a new one. This prevents duplicates.",
            "Stock Monitoring — Pay attention to the labels. 'Critical' means you represent a risk to your production if you don't buy more soon.",
            "Price Tracking — Each part has a 'Standard Price'. We use this as a benchmark to see if we are getting good deals from suppliers later on."
        ]
    },
    {
        id: "rfqs",
        title: "Strategic Sourcing (RFQs)",
        icon: FileText,
        content: "This is where you save money. Instead of buying from the first person you find, you 'Request a Quote' from multiple partners to compare.",
        steps: [
            "Defining the Need — Create an RFQ when you have a large or recurring need for parts. You list exactly what you want and when.",
            "Inviting Partners — Axiom helps you find the right suppliers. You should invite at least 3 to ensure healthy competition.",
            "AI Assistance — The system can analyze submissions for you. It looks at price, quality, and supplier risk to suggest the 'Best Pick'.",
            "Closing the Deal — Once you receive quotes, you can negotiate or choose the best one. This locks in the price for your future purchases."
        ]
    },
    {
        id: "requisitions",
        title: "Internal Needs",
        icon: ShoppingCart,
        content: "Internal teams use this to communicate what they need to the buying team. Think of it as an internal 'Shopping List' that needs permission.",
        steps: [
            "Submission — Anyone in the company can identify a need. They submit a proposal with an estimated cost.",
            "Approval Workflow — To prevent unauthorized spending, managers must review these requests. They check if the budget is available.",
            "The Hand-off — Once approved, the 'Buying Team' takes over. They don't have to guess what's needed—the details are already there.",
            "Clarity — Using this system ensures every purchase has a clear reason and an authorized 'Owner'."
        ]
    },
    {
        id: "orders",
        title: "Completing the Purchase",
        icon: ShoppingCart,
        content: "A Purchase Order (PO) is a formal contract. Once you send this, you are legally committed to buying the items at the agreed price.",
        steps: [
            "Creation — Orders are usually created from approved requisitions or successful RFQs. This ensures the data is accurate.",
            "Status Tracking — 'Sent' means the supplier is working on it. 'Fulfilled' means the items have arrived at your warehouse.",
            "Verification — When the items arrive, mark them as fulfilled. This lets the finance team know it is okay to pay the supplier.",
            "History — Every order is saved forever. This helps you see how prices change over time and how reliable a supplier is."
        ]
    },
    {
        id: "suppliers",
        title: "Partner Health (Risk)",
        icon: Users,
        content: "You are only as strong as your suppliers. We monitor them constantly to make sure they won't let you down.",
        steps: [
            "The Risk Score — Axiom calculates a score from 0 to 100. Higher scores mean you should be careful (they might be slow or financially unstable).",
            "Reliability — We track 'On-Time Delivery'. If a supplier is always late, the system will highlight them in red.",
            "ESG & Ethics — We track sustainability and compliance. This ensures your company isn't accidentally supporting unethical practices.",
            "Consolidation — It's often better to buy more from a few 'Great' suppliers than small amounts from many 'Average' ones."
        ]
    },
    {
        id: "analytics",
        title: "Using Telemetry",
        icon: Sparkles,
        content: "This is the 'Dashboard' for your business health. It turns thousands of numbers into easy-to-read charts.",
        steps: [
            "The Big Picture — The top metrics show your total spend and 'Savings Realized' (money you saved by negotiating).",
            "Spotting Trends — The charts show if your spending is going up or down. A sudden spike might mean a problem in a specific department.",
            "AI Insights — Click 'Analyze' to let the AI find hidden opportunities. It might notice that two different teams are buying the same part from different sellers."
        ]
    },
    {
        id: "admin",
        title: "Governance",
        icon: ShieldCheck,
        content: "For team leads and managers to ensure the system is being used correctly and securely.",
        steps: [
            "Permissions — Not everyone should see everything. Use User Management to define who can approve big spending.",
            "The Audit Trail — This is the 'Black Box' of the app. It records who changed what and when, which is vital for security and accountability.",
            "Consistency — Ensure all team members are following the same naming conventions for parts and suppliers."
        ]
    },
    {
        id: "sharing",
        title: "Sharing & Access",
        icon: Share2,
        content: "How to bring your team into Axiom and get them started with strategic procurement.",
        steps: [
            "The URL — Share the platform's web address with your team members so they can access the login portal.",
            "User Credentials — Ensure each person has their own login. Since you've already added them, they just need their email and the password you assigned.",
            "Local Sharing — To find your link, open Command Prompt and type 'ipconfig'. Look for 'IPv4 Address'. Share 'http://[YOUR-IP]:3001' with anyone on your Wi-Fi.",
            "Sharing without Admin — If your firewall blocks local access and you can't change it, use a 'Tunnel'. Run this in your terminal: `npx localtunnel --port 3001`. It will give you a public web link you can share with anyone, anywhere.",
            "Onboarding — Direct every new person to the 'Procurement 101' section of this Playbook first. It ensures everyone speaks the same language.",
            "Mobile Access — Axiom is responsive. Your team can track orders or approve requisitions directly from their phones while on the move."
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
                        <p className="text-sm font-bold text-foreground font-display tracking-tight">A. Anantha Shayana</p>
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
