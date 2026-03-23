export type SectionFlowKey =
    | "dashboard"
    | "suppliers"
    | "sourcing"
    | "copilot"
    | "portal"
    | "intelligence"
    | "support";

export type SectionFlowStatus = "complete" | "current" | "pending";

export type SectionFlowDefinition = {
    key: SectionFlowKey;
    label: string;
    href: string;
    summary: string;
};

export type SectionFlowItem = SectionFlowDefinition & {
    status: SectionFlowStatus;
};

export type SectionFlowPlan = {
    sections: SectionFlowItem[];
    completedCount: number;
    totalCount: number;
    percentComplete: number;
    currentSection: SectionFlowItem | null;
};

export const SECTION_FLOW_DEFINITIONS: SectionFlowDefinition[] = [
    {
        key: "dashboard",
        label: "Dashboard",
        href: "/",
        summary: "Command center analytics, navigation entry points, and the overall operator landing flow.",
    },
    {
        key: "suppliers",
        label: "Suppliers",
        href: "/suppliers",
        summary: "Vendor onboarding, supplier profile coverage, and supplier risk workflow verification.",
    },
    {
        key: "sourcing",
        label: "Sourcing",
        href: "/sourcing/orders",
        summary: "Core sourcing records across parts, RFQs, requisitions, orders, receipts, invoices, and contracts.",
    },
    {
        key: "copilot",
        label: "Axiom Copilot",
        href: "/copilot",
        summary: "AI-assisted querying, guided actions, and readiness for Microsoft Store user expectations.",
    },
    {
        key: "portal",
        label: "Vendor Portal",
        href: "/portal",
        summary: "Supplier-facing bids, orders, and document exchange before wider rollout.",
    },
    {
        key: "intelligence",
        label: "Intelligence & Audit",
        href: "/admin/analytics",
        summary: "Admin analytics, risk, audit, and control-room flows needed for Azure-hosted operations.",
    },
    {
        key: "support",
        label: "Support & Playbook",
        href: "/support",
        summary: "User guidance, support access, and final launch-readiness documentation handoff.",
    },
];

export const DEFAULT_COMPLETED_SECTION_KEYS: SectionFlowKey[] = ["dashboard"];

export function buildSectionFlowPlan(
    completedSections: SectionFlowKey[] = DEFAULT_COMPLETED_SECTION_KEYS,
): SectionFlowPlan {
    const completed = new Set(completedSections);
    let currentAssigned = false;

    const sections = SECTION_FLOW_DEFINITIONS.map<SectionFlowItem>((section) => {
        if (completed.has(section.key)) {
            return {
                ...section,
                status: "complete",
            };
        }

        if (!currentAssigned) {
            currentAssigned = true;
            return {
                ...section,
                status: "current",
            };
        }

        return {
            ...section,
            status: "pending",
        };
    });

    const completedCount = sections.filter((section) => section.status === "complete").length;
    const totalCount = sections.length;

    return {
        sections,
        completedCount,
        totalCount,
        percentComplete: Math.round((completedCount / totalCount) * 100),
        currentSection: sections.find((section) => section.status === "current") ?? null,
    };
}
