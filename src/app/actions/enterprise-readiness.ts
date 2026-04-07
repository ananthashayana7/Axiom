'use server';

import { auth } from "@/auth";
import { db } from "@/db";
import {
    approvalPolicies,
    complianceObligations,
    documents,
    importJobs,
    matchingTolerances,
    notifications,
    platformSettings,
    supplierActionPlans,
    supplierRequests,
    suppliers,
    users,
    webhookDeliveries,
    webhooks,
    workflowTasks,
} from "@/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
    averageScore,
    buildDataConfidence,
    buildGovernanceCoverage,
    buildIntegrationHealth,
    buildReliabilitySummary,
    buildSupplierReadiness,
    scoreLabel,
    type EnterpriseDashboardSnapshot,
    type SupplierEnterpriseSnapshot,
    type SupplierReadinessInput,
} from "@/lib/enterprise-readiness";

type UserSession = {
    id?: string | null;
    role?: string | null;
    supplierId?: string | null;
    name?: string | null;
    email?: string | null;
};

type SupplierSubmissionContext = {
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    description?: string;
    city?: string;
    country?: string;
    countryCode?: string;
    categories?: string[];
    certifications?: string[];
};

const OPEN_TASK_STATUSES = ['open', 'in_progress', 'blocked', 'escalated'] as const;
const ACTIVE_ACTION_PLAN_STATUSES = ['draft', 'active', 'in_progress'] as const;
const PACK_TITLE_PREFIX = {
    task: 'Review supplier onboarding readiness',
    actionPlan: 'Supplier onboarding execution plan',
    questionnaire: 'Complete onboarding questionnaire',
    documents: 'Upload legal and insurance package',
    esg: 'Submit ESG and human-rights attestation',
    trade: 'Submit trade and conflict minerals declaration',
    compliance: 'Supplier onboarding compliance pack',
    humanRights: 'Modern slavery and ESG attestation',
    tradeObligation: 'Conflict minerals and trade declaration',
} as const;

function isAdmin(user: UserSession | null | undefined) {
    return user?.role === 'admin';
}

function safeParseExchangeRates(raw: string | null | undefined): boolean {
    if (!raw?.trim()) return false;
    try {
        const parsed = JSON.parse(raw);
        return Boolean(parsed && typeof parsed === 'object');
    } catch {
        return false;
    }
}

function isOpenTaskStatus(status: string | null | undefined) {
    return OPEN_TASK_STATUSES.includes((status ?? 'open') as typeof OPEN_TASK_STATUSES[number]);
}

function buildSubmissionSummary(context?: SupplierSubmissionContext) {
    if (!context) return undefined;

    const lines = [
        context.contactEmail ? `Contact email: ${context.contactEmail}` : null,
        context.contactPhone ? `Phone: ${context.contactPhone}` : null,
        context.website ? `Website: ${context.website}` : null,
        context.city || context.country || context.countryCode
            ? `Location: ${[context.city, context.country, context.countryCode].filter(Boolean).join(', ')}`
            : null,
        context.categories?.length ? `Categories: ${context.categories.join(', ')}` : null,
        context.certifications?.length ? `Certifications: ${context.certifications.join(', ')}` : null,
        context.description ? `Profile: ${context.description}` : null,
    ].filter(Boolean);

    return lines.length > 0 ? lines.join('\n') : undefined;
}

function isPastDue(date: Date | null | undefined) {
    return Boolean(date && date.getTime() < Date.now());
}

function buildSupplierInput(base: {
    contactEmail: string | null;
    city: string | null;
    countryCode: string | null;
    categories: string[] | null;
    isoCertifications: string[] | null;
    modernSlaveryStatement: string | null;
    financialScore: number | null;
    financialHealthRating: string | null;
    performanceScore: number | null;
    responsivenessScore: number | null;
    collaborationScore: number | null;
    latitude: string | null;
    longitude: string | null;
    lastAuditDate: Date | null;
    lastRiskAudit: Date | null;
    lifecycleStatus: string | null;
    documentCount: number;
    compliance: {
        total: number;
        withEvidence: number;
        overdue: number;
    };
    requests: {
        total: number;
        open: number;
        overdue: number;
        verified: number;
    };
    tasks: {
        open: number;
        escalated: number;
    };
    actionPlans: {
        active: number;
    };
}): SupplierReadinessInput {
    return {
        ...base,
    };
}

function summarizeRequests(rows: Array<{ status: string | null; dueDate: Date | null }>) {
    const verified = rows.filter((row) => row.status === 'verified').length;
    const open = rows.filter((row) => row.status !== 'verified').length;
    const overdue = rows.filter((row) => row.status === 'overdue' || (row.status !== 'verified' && isPastDue(row.dueDate))).length;

    return {
        total: rows.length,
        open,
        overdue,
        verified,
    };
}

function summarizeCompliance(rows: Array<{
    status: string | null;
    documentUrl: string | null;
    evidenceSubmittedAt: Date | null;
    expiresAt: Date | null;
}>) {
    const withEvidence = rows.filter((row) => Boolean(row.documentUrl || row.evidenceSubmittedAt)).length;
    const overdue = rows.filter((row) =>
        row.status === 'expired' ||
        row.status === 'expiring_soon' ||
        (row.status !== 'waived' && row.status !== 'not_applicable' && isPastDue(row.expiresAt))
    ).length;

    return {
        total: rows.length,
        withEvidence,
        overdue,
    };
}

function summarizeTasks(rows: Array<{ status: string | null; dueDate: Date | null }>) {
    const open = rows.filter((row) => isOpenTaskStatus(row.status)).length;
    const escalated = rows.filter((row) => row.status === 'escalated').length;
    const overdue = rows.filter((row) => isOpenTaskStatus(row.status) && isPastDue(row.dueDate)).length;

    return {
        open,
        escalated,
        overdue,
    };
}

function summarizeActionPlans(rows: Array<{ status: string | null }>) {
    return {
        active: rows.filter((row) => ACTIVE_ACTION_PLAN_STATUSES.includes((row.status ?? 'draft') as typeof ACTIVE_ACTION_PLAN_STATUSES[number])).length,
    };
}

async function requireUser() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user;
}

async function getPrimaryAdmin() {
    const [admin] = await db.select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);

    return admin ?? null;
}

async function getAdminRecipients() {
    return db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
}

export async function seedSupplierOnboardingPack(options: {
    supplierId: string;
    supplierName: string;
    createdById: string;
    ownerId?: string | null;
    submissionContext?: SupplierSubmissionContext;
    notifyOwner?: boolean;
}) {
    const ownerId = options.ownerId ?? options.createdById;
    const now = new Date();
    const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const summary = buildSubmissionSummary(options.submissionContext);

    const [existingRequests, existingObligations, existingTasks, existingPlans] = await Promise.all([
        db.select({
            id: supplierRequests.id,
            title: supplierRequests.title,
        }).from(supplierRequests).where(eq(supplierRequests.supplierId, options.supplierId)),
        db.select({
            id: complianceObligations.id,
            title: complianceObligations.title,
        }).from(complianceObligations).where(eq(complianceObligations.supplierId, options.supplierId)),
        db.select({
            id: workflowTasks.id,
            title: workflowTasks.title,
            status: workflowTasks.status,
        }).from(workflowTasks).where(and(
            eq(workflowTasks.entityType, 'supplier'),
            eq(workflowTasks.entityId, options.supplierId),
        )),
        db.select({
            id: supplierActionPlans.id,
            title: supplierActionPlans.title,
            planType: supplierActionPlans.planType,
        }).from(supplierActionPlans).where(eq(supplierActionPlans.supplierId, options.supplierId)),
    ]);

    const obligationByTitle = new Map(existingObligations.map((item) => [item.title, item.id]));
    const requestTitles = new Set(existingRequests.map((item) => item.title));
    const hasOpenReviewTask = existingTasks.some((task) => task.title === PACK_TITLE_PREFIX.task && isOpenTaskStatus(task.status));
    const hasOnboardingPlan = existingPlans.some((plan) => plan.planType === 'onboarding' || plan.title === PACK_TITLE_PREFIX.actionPlan);

    const created = {
        obligations: 0,
        requests: 0,
        tasks: 0,
        actionPlans: 0,
    };

    const obligationTemplates = [
        {
            title: PACK_TITLE_PREFIX.compliance,
            description: 'Provide business registration, insurance, and policy documents required for supplier activation.',
            category: 'supplier_onboarding',
            policyPack: 'SUPPLIER_ONBOARDING',
        },
        {
            title: PACK_TITLE_PREFIX.humanRights,
            description: 'Submit human-rights, labor, and ESG attestations for onboarding review.',
            category: 'esg_attestation',
            policyPack: 'SUPPLIER_ONBOARDING',
        },
        {
            title: PACK_TITLE_PREFIX.tradeObligation,
            description: 'Provide conflict minerals and trade compliance declarations before approval.',
            category: 'regulatory',
            policyPack: 'SUPPLIER_ONBOARDING',
        },
    ] as const;

    for (const obligationTemplate of obligationTemplates) {
        if (obligationByTitle.has(obligationTemplate.title)) continue;

        const [createdObligation] = await db.insert(complianceObligations).values({
            title: obligationTemplate.title,
            description: summary ? `${obligationTemplate.description}\n\nSupplier submission:\n${summary}` : obligationTemplate.description,
            supplierId: options.supplierId,
            category: obligationTemplate.category,
            status: 'active',
            ownerId,
            documentRequired: 'yes',
            expiresAt: dueDate,
            reminderDaysBefore: 7,
            policyPack: obligationTemplate.policyPack,
            region: options.submissionContext?.countryCode || null,
        }).returning({ id: complianceObligations.id });

        obligationByTitle.set(obligationTemplate.title, createdObligation.id);
        created.obligations += 1;
    }

    const requestTemplates = [
        {
            title: PACK_TITLE_PREFIX.questionnaire,
            description: 'Confirm core company data, production footprint, and onboarding readiness.',
            requestType: 'onboarding' as const,
            linkedTitle: undefined,
        },
        {
            title: PACK_TITLE_PREFIX.documents,
            description: 'Upload company registration, insurance, and supporting supplier documents.',
            requestType: 'document_request' as const,
            linkedTitle: PACK_TITLE_PREFIX.compliance,
        },
        {
            title: PACK_TITLE_PREFIX.esg,
            description: 'Provide ESG, modern slavery, and labor-practice attestations.',
            requestType: 'compliance_attestation' as const,
            linkedTitle: PACK_TITLE_PREFIX.humanRights,
        },
        {
            title: PACK_TITLE_PREFIX.trade,
            description: 'Provide trade compliance and conflict minerals declarations.',
            requestType: 'compliance_attestation' as const,
            linkedTitle: PACK_TITLE_PREFIX.tradeObligation,
        },
    ] as const;

    for (const requestTemplate of requestTemplates) {
        if (requestTitles.has(requestTemplate.title)) continue;

        await db.insert(supplierRequests).values({
            supplierId: options.supplierId,
            requestType: requestTemplate.requestType,
            title: requestTemplate.title,
            description: summary ? `${requestTemplate.description}\n\nSupplier submission:\n${summary}` : requestTemplate.description,
            status: 'sent',
            assigneeId: ownerId,
            dueDate,
            linkedObligationId: requestTemplate.linkedTitle ? obligationByTitle.get(requestTemplate.linkedTitle) ?? null : null,
            createdById: options.createdById,
        });

        created.requests += 1;
    }

    if (!hasOnboardingPlan) {
        await db.insert(supplierActionPlans).values({
            supplierId: options.supplierId,
            title: PACK_TITLE_PREFIX.actionPlan,
            description: summary ? `Drive the supplier through the onboarding controls needed for activation.\n\nSupplier submission:\n${summary}` : 'Drive the supplier through the onboarding controls needed for activation.',
            severity: 'high',
            status: 'active',
            planType: 'onboarding',
            ownerId,
            dueDate,
            steps: JSON.stringify([
                { title: 'Validate supplier master data', status: 'open', dueDate: dueDate.toISOString() },
                { title: 'Collect onboarding documents', status: 'open', dueDate: dueDate.toISOString() },
                { title: 'Review ESG and trade attestations', status: 'open', dueDate: dueDate.toISOString() },
                { title: 'Approve supplier once readiness threshold is met', status: 'open', dueDate: dueDate.toISOString() },
            ]),
            createdById: options.createdById,
        });

        created.actionPlans += 1;
    }

    if (!hasOpenReviewTask) {
        await db.insert(workflowTasks).values({
            title: PACK_TITLE_PREFIX.task,
            description: summary ? `Review onboarding pack, validate evidence, and approve only after readiness reaches threshold.\n\nSupplier submission:\n${summary}` : 'Review onboarding pack, validate evidence, and approve only after readiness reaches threshold.',
            entityType: 'supplier',
            entityId: options.supplierId,
            status: 'open',
            priority: 'high',
            assigneeId: ownerId,
            createdById: options.createdById,
            dueDate,
            nextAction: 'Validate documents, close open requests, and approve when readiness score is at least 75.',
        });

        created.tasks += 1;
    }

    if ((options.notifyOwner ?? true) && ownerId && (created.obligations > 0 || created.requests > 0 || created.tasks > 0 || created.actionPlans > 0)) {
        await db.insert(notifications).values({
            userId: ownerId,
            title: 'Supplier onboarding pack updated',
            message: `${options.supplierName} now has an onboarding pack with ${created.requests} request(s), ${created.obligations} obligation(s), and ${created.tasks} review task(s).`,
            type: 'info',
            link: `/suppliers/${options.supplierId}`,
        });
    }

    return created;
}

export async function ensureSupplierOnboardingPack(supplierId: string) {
    const user = await requireUser();
    if (!isAdmin(user)) {
        return { success: false as const, error: 'Admin access required' };
    }

    const [supplier] = await db.select({
        id: suppliers.id,
        name: suppliers.name,
        contactEmail: suppliers.contactEmail,
        city: suppliers.city,
        countryCode: suppliers.countryCode,
        categories: suppliers.categories,
        isoCertifications: suppliers.isoCertifications,
    }).from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);

    if (!supplier) {
        return { success: false as const, error: 'Supplier not found' };
    }

    const created = await seedSupplierOnboardingPack({
        supplierId,
        supplierName: supplier.name,
        createdById: user.id as string,
        ownerId: user.id as string,
        submissionContext: {
            contactEmail: supplier.contactEmail ?? undefined,
            city: supplier.city ?? undefined,
            countryCode: supplier.countryCode ?? undefined,
            categories: supplier.categories ?? undefined,
            certifications: supplier.isoCertifications ?? undefined,
        },
    });

    revalidatePath(`/suppliers/${supplierId}`);
    revalidatePath('/admin/analytics');
    revalidatePath('/admin/tasks');
    revalidatePath('/admin/compliance');

    return {
        success: true as const,
        created,
        message: created.obligations + created.requests + created.tasks + created.actionPlans > 0
            ? 'Onboarding pack refreshed.'
            : 'Onboarding pack was already complete.',
    };
}

export async function getSupplierEnterpriseReadiness(supplierId: string): Promise<SupplierEnterpriseSnapshot | null> {
    const user = await requireUser();
    if (user.role === 'supplier' && user.supplierId !== supplierId) return null;

    const [supplier] = await db.select({
        id: suppliers.id,
        contactEmail: suppliers.contactEmail,
        city: suppliers.city,
        countryCode: suppliers.countryCode,
        categories: suppliers.categories,
        isoCertifications: suppliers.isoCertifications,
        modernSlaveryStatement: suppliers.modernSlaveryStatement,
        financialScore: suppliers.financialScore,
        financialHealthRating: suppliers.financialHealthRating,
        performanceScore: suppliers.performanceScore,
        responsivenessScore: suppliers.responsivenessScore,
        collaborationScore: suppliers.collaborationScore,
        latitude: suppliers.latitude,
        longitude: suppliers.longitude,
        lastAuditDate: suppliers.lastAuditDate,
        lastRiskAudit: suppliers.lastRiskAudit,
        lifecycleStatus: suppliers.lifecycleStatus,
    }).from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);

    if (!supplier) return null;

    const [documentCountRow, requestRows, complianceRows, taskRows, actionPlanRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
            .from(documents)
            .where(eq(documents.supplierId, supplierId)),
        db.select({
            status: supplierRequests.status,
            dueDate: supplierRequests.dueDate,
        }).from(supplierRequests).where(eq(supplierRequests.supplierId, supplierId)),
        db.select({
            status: complianceObligations.status,
            documentUrl: complianceObligations.documentUrl,
            evidenceSubmittedAt: complianceObligations.evidenceSubmittedAt,
            expiresAt: complianceObligations.expiresAt,
        }).from(complianceObligations).where(eq(complianceObligations.supplierId, supplierId)),
        db.select({
            status: workflowTasks.status,
            dueDate: workflowTasks.dueDate,
        }).from(workflowTasks).where(and(
            eq(workflowTasks.entityType, 'supplier'),
            eq(workflowTasks.entityId, supplierId),
        )),
        db.select({
            status: supplierActionPlans.status,
        }).from(supplierActionPlans).where(eq(supplierActionPlans.supplierId, supplierId)),
    ]);

    const requestSummary = summarizeRequests(requestRows);
    const complianceSummary = summarizeCompliance(complianceRows);
    const taskSummary = summarizeTasks(taskRows);
    const actionPlanSummary = summarizeActionPlans(actionPlanRows);
    const documentCount = documentCountRow[0]?.count ?? 0;

    const supplierInput = buildSupplierInput({
        contactEmail: supplier.contactEmail,
        city: supplier.city,
        countryCode: supplier.countryCode,
        categories: supplier.categories,
        isoCertifications: supplier.isoCertifications,
        modernSlaveryStatement: supplier.modernSlaveryStatement,
        financialScore: supplier.financialScore,
        financialHealthRating: supplier.financialHealthRating,
        performanceScore: supplier.performanceScore,
        responsivenessScore: supplier.responsivenessScore,
        collaborationScore: supplier.collaborationScore,
        latitude: supplier.latitude,
        longitude: supplier.longitude,
        lastAuditDate: supplier.lastAuditDate,
        lastRiskAudit: supplier.lastRiskAudit,
        lifecycleStatus: supplier.lifecycleStatus,
        documentCount,
        compliance: complianceSummary,
        requests: requestSummary,
        tasks: {
            open: taskSummary.open,
            escalated: taskSummary.escalated,
        },
        actionPlans: actionPlanSummary,
    });

    const readiness = buildSupplierReadiness(supplierInput);
    const confidence = buildDataConfidence(supplierInput);

    return {
        readiness,
        confidence,
        metrics: {
            documentCount,
            complianceTotal: complianceSummary.total,
            complianceWithEvidence: complianceSummary.withEvidence,
            openRequests: requestSummary.open,
            overdueRequests: requestSummary.overdue,
            openTasks: taskSummary.open,
            escalatedTasks: taskSummary.escalated,
            activeActionPlans: actionPlanSummary.active,
        },
    };
}

export async function getEnterpriseReadinessDashboard(): Promise<EnterpriseDashboardSnapshot> {
    const user = await requireUser();
    if (!isAdmin(user)) throw new Error('Admin access required');

    const now = Date.now();
    const deliveryWindow = now - (14 * 24 * 60 * 60 * 1000);
    const importWindow = now - (30 * 24 * 60 * 60 * 1000);

    const [
        supplierRows,
        documentCounts,
        requestRows,
        complianceRows,
        supplierTaskRows,
        allTaskRows,
        actionPlanRows,
        webhookRows,
        deliveryRows,
        settingsRows,
        policyRows,
        toleranceRows,
        importRows,
    ] = await Promise.all([
        db.select({
            id: suppliers.id,
            name: suppliers.name,
            status: suppliers.status,
            lifecycleStatus: suppliers.lifecycleStatus,
            contactEmail: suppliers.contactEmail,
            city: suppliers.city,
            countryCode: suppliers.countryCode,
            categories: suppliers.categories,
            isoCertifications: suppliers.isoCertifications,
            modernSlaveryStatement: suppliers.modernSlaveryStatement,
            financialScore: suppliers.financialScore,
            financialHealthRating: suppliers.financialHealthRating,
            performanceScore: suppliers.performanceScore,
            responsivenessScore: suppliers.responsivenessScore,
            collaborationScore: suppliers.collaborationScore,
            latitude: suppliers.latitude,
            longitude: suppliers.longitude,
            lastAuditDate: suppliers.lastAuditDate,
            lastRiskAudit: suppliers.lastRiskAudit,
        }).from(suppliers),
        db.select({
            supplierId: documents.supplierId,
            count: sql<number>`count(*)::int`,
        }).from(documents).groupBy(documents.supplierId),
        db.select({
            supplierId: supplierRequests.supplierId,
            status: supplierRequests.status,
            dueDate: supplierRequests.dueDate,
        }).from(supplierRequests),
        db.select({
            supplierId: complianceObligations.supplierId,
            status: complianceObligations.status,
            documentUrl: complianceObligations.documentUrl,
            evidenceSubmittedAt: complianceObligations.evidenceSubmittedAt,
            expiresAt: complianceObligations.expiresAt,
        }).from(complianceObligations).where(isNotNull(complianceObligations.supplierId)),
        db.select({
            entityId: workflowTasks.entityId,
            status: workflowTasks.status,
            dueDate: workflowTasks.dueDate,
        }).from(workflowTasks).where(eq(workflowTasks.entityType, 'supplier')),
        db.select({
            status: workflowTasks.status,
            dueDate: workflowTasks.dueDate,
        }).from(workflowTasks),
        db.select({
            supplierId: supplierActionPlans.supplierId,
            status: supplierActionPlans.status,
        }).from(supplierActionPlans),
        db.select({
            id: webhooks.id,
            isActive: webhooks.isActive,
            lastTriggeredAt: webhooks.lastTriggeredAt,
        }).from(webhooks),
        db.select({
            status: webhookDeliveries.status,
            createdAt: webhookDeliveries.createdAt,
        }).from(webhookDeliveries)
            .orderBy(desc(webhookDeliveries.createdAt))
            .limit(250),
        db.select({
            geminiApiKey: platformSettings.geminiApiKey,
            geminiApiKeyFallback1: platformSettings.geminiApiKeyFallback1,
            geminiApiKeyFallback2: platformSettings.geminiApiKeyFallback2,
            exchangeRates: platformSettings.exchangeRates,
        }).from(platformSettings).limit(1),
        db.select({
            entityType: approvalPolicies.entityType,
        }).from(approvalPolicies).where(eq(approvalPolicies.isActive, 'yes')),
        db.select({
            supplierId: matchingTolerances.supplierId,
        }).from(matchingTolerances).where(eq(matchingTolerances.isActive, 'yes')),
        db.select({
            status: importJobs.status,
            totalRows: importJobs.totalRows,
            successRows: importJobs.successRows,
            sourceSystemId: importJobs.sourceSystemId,
            createdAt: importJobs.createdAt,
        }).from(importJobs)
            .orderBy(desc(importJobs.createdAt))
            .limit(100),
    ]);

    const documentCountBySupplier = new Map(documentCounts.map((row) => [row.supplierId, row.count]));
    const requestRowsBySupplier = new Map<string, Array<{ status: string | null; dueDate: Date | null }>>();
    const complianceRowsBySupplier = new Map<string, Array<{ status: string | null; documentUrl: string | null; evidenceSubmittedAt: Date | null; expiresAt: Date | null }>>();
    const taskRowsBySupplier = new Map<string, Array<{ status: string | null; dueDate: Date | null }>>();
    const actionPlanRowsBySupplier = new Map<string, Array<{ status: string | null }>>();

    for (const row of requestRows) {
        const bucket = requestRowsBySupplier.get(row.supplierId) ?? [];
        bucket.push({ status: row.status, dueDate: row.dueDate });
        requestRowsBySupplier.set(row.supplierId, bucket);
    }

    for (const row of complianceRows) {
        if (!row.supplierId) continue;
        const bucket = complianceRowsBySupplier.get(row.supplierId) ?? [];
        bucket.push({
            status: row.status,
            documentUrl: row.documentUrl,
            evidenceSubmittedAt: row.evidenceSubmittedAt,
            expiresAt: row.expiresAt,
        });
        complianceRowsBySupplier.set(row.supplierId, bucket);
    }

    for (const row of supplierTaskRows) {
        const bucket = taskRowsBySupplier.get(row.entityId) ?? [];
        bucket.push({ status: row.status, dueDate: row.dueDate });
        taskRowsBySupplier.set(row.entityId, bucket);
    }

    for (const row of actionPlanRows) {
        const bucket = actionPlanRowsBySupplier.get(row.supplierId) ?? [];
        bucket.push({ status: row.status });
        actionPlanRowsBySupplier.set(row.supplierId, bucket);
    }

    const supplierSnapshots = supplierRows.map((supplier) => {
        const requestSummary = summarizeRequests(requestRowsBySupplier.get(supplier.id) ?? []);
        const complianceSummary = summarizeCompliance(complianceRowsBySupplier.get(supplier.id) ?? []);
        const taskSummary = summarizeTasks(taskRowsBySupplier.get(supplier.id) ?? []);
        const actionPlanSummary = summarizeActionPlans(actionPlanRowsBySupplier.get(supplier.id) ?? []);
        const supplierInput = buildSupplierInput({
            contactEmail: supplier.contactEmail,
            city: supplier.city,
            countryCode: supplier.countryCode,
            categories: supplier.categories,
            isoCertifications: supplier.isoCertifications,
            modernSlaveryStatement: supplier.modernSlaveryStatement,
            financialScore: supplier.financialScore,
            financialHealthRating: supplier.financialHealthRating,
            performanceScore: supplier.performanceScore,
            responsivenessScore: supplier.responsivenessScore,
            collaborationScore: supplier.collaborationScore,
            latitude: supplier.latitude,
            longitude: supplier.longitude,
            lastAuditDate: supplier.lastAuditDate,
            lastRiskAudit: supplier.lastRiskAudit,
            lifecycleStatus: supplier.lifecycleStatus,
            documentCount: documentCountBySupplier.get(supplier.id) ?? 0,
            compliance: complianceSummary,
            requests: requestSummary,
            tasks: {
                open: taskSummary.open,
                escalated: taskSummary.escalated,
            },
            actionPlans: actionPlanSummary,
        });

        return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: supplier.status,
            lifecycleStatus: supplier.lifecycleStatus,
            readiness: buildSupplierReadiness(supplierInput),
            confidence: buildDataConfidence(supplierInput),
        };
    });

    const averageReadiness = averageScore(supplierSnapshots.map((snapshot) => snapshot.readiness.score));
    const averageConfidence = averageScore(supplierSnapshots.map((snapshot) => snapshot.confidence.score));
    const readyForApproval = supplierSnapshots.filter((snapshot) => snapshot.lifecycleStatus === 'onboarding' && snapshot.readiness.canApprove).length;
    const attentionSuppliers = supplierSnapshots
        .filter((snapshot) => snapshot.readiness.blockers.length > 0 || snapshot.readiness.score < 70)
        .sort((left, right) => left.readiness.score - right.readiness.score || left.confidence.score - right.confidence.score)
        .slice(0, 5)
        .map((snapshot) => ({
            supplierId: snapshot.supplierId,
            supplierName: snapshot.supplierName,
            readinessScore: snapshot.readiness.score,
            confidenceScore: snapshot.confidence.score,
            blockers: snapshot.readiness.blockers.slice(0, 3),
        }));

    const settings = settingsRows[0];
    const activeWebhookRows = webhookRows.filter((row) => row.isActive === 'yes');
    const staleWebhooks = activeWebhookRows.filter((row) => !row.lastTriggeredAt || row.lastTriggeredAt.getTime() < now - (30 * 24 * 60 * 60 * 1000)).length;
    const recentDeliveries = deliveryRows.filter((row) => row.createdAt && row.createdAt.getTime() >= deliveryWindow);
    const deliveryCounts = {
        pending: recentDeliveries.filter((row) => row.status === 'pending').length,
        success: recentDeliveries.filter((row) => row.status === 'success').length,
        failed: recentDeliveries.filter((row) => row.status === 'failed').length,
        retrying: recentDeliveries.filter((row) => row.status === 'retrying').length,
    };
    const recentImportJobs = importRows.filter((row) => row.createdAt && row.createdAt.getTime() >= importWindow);
    const importTotals = recentImportJobs.reduce((acc, row) => {
        acc.totalRows += row.totalRows ?? 0;
        acc.successRows += row.successRows ?? 0;
        return acc;
    }, { totalRows: 0, successRows: 0 });
    const importSuccessRate = importTotals.totalRows > 0 ? Math.round((importTotals.successRows / importTotals.totalRows) * 100) : null;
    const processedDeliveries = deliveryCounts.success + deliveryCounts.failed + deliveryCounts.retrying;
    const webhookSuccessRate = processedDeliveries > 0 ? Math.round((deliveryCounts.success / processedDeliveries) * 100) : null;
    const activeSourceSystems = new Set(recentImportJobs.map((row) => row.sourceSystemId).filter(Boolean)).size;
    const workflowHealth = summarizeTasks(allTaskRows);

    const integrationHealth = buildIntegrationHealth({
        totalWebhooks: webhookRows.length,
        activeWebhooks: activeWebhookRows.length,
        staleWebhooks,
        deliveries: deliveryCounts,
        activeSourceSystems,
        recentImports: recentImportJobs.length,
        settings: {
            hasPrimaryAiKey: Boolean(settings?.geminiApiKey?.trim()),
            fallbackKeyCount: [settings?.geminiApiKeyFallback1, settings?.geminiApiKeyFallback2].filter((value) => Boolean(value?.trim())).length,
            hasExchangeRates: safeParseExchangeRates(settings?.exchangeRates),
        },
    });

    const governanceCoverage = buildGovernanceCoverage({
        activePolicyCount: policyRows.length,
        coveredEntityTypes: policyRows.map((row) => row.entityType),
        activeToleranceCount: toleranceRows.length,
        supplierSpecificToleranceCount: toleranceRows.filter((row) => Boolean(row.supplierId)).length,
        escalatedTasks: workflowHealth.escalated,
        overdueTasks: workflowHealth.overdue,
    });

    const reliability = buildReliabilitySummary({
        importSuccessRate,
        recentImportJobs: recentImportJobs.length,
        webhookSuccessRate,
        recentDeliveries: recentDeliveries.length,
        overdueTasks: workflowHealth.overdue,
        escalatedTasks: workflowHealth.escalated,
    });

    const complianceSummary = summarizeCompliance(complianceRows.map((row) => ({
        status: row.status,
        documentUrl: row.documentUrl,
        evidenceSubmittedAt: row.evidenceSubmittedAt,
        expiresAt: row.expiresAt,
    })));
    const requestSummary = summarizeRequests(requestRows.map((row) => ({
        status: row.status,
        dueDate: row.dueDate,
    })));

    const priorityActions = [
        ...integrationHealth.gaps,
        ...governanceCoverage.gaps,
        ...reliability.gaps,
        ...attentionSuppliers.flatMap((supplier) => supplier.blockers.map((blocker) => `${supplier.supplierName}: ${blocker}`)),
    ].filter(Boolean).slice(0, 8);

    const overallScore = averageScore([
        averageReadiness,
        averageConfidence,
        integrationHealth.score,
        governanceCoverage.score,
        reliability.score,
    ]);

    return {
        overallScore,
        overallLabel: scoreLabel(overallScore),
        supplierNetwork: {
            totalSuppliers: supplierRows.length,
            activeSuppliers: supplierRows.filter((supplier) => supplier.status === 'active').length,
            onboardingSuppliers: supplierRows.filter((supplier) => supplier.lifecycleStatus === 'onboarding').length,
            readyForApproval,
            averageReadiness,
            averageConfidence,
            attentionSuppliers,
        },
        compliance: {
            totalObligations: complianceSummary.total,
            evidenceCoverage: complianceSummary.total > 0 ? Math.round((complianceSummary.withEvidence / complianceSummary.total) * 100) : 0,
            expiredOrOverdue: complianceSummary.overdue,
            overdueRequests: requestSummary.overdue,
        },
        integrations: {
            ...integrationHealth,
            totalWebhooks: webhookRows.length,
            activeWebhooks: activeWebhookRows.length,
            recentDeliveries: recentDeliveries.length,
            activeSourceSystems,
        },
        governance: {
            ...governanceCoverage,
            activePolicies: policyRows.length,
            activeTolerances: toleranceRows.length,
        },
        reliability: {
            ...reliability,
            recentImportJobs: recentImportJobs.length,
            recentDeliveries: recentDeliveries.length,
        },
        priorityActions,
    };
}

export async function createRegistrationOnboardingPack(params: {
    supplierId: string;
    supplierName: string;
    submissionContext?: SupplierSubmissionContext;
}) {
    const admin = await getPrimaryAdmin();
    if (!admin) {
        return {
            created: {
                obligations: 0,
                requests: 0,
                tasks: 0,
                actionPlans: 0,
            },
            ownerId: null,
        };
    }

    const created = await seedSupplierOnboardingPack({
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        createdById: admin.id,
        ownerId: admin.id,
        submissionContext: params.submissionContext,
        notifyOwner: false,
    });

    return {
        created,
        ownerId: admin.id,
    };
}

export async function notifyAdminsAboutRegistration(params: {
    supplierId: string;
    supplierName: string;
    contactEmail: string;
}) {
    const admins = await getAdminRecipients();
    if (admins.length === 0) return;

    await db.insert(notifications).values(
        admins.map((admin) => ({
            userId: admin.id,
            title: 'New supplier registration',
            message: `${params.supplierName} (${params.contactEmail}) entered onboarding and needs review.`,
            type: 'info' as const,
            link: `/suppliers/${params.supplierId}`,
        }))
    );
}
