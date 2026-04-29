'use server'

import { db } from "@/db";
import { suppliers, procurementOrders, supplierPerformanceLogs, documents, rfqSuppliers, type Supplier } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";
import { getAiModel } from "@/lib/ai-provider";

const GENERIC_EMAIL_DOMAINS = new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com",
]);

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
    { category: "Electronics", keywords: ["electronics", "pcb", "sensor", "semiconductor", "embedded"] },
    { category: "Machining", keywords: ["machining", "cnc", "milling", "turning", "metal fabrication"] },
    { category: "Logistics", keywords: ["logistics", "transport", "freight", "warehouse", "shipping"] },
    { category: "Plastics", keywords: ["plastic", "polymer", "molding", "injection moulding"] },
    { category: "Fasteners", keywords: ["fastener", "bolt", "screw", "nut", "washer"] },
    { category: "Packaging", keywords: ["packaging", "carton", "label", "corrugated"] },
    { category: "Chemicals", keywords: ["chemical", "coating", "adhesive", "solvent"] },
    { category: "Industrial Services", keywords: ["maintenance", "calibration", "field service", "industrial service"] },
];

function extractEmailDomain(email: string) {
    return email.split("@")[1]?.trim().toLowerCase() || "";
}

function stripHtml(html: string) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractMetaDescription(html: string) {
    const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    return match?.[1]?.trim() || "";
}

function extractTitle(html: string) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1]?.trim() || "";
}

function inferCountryCodeFromDomain(domain: string) {
    const tld = domain.split(".").pop()?.toUpperCase() || "";
    return tld.length === 2 ? tld : null;
}

function toNumber(value: string | number | null | undefined) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function buildHeuristicSupplierEnrichment(text: string, domain: string) {
    const normalized = text.toLowerCase();
    const categories = CATEGORY_KEYWORDS
        .filter((entry) => entry.keywords.some((keyword) => normalized.includes(keyword)))
        .map((entry) => entry.category);
    const isoCertifications = Array.from(new Set(
        [...normalized.matchAll(/\biso[\s-]?\d{4,5}\b/gi)].map((match) => match[0].toUpperCase().replace(/\s+/g, " "))
    ));

    return {
        categories,
        isoCertifications,
        countryCode: inferCountryCodeFromDomain(domain),
        city: null as string | null,
        conflictMineralsStatus: normalized.includes("conflict minerals policy") ? "compliant" : "unknown",
        modernSlaveryStatement: normalized.includes("modern slavery") ? "yes" : "no",
        summary: "Heuristic public-web enrichment applied.",
    };
}

async function fetchPublicCompanyProfile(domain: string) {
    const urls = [`https://${domain}`, `http://${domain}`];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "AxiomSupplierEnrichment/1.0",
                },
                redirect: "follow",
            });

            if (!response.ok) {
                continue;
            }

            const html = await response.text();
            const plainText = stripHtml(html).slice(0, 12000);
            return {
                url,
                title: extractTitle(html),
                description: extractMetaDescription(html),
                plainText,
            };
        } catch {
            continue;
        }
    }

    return null;
}

async function inferSupplierProfileFromPublicWeb(args: {
    name: string;
    domain: string;
    pageTitle: string;
    description: string;
    plainText: string;
}) {
    const heuristic = buildHeuristicSupplierEnrichment(
        `${args.pageTitle}\n${args.description}\n${args.plainText}`,
        args.domain
    );

    try {
        const model = await getAiModel("gemini-2.5-flash");
        if (!model) {
            return heuristic;
        }

        const prompt = `
You are enriching a supplier master record for Axiom using ONLY the public company webpage excerpt below.

Company: ${args.name}
Domain: ${args.domain}
Title: ${args.pageTitle}
Meta description: ${args.description}
Excerpt:
${args.plainText.slice(0, 8000)}

Return JSON only in this shape:
{
  "categories": string[],
  "countryCode": string | null,
  "city": string | null,
  "isoCertifications": string[],
  "conflictMineralsStatus": "compliant" | "non_compliant" | "unknown",
  "modernSlaveryStatement": "yes" | "no",
  "summary": string
}

Rules:
- Use only facts or very high-confidence inferences from the excerpt.
- If a field is unclear, return null or an empty array.
- Prefer procurement-relevant categories such as Electronics, Machining, Logistics, Plastics, Fasteners, Packaging, Chemicals, Industrial Services.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return heuristic;
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
            categories?: string[];
            countryCode?: string | null;
            city?: string | null;
            isoCertifications?: string[];
            conflictMineralsStatus?: 'compliant' | 'non_compliant' | 'unknown';
            modernSlaveryStatement?: 'yes' | 'no';
            summary?: string;
        };

        return {
            categories: parsed.categories?.filter(Boolean) || heuristic.categories,
            isoCertifications: parsed.isoCertifications?.filter(Boolean) || heuristic.isoCertifications,
            countryCode: parsed.countryCode || heuristic.countryCode,
            city: parsed.city || heuristic.city,
            conflictMineralsStatus: parsed.conflictMineralsStatus || heuristic.conflictMineralsStatus,
            modernSlaveryStatement: parsed.modernSlaveryStatement || heuristic.modernSlaveryStatement,
            summary: parsed.summary || heuristic.summary,
        };
    } catch (error) {
        console.warn("Supplier enrichment AI path failed, using heuristic fallback.", error);
        return heuristic;
    }
}

export async function calculateABCAnalysis() {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        return await TelemetryService.time("SupplierManagement", "ABCAnalysis", async () => {
            const allSuppliers = await db.select().from(suppliers);
            const allOrders = await db.select().from(procurementOrders);

            // ... (keep existing logic) ...
            const spendMap = new Map<string, number>();
            allOrders.forEach(order => {
                const amount = parseFloat(order.totalAmount || "0");
                spendMap.set(order.supplierId, (spendMap.get(order.supplierId) || 0) + amount);
            });

            const sortedSuppliers = allSuppliers
                .map(s => ({ id: s.id, spend: spendMap.get(s.id) || 0 }))
                .sort((a, b) => b.spend - a.spend);

            const totalSpend = Array.from(spendMap.values()).reduce((a, b) => a + b, 0);
            if (totalSpend === 0) return { success: true, message: "No spend data found." };

            return await db.transaction(async (tx) => {
                let cumulativeSpend = 0;
                for (const s of sortedSuppliers) {
                    cumulativeSpend += s.spend;
                    const percentage = (cumulativeSpend / totalSpend) * 100;

                    let classification: 'A' | 'B' | 'C' = 'C';
                    if (percentage <= 70) classification = 'A';
                    else if (percentage <= 90) classification = 'B';

                    await tx.update(suppliers)
                        .set({ abcClassification: classification })
                        .where(eq(suppliers.id, s.id));
                }

                await TelemetryService.trackEvent("SupplierManagement", "abc_analysis_completed", { totalSpend });
                revalidatePath("/suppliers");
                return { success: true };
            });
        });
    } catch (error) {
        await TelemetryService.trackError("SupplierManagement", "abc_analysis_failed", error);
        console.error("ABC Analysis failed:", error);
        return { success: false, error: "Analysis failed" };
    }
}

export async function getSuppliers(): Promise<Supplier[]> {
    const session = await auth();
    if (!session) return [];

    try {
        const allSuppliers = await db.select().from(suppliers).orderBy(suppliers.createdAt);
        return allSuppliers;
    } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        return [];
    }
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
    const session = await auth();
    if (!session) return null;

    // Supplier users can only view themselves
    const userRole = session.user.role;
    const userSupplierId = session.user.supplierId;
    if (userRole === 'supplier' && userSupplierId !== id) return null;

    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
        return supplier || null;
    } catch (error) {
        console.error("Failed to fetch supplier:", error);
        return null;
    }
}

export async function getSupplierQuickView(id: string) {
    const session = await auth();
    if (!session) return null;

    if (session.user.role === 'supplier' && session.user.supplierId !== id) {
        return null;
    }

    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
        if (!supplier) return null;

        const [orderStats] = await db.select({
            activeOrders: sql<number>`count(*) filter (where ${procurementOrders.status} in ('approved', 'sent'))::int`.mapWith(Number),
            delayedOrders: sql<number>`count(*) filter (where ${procurementOrders.status} in ('approved', 'sent') and ${procurementOrders.estimatedArrival} is not null and ${procurementOrders.estimatedArrival} < current_timestamp)::int`.mapWith(Number),
            totalSpend: sql<number>`coalesce(sum(cast(${procurementOrders.totalAmount} as numeric)), 0)`.mapWith(Number),
        })
            .from(procurementOrders)
            .where(eq(procurementOrders.supplierId, id));

        const [rfqStats] = await db.select({
            activeInvites: sql<number>`count(*) filter (where ${rfqSuppliers.status} = 'invited')::int`.mapWith(Number),
            submittedQuotes: sql<number>`count(*) filter (where ${rfqSuppliers.status} = 'quoted')::int`.mapWith(Number),
        })
            .from(rfqSuppliers)
            .where(eq(rfqSuppliers.supplierId, id));

        const [documentStats] = await db.select({
            count: sql<number>`count(*)::int`.mapWith(Number),
        })
            .from(documents)
            .where(eq(documents.supplierId, id));

        const performance = await getSupplierPerformanceMetrics(id);
        const totalCarbon = toNumber(supplier.carbonFootprintScope1)
            + toNumber(supplier.carbonFootprintScope2)
            + toNumber(supplier.carbonFootprintScope3);
        const renewableEnergyShare = supplier.esgEnvironmentScore || 0;

        return {
            supplier,
            orderStats: {
                activeOrders: orderStats?.activeOrders || 0,
                delayedOrders: orderStats?.delayedOrders || 0,
                totalSpend: orderStats?.totalSpend || 0,
            },
            rfqStats: {
                activeInvites: rfqStats?.activeInvites || 0,
                submittedQuotes: rfqStats?.submittedQuotes || 0,
            },
            documentCount: documentStats?.count || 0,
            performance: performance
                ? {
                    performanceScore: performance.performanceScore || 0,
                    onTimeDeliveryRate: toNumber(performance.onTimeDeliveryRate),
                    defectRate: toNumber(performance.defectRate),
                    collaborationScore: performance.collaborationScore || 0,
                    responsivenessScore: performance.responsivenessScore || 0,
                    performanceLogs: performance.performanceLogs || [],
                }
                : null,
            sustainability: {
                totalCarbon: Number(totalCarbon.toFixed(2)),
                renewableEnergyShare,
                scope1: toNumber(supplier.carbonFootprintScope1),
                scope2: toNumber(supplier.carbonFootprintScope2),
                scope3: toNumber(supplier.carbonFootprintScope3),
                supplierDisclosureBand: renewableEnergyShare >= 60 ? 'leading' : renewableEnergyShare >= 30 ? 'developing' : 'verify',
            },
        };
    } catch (error) {
        console.error("Failed to fetch supplier quick view:", error);
        return null;
    }
}

export async function getSupplierOrders(supplierId: string) {
    const session = await auth();
    if (!session) return [];
    // Supplier users can only view their own orders
    if (session.user.role === 'supplier' && session.user.supplierId !== supplierId) return [];
    try {
        const orders = await db.select().from(procurementOrders).where(eq(procurementOrders.supplierId, supplierId));
        return orders;
    } catch (error) {
        console.error("Failed to fetch supplier orders:", error);
        return [];
    }
}

interface UpdateSupplierData {
    name?: string;
    contactEmail?: string;
    countryCode?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    riskScore?: number;
    performanceScore?: number;
    esgScore?: number;
    financialScore?: number;
    lifecycleStatus?: 'prospect' | 'onboarding' | 'active' | 'suspended' | 'terminated';
    status?: 'active' | 'inactive' | 'blacklisted';
    abcClassification?: 'A' | 'B' | 'C' | 'X' | 'Y' | 'Z' | 'None';
    carbonFootprintScope1?: number;
    carbonFootprintScope2?: number;
    carbonFootprintScope3?: number;
    conflictMineralsStatus?: 'compliant' | 'non_compliant' | 'unknown';
    isoCertifications?: string[];
    esgEnvironmentScore?: number;
    esgSocialScore?: number;
    esgGovernanceScore?: number;
    financialHealthRating?: string;
    tierLevel?: 'tier_1' | 'tier_2' | 'tier_3' | 'critical';
    modernSlaveryStatement?: string;
}

export async function updateSupplier(id: string, data: Partial<UpdateSupplierData>) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const normalizedCountryCode = data.countryCode?.toUpperCase().trim();
        if (normalizedCountryCode && !/^[A-Z]{2}$/.test(normalizedCountryCode)) {
            return { success: false, error: "Country code must be a valid 2-letter ISO code" };
        }

        if (typeof data.latitude === 'number' && Number.isFinite(data.latitude) && (data.latitude < -90 || data.latitude > 90)) {
            return { success: false, error: "Latitude must be between -90 and 90" };
        }

        if (typeof data.longitude === 'number' && Number.isFinite(data.longitude) && (data.longitude < -180 || data.longitude > 180)) {
            return { success: false, error: "Longitude must be between -180 and 180" };
        }

        const latitude = typeof data.latitude === 'number' && Number.isFinite(data.latitude)
            ? data.latitude.toString()
            : undefined;
        const longitude = typeof data.longitude === 'number' && Number.isFinite(data.longitude)
            ? data.longitude.toString()
            : undefined;

        await db.update(suppliers)
            .set({
                name: data.name,
                contactEmail: data.contactEmail,
                city: data.city,
                riskScore: data.riskScore,
                performanceScore: data.performanceScore,
                esgScore: data.esgScore,
                financialScore: data.financialScore,
                lifecycleStatus: data.lifecycleStatus,
                status: data.status,
                abcClassification: data.abcClassification,
                conflictMineralsStatus: data.conflictMineralsStatus,
                isoCertifications: data.isoCertifications,
                esgEnvironmentScore: data.esgEnvironmentScore,
                esgSocialScore: data.esgSocialScore,
                esgGovernanceScore: data.esgGovernanceScore,
                financialHealthRating: data.financialHealthRating,
                tierLevel: data.tierLevel,
                modernSlaveryStatement: data.modernSlaveryStatement,
                countryCode: normalizedCountryCode,
                carbonFootprintScope1: data.carbonFootprintScope1?.toString(),
                carbonFootprintScope2: data.carbonFootprintScope2?.toString(),
                carbonFootprintScope3: data.carbonFootprintScope3?.toString(),
                latitude,
                longitude,
                ...(data.performanceScore !== undefined ? { lastAuditDate: new Date() } : {})
            })
            .where(eq(suppliers.id, id));

        if (data.status) await logActivity('UPDATE', 'supplier', id, `Status updated to ${data.status}`);
        if (data.lifecycleStatus) await logActivity('UPDATE', 'supplier', id, `Lifecycle updated to ${data.lifecycleStatus.toUpperCase()}`);
        if (data.performanceScore !== undefined) await logActivity('UPDATE', 'supplier', id, `Performance score updated to ${data.performanceScore}`);

        // Trigger ESG Recalculation if sub-scores are updated
        if (data.esgEnvironmentScore !== undefined || data.esgSocialScore !== undefined || data.esgGovernanceScore !== undefined) {
            await calculateSupplierESG(id);
        }

        revalidatePath(`/suppliers/${id}`);
        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to update supplier:", error);
        return { success: false, error: "Failed to update supplier" };
    }
}

export async function addSupplier(formData: FormData) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        const name = formData.get("name") as string;
        const contactEmail = formData.get("email") as string;
        const riskScore = parseInt(formData.get("risk") as string) || 0;
        const esgScore = parseInt(formData.get("esg") as string) || 0;
        const financialScore = parseInt(formData.get("financial") as string) || 0;
        const performanceScore = parseInt(formData.get("performance") as string) || 80;
        const countryCode = (formData.get("countryCode") as string || '').toUpperCase();
        const city = formData.get("city") as string;
        const latitude = parseFloat(formData.get("latitude") as string);
        const longitude = parseFloat(formData.get("longitude") as string);
        const isoCertifications = Array.from(new Set([
            ...formData.getAll("iso").map((value) => String(value).trim()).filter(Boolean),
            ...String(formData.get("customCertifications") || "")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
        ]));

        if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
            return { success: false, error: "Country code must be a valid 2-letter ISO code" };
        }

        if (Number.isFinite(latitude) && (latitude < -90 || latitude > 90)) {
            return { success: false, error: "Latitude must be between -90 and 90" };
        }

        if (Number.isFinite(longitude) && (longitude < -180 || longitude > 180)) {
            return { success: false, error: "Longitude must be between -180 and 180" };
        }

        const [newSupplier] = await db.insert(suppliers).values({
            name,
            contactEmail,
            countryCode: countryCode || null,
            city: city || null,
            riskScore,
            esgScore,
            financialScore,
            performanceScore,
            status: "active",
            lifecycleStatus: "prospect",
            abcClassification: "None",
            conflictMineralsStatus: "unknown",
            tierLevel: ((formData.get("tier") as 'tier_1' | 'tier_2' | 'tier_3' | 'critical' | null) || "tier_3"),
            isoCertifications,
            esgEnvironmentScore: parseInt(formData.get("esg_env") as string) || 0,
            esgSocialScore: parseInt(formData.get("esg_soc") as string) || 0,
            esgGovernanceScore: parseInt(formData.get("esg_gov") as string) || 0,
            modernSlaveryStatement: formData.get("modern_slavery") === "on" ? "yes" : "no",
            latitude: Number.isFinite(latitude) ? latitude.toString() : null,
            longitude: Number.isFinite(longitude) ? longitude.toString() : null,
        }).returning();

        await logActivity('CREATE', 'supplier', newSupplier.id, `New supplier onboarded: ${name}`);

        // Trigger ESG Recalculation
        await calculateSupplierESG(newSupplier.id);

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to add supplier:", error);
        return { success: false, error: "Failed to add supplier" };
    }
}

export async function enrichSupplierFromPublicProfile(supplierId: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
        if (!supplier) {
            return { success: false, error: "Supplier not found" };
        }

        const domain = extractEmailDomain(supplier.contactEmail);
        if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) {
            return { success: false, error: "A company email domain is required before public-web enrichment can run." };
        }

        const profile = await fetchPublicCompanyProfile(domain);
        if (!profile) {
            return { success: false, error: `Could not reach a public company profile for ${domain}.` };
        }

        const inferred = await inferSupplierProfileFromPublicWeb({
            name: supplier.name,
            domain,
            pageTitle: profile.title,
            description: profile.description,
            plainText: profile.plainText,
        });

        const mergedCategories = Array.from(new Set([...(supplier.categories || []), ...(inferred.categories || [])]));
        const mergedCertifications = Array.from(new Set([...(supplier.isoCertifications || []), ...(inferred.isoCertifications || [])]));

        await db.update(suppliers)
            .set({
                categories: mergedCategories,
                isoCertifications: mergedCertifications,
                countryCode: supplier.countryCode || inferred.countryCode,
                city: supplier.city || inferred.city,
                conflictMineralsStatus: supplier.conflictMineralsStatus === 'unknown' ? inferred.conflictMineralsStatus : supplier.conflictMineralsStatus,
                modernSlaveryStatement: supplier.modernSlaveryStatement === 'no' ? inferred.modernSlaveryStatement : supplier.modernSlaveryStatement,
            })
            .where(eq(suppliers.id, supplierId));

        await logActivity('UPDATE', 'supplier', supplierId, `Supplier record enriched from public web profile (${domain}). ${inferred.summary}`);

        revalidatePath(`/suppliers/${supplierId}`);
        revalidatePath("/suppliers");

        return {
            success: true,
            summary: inferred.summary,
            domain,
            updatedFields: {
                categories: mergedCategories,
                isoCertifications: mergedCertifications,
                countryCode: supplier.countryCode || inferred.countryCode,
                city: supplier.city || inferred.city,
            },
        };
    } catch (error) {
        console.error("Failed to enrich supplier from public profile:", error);
        return { success: false, error: "Failed to enrich supplier from public profile" };
    }
}

export async function getSupplierPerformanceMetrics(supplierId: string) {
    const session = await auth();
    if (!session) return null;
    if (session.user.role === 'supplier' && session.user.supplierId !== supplierId) return null;
    try {
        const [supplierInfo] = await db
            .select({
                performanceScore: suppliers.performanceScore,
                onTimeDeliveryRate: suppliers.onTimeDeliveryRate,
                defectRate: suppliers.defectRate,
                collaborationScore: suppliers.collaborationScore,
                responsivenessScore: suppliers.responsivenessScore,
            })
            .from(suppliers)
            .where(eq(suppliers.id, supplierId))
            .limit(1);

        if (!supplierInfo) return null;

        const logs = await db
            .select()
            .from(supplierPerformanceLogs)
            .where(eq(supplierPerformanceLogs.supplierId, supplierId))
            .orderBy(desc(supplierPerformanceLogs.recordedAt))
            .limit(10);

        return {
            ...supplierInfo,
            performanceLogs: logs
        };
    } catch (error) {
        console.error("Failed to fetch performance metrics:", error);
        return null;
    }
}

/**
 * ESG CALCULATION LOGIC (Point 10 Transparency)
 * Weights: Environment (40%), Social (30%), Governance (30%)
 */
export async function calculateSupplierESG(supplierId: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return null;
    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) return null;

        const env = supplier.esgEnvironmentScore || 0;
        const soc = supplier.esgSocialScore || 0;
        const gov = supplier.esgGovernanceScore || 0;

        const totalEsg = Math.round((env * 0.4) + (soc * 0.3) + (gov * 0.3));

        await db.update(suppliers)
            .set({ esgScore: totalEsg })
            .where(eq(suppliers.id, supplierId));

        return totalEsg;
    } catch (error) {
        console.error("ESG Calculation failed:", error);
        return null;
    }
}

export async function recordPerformanceLog(data: {
    supplierId: string;
    deliveryRate: number;
    qualityScore: number;
    collaborationScore: number;
    notes?: string;
}) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        return await db.transaction(async (tx) => {
            // 1. Record history
            const [log] = await tx.insert(supplierPerformanceLogs).values({
                supplierId: data.supplierId,
                deliveryRate: data.deliveryRate.toString(),
                qualityScore: data.qualityScore.toString(),
                collaborationScore: data.collaborationScore,
                notes: data.notes
            }).returning();

            // 2. Update current snapshots on supplier
            await tx.update(suppliers).set({
                onTimeDeliveryRate: data.deliveryRate.toString(),
                defectRate: (100 - data.qualityScore).toString(),
                collaborationScore: data.collaborationScore,
                performanceScore: Math.round((data.deliveryRate + data.qualityScore + data.collaborationScore) / 3)
            }).where(eq(suppliers.id, data.supplierId));

            await logActivity('CREATE', 'performance_log', log.id, `Manual performance audit recorded for supplier ${data.supplierId}`);

            revalidatePath(`/suppliers/${data.supplierId}`);
            revalidatePath("/suppliers");
            return { success: true };
        });
    } catch (error) {
        console.error("Failed to record performance:", error);
        return { success: false, error: "Failed to save log" };
    }
}

export async function deleteSupplier(id: string) {
    const session = await auth();
    if (!session || session.user.role === 'supplier') return { success: false, error: "Unauthorized" };

    try {
        // 1. Check for blocking dependencies
        const existingOrders = await db.select().from(procurementOrders).where(eq(procurementOrders.supplierId, id)).limit(1);
        if (existingOrders.length > 0) {
            return {
                success: false,
                error: "Cannot delete supplier with existing orders. Please mark as Inactive instead."
            };
        }

        const existingRfqs = await db.select().from(rfqSuppliers).where(eq(rfqSuppliers.supplierId, id)).limit(1);
        if (existingRfqs.length > 0) {
            return {
                success: false,
                error: "Cannot delete supplier involved in active RFQs."
            };
        }

        // 2. Delete Safe Dependencies
        // Delete documents
        await db.delete(documents).where(eq(documents.supplierId, id));
        // Delete performance logs
        await db.delete(supplierPerformanceLogs).where(eq(supplierPerformanceLogs.supplierId, id));

        // 3. Delete Supplier
        const [deleted] = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();

        if (deleted) {
            await logActivity('DELETE', 'supplier', id, `Supplier deleted: ${deleted.name}`);
        }

        revalidatePath("/suppliers");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete supplier:", error);
        return { success: false, error: "Failed to delete supplier" };
    }
}
