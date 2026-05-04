export const SUPPLIER_RELEASE_RISK_THRESHOLD = 70;
export const CRITICAL_SUPPLIER_RISK_SCORE = 85;
export const TELEMETRY_STALE_MINUTES = 30;
export const FX_RATE_STALE_HOURS = 24;
export const RECEIPT_REVIEW_SLA_HOURS = 18;

type SupplierGuardrailInput = {
    name?: string | null;
    riskScore?: number | null;
    status?: string | null;
    lifecycleStatus?: string | null;
};

function supplierLabel(name?: string | null) {
    return name?.trim() || "This supplier";
}

export function getSupplierCreationBlockReason(input: SupplierGuardrailInput) {
    const supplierName = supplierLabel(input.name);
    const status = (input.status || "").toLowerCase();
    const lifecycleStatus = (input.lifecycleStatus || "").toLowerCase();

    if (status === "blacklisted") {
        return `${supplierName} is blacklisted and cannot be used for new orders.`;
    }

    if (status === "inactive") {
        return `${supplierName} is inactive and must be reactivated before order creation.`;
    }

    if (lifecycleStatus === "suspended") {
        return `${supplierName} is suspended and cannot move through sourcing until remediation is cleared.`;
    }

    if (lifecycleStatus === "terminated") {
        return `${supplierName} is terminated and cannot be used for procurement activity.`;
    }

    return null;
}

export function getSupplierReleaseBlockReason(input: SupplierGuardrailInput) {
    const creationBlockReason = getSupplierCreationBlockReason(input);
    if (creationBlockReason) {
        return creationBlockReason;
    }

    const supplierName = supplierLabel(input.name);
    const riskScore = Number(input.riskScore || 0);
    if (riskScore >= SUPPLIER_RELEASE_RISK_THRESHOLD) {
        return `${supplierName} is above the release threshold at risk ${riskScore}. Route the order through Exception Management before approval or dispatch.`;
    }

    return null;
}

export function getRiskSeverityLabel(riskScore?: number | null) {
    const risk = Number(riskScore || 0);
    if (risk >= CRITICAL_SUPPLIER_RISK_SCORE) {
        return "critical";
    }

    if (risk >= SUPPLIER_RELEASE_RISK_THRESHOLD) {
        return "high";
    }

    if (risk >= 50) {
        return "watch";
    }

    return "stable";
}
