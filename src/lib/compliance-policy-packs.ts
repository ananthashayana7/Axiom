export type CompliancePolicyPack = {
    id: string;
    label: string;
    region: string;
    summary: string;
};

export const COMPLIANCE_POLICY_PACKS: CompliancePolicyPack[] = [
    {
        id: "IN_GST_CORE",
        label: "India GST Core",
        region: "India",
        summary: "GST evidence, supplier tax details, and invoice controls for India-led flows.",
    },
    {
        id: "EU_GDPR_SUPPLY",
        label: "EU GDPR Supply Chain",
        region: "European Union",
        summary: "Data privacy, processor controls, and supplier evidence for EU operations.",
    },
    {
        id: "UK_GDPR_SUPPLY",
        label: "UK GDPR",
        region: "United Kingdom",
        summary: "UK data-processing and supplier record controls aligned to UK GDPR.",
    },
    {
        id: "US_CCPA_VENDOR",
        label: "US CCPA Vendor",
        region: "United States",
        summary: "Consumer data, vendor handling, and evidence obligations for US workflows.",
    },
    {
        id: "SG_PDPA_VENDOR",
        label: "Singapore PDPA",
        region: "Singapore",
        summary: "PDPA-aligned controls for supplier data, retention, and disclosure handling.",
    },
    {
        id: "AE_VAT_TRADE",
        label: "UAE VAT & Trade",
        region: "United Arab Emirates",
        summary: "Trade paperwork, VAT evidence, and regional customs-readiness controls.",
    },
    {
        id: "GLOBAL_TPRM_BASELINE",
        label: "Global TPRM Baseline",
        region: "Global",
        summary: "Shared third-party risk baseline for multi-region suppliers and contracts.",
    },
];

export function getCompliancePolicyPack(packId?: string | null) {
    if (!packId) {
        return null;
    }

    return COMPLIANCE_POLICY_PACKS.find((pack) => pack.id === packId) || null;
}

export function inferPolicyPackRegion(packId?: string | null) {
    return getCompliancePolicyPack(packId)?.region || null;
}

export function getPolicyPackRegions() {
    return Array.from(new Set(COMPLIANCE_POLICY_PACKS.map((pack) => pack.region)));
}
