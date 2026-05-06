export type AccessProfile =
    | "super_admin"
    | "finance_auditor"
    | "sourcing_manager"
    | "regional_operator"
    | "internal_user"
    | "supplier_portal";

export type SessionAccessUser = {
    role?: string | null;
    accessProfile?: string | null;
    supplierId?: string | null;
    countryScope?: string | null;
    regionScope?: string | null;
    department?: string | null;
};

const ACCESS_PROFILES: AccessProfile[] = [
    "super_admin",
    "finance_auditor",
    "sourcing_manager",
    "regional_operator",
    "internal_user",
    "supplier_portal",
];

const FINANCE_ADMIN_PATHS = [
    "/admin",
    "/admin/analytics",
    "/admin/audit",
    "/admin/compliance",
    "/admin/financial-matching",
    "/admin/fraud-alerts",
    "/admin/risk",
    "/admin/support",
    "/admin/tasks",
];

const SOURCING_ADMIN_PATHS = [
    "/admin",
    "/admin/compliance",
    "/admin/ecosystem",
    "/admin/risk",
    "/admin/scenarios",
    "/admin/support",
    "/admin/tasks",
];

function normalizeScopeValue(value: string | null | undefined) {
    return value?.trim().toLowerCase().replace(/\s+/g, " ") || null;
}

function normalizeCountryCode(value: string | null | undefined) {
    return value?.trim().toUpperCase() || null;
}

function isKnownAccessProfile(value: string | null | undefined): value is AccessProfile {
    return ACCESS_PROFILES.includes((value || "") as AccessProfile);
}

function pathMatches(pathname: string, allowedPath: string) {
    return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
}

export function resolveAccessProfile(user: SessionAccessUser | null | undefined): AccessProfile {
    if (!user) {
        return "internal_user";
    }

    if (
        isKnownAccessProfile(user.accessProfile) &&
        !(user.role === "admin" && user.accessProfile === "internal_user") &&
        !(user.role === "supplier" && user.accessProfile !== "supplier_portal")
    ) {
        return user.accessProfile;
    }

    if (user.role === "supplier") {
        return "supplier_portal";
    }

    if (user.role === "admin") {
        const department = normalizeScopeValue(user.department);

        if (department?.includes("finance") || department?.includes("audit")) {
            return "finance_auditor";
        }

        if (
            department?.includes("procurement") ||
            department?.includes("sourcing") ||
            department?.includes("supplier operations")
        ) {
            return "sourcing_manager";
        }

        return "super_admin";
    }

    return "internal_user";
}

export function getAccessProfileLabel(profile: AccessProfile) {
    switch (profile) {
        case "super_admin":
            return "Super Admin";
        case "finance_auditor":
            return "Finance / Auditor";
        case "sourcing_manager":
            return "Sourcing Manager";
        case "regional_operator":
            return "Regional Operator";
        case "supplier_portal":
            return "Supplier Portal";
        default:
            return "Internal User";
    }
}

export function getAllowedAccessProfilesForRole(role: string | null | undefined): AccessProfile[] {
    if (role === "admin") {
        return ["super_admin", "finance_auditor", "sourcing_manager"];
    }

    if (role === "supplier") {
        return ["supplier_portal"];
    }

    return ["internal_user", "regional_operator"];
}

export function isAccessProfileCompatible(role: string | null | undefined, profile: string | null | undefined) {
    return isKnownAccessProfile(profile) && getAllowedAccessProfilesForRole(role).includes(profile);
}

export function profileRequiresRegionalScope(profile: string | null | undefined) {
    return resolveAccessProfile({ accessProfile: profile }) === "regional_operator";
}

export function isRegionalOperator(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "regional_operator";
}

export function hasRegionalScope(user: SessionAccessUser | null | undefined) {
    return Boolean(normalizeCountryCode(user?.countryScope) || normalizeScopeValue(user?.regionScope));
}

export function isWithinRegionalScope(
    user: SessionAccessUser | null | undefined,
    record: { country?: string | null; region?: string | null },
) {
    if (!isRegionalOperator(user)) {
        return true;
    }

    const scopedCountry = normalizeCountryCode(user?.countryScope);
    const scopedRegion = normalizeScopeValue(user?.regionScope);

    if (!scopedCountry && !scopedRegion) {
        return false;
    }

    if (scopedCountry && normalizeCountryCode(record.country) !== scopedCountry) {
        return false;
    }

    if (scopedRegion && normalizeScopeValue(record.region) !== scopedRegion) {
        return false;
    }

    return true;
}

export function canAccessAdminPath(user: SessionAccessUser | null | undefined, pathname: string) {
    if (user?.role !== "admin") {
        return false;
    }

    const profile = resolveAccessProfile(user);

    if (profile === "super_admin") {
        return pathname === "/admin" || pathname.startsWith("/admin/");
    }

    const allowedPaths = profile === "finance_auditor" ? FINANCE_ADMIN_PATHS : SOURCING_ADMIN_PATHS;
    return allowedPaths.some((allowedPath) => pathMatches(pathname, allowedPath));
}

export function getDefaultAdminLandingPath(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);

    switch (profile) {
        case "finance_auditor":
            return "/admin/financial-matching";
        case "sourcing_manager":
            return "/admin/scenarios";
        default:
            return "/admin/analytics";
    }
}

export function canAccessAIFleet(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "super_admin";
}

export function canAccessTelemetry(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "super_admin";
}

export function canManageUsers(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "super_admin";
}

export function canManageImports(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "super_admin";
}

export function canManageSettings(user: SessionAccessUser | null | undefined) {
    return resolveAccessProfile(user) === "super_admin";
}

export function canAccessAnalytics(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "finance_auditor";
}

export function canAccessAuditTrail(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "finance_auditor";
}

export function canAccessFinancialMatching(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "finance_auditor";
}

export function canRunInvoiceRules(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "finance_auditor" || profile === "sourcing_manager";
}

export function canEscalateInvoiceReview(user: SessionAccessUser | null | undefined) {
    return canRunInvoiceRules(user);
}

export function canMarkInvoicePaid(user: SessionAccessUser | null | undefined) {
    return canAccessFinancialMatching(user);
}

export function canManageSuppliers(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "sourcing_manager";
}

export function canManageSourcing(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "sourcing_manager";
}

export function canApproveOrders(user: SessionAccessUser | null | undefined) {
    return canManageSourcing(user);
}

export function canAccessOperationalAdmin(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "finance_auditor" || profile === "sourcing_manager";
}

export function canAccessRiskIntelligence(user: SessionAccessUser | null | undefined) {
    return canAccessOperationalAdmin(user);
}

export function canAccessScenarioModeling(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "sourcing_manager";
}

export function canAccessSupplierEcosystem(user: SessionAccessUser | null | undefined) {
    const profile = resolveAccessProfile(user);
    return profile === "super_admin" || profile === "sourcing_manager";
}
