/**
 * Smart Approval Routing Agent
 * Deterministic approval-path optimization for requisitions and orders
 */

'use server'

import { auth } from "@/auth";
import { createNotification } from "@/app/actions/notifications";
import { db } from "@/db";
import { auditLogs, procurementOrders, requisitions, suppliers, users } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult } from "@/lib/ai/agent-types";

const APPROVAL_THRESHOLDS = {
    autoApprove: 25000,
    singleApprover: 100000,
    dualApprover: 500000,
    executiveApproval: Infinity,
};

interface RiskFactors {
    requesterTrustScore: number;
    budgetUtilization: number;
    supplierRiskScore: number;
    unusualPatterns: boolean;
    urgencyFlag: boolean;
    complianceFlags: string[];
}

interface ApprovalRoute {
    requisitionId: string;
    recommendedPath: ApprovalStep[];
    estimatedTimeToApproval: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    autoApprovalEligible: boolean;
    reasoning: string;
    alternativeRoutes?: ApprovalStep[][];
}

interface ApprovalStep {
    order: number;
    approverId?: string;
    approverRole: string;
    approverName?: string;
    department?: string;
    estimatedResponseTime: number;
    isOptional: boolean;
    condition?: string;
}

type AdminApprover = {
    id: string;
    name: string;
    role: string | null;
    department: string | null;
    accessProfile: string | null;
};

function toNumber(value: string | number | null | undefined) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

function clampPercentage(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDepartment(value: string | null | undefined) {
    return value?.trim().toLowerCase() || null;
}

function classifyRiskLevel(amount: number) {
    if (amount >= 2000000) {
        return "critical" as const;
    }
    if (amount >= APPROVAL_THRESHOLDS.dualApprover) {
        return "high" as const;
    }
    if (amount >= APPROVAL_THRESHOLDS.singleApprover) {
        return "medium" as const;
    }
    return "low" as const;
}

function findApprover(
    approvers: AdminApprover[],
    accessProfiles: string[],
    department?: string | null,
) {
    const normalizedDepartment = normalizeDepartment(department);

    const departmentMatch = approvers.find((approver) =>
        accessProfiles.includes(approver.accessProfile || "")
        && normalizeDepartment(approver.department) === normalizedDepartment
    );

    if (departmentMatch) {
        return departmentMatch;
    }

    return approvers.find((approver) => accessProfiles.includes(approver.accessProfile || "")) || null;
}

function buildApprovalStep(
    order: number,
    approverRole: string,
    estimatedResponseTime: number,
    approver?: AdminApprover | null,
    condition?: string,
): ApprovalStep {
    return {
        order,
        approverId: approver?.id,
        approverRole,
        approverName: approver?.name || undefined,
        department: approver?.department || undefined,
        estimatedResponseTime,
        isOptional: false,
        condition,
    };
}

export async function calculateApprovalRoute(
    requisitionId: string,
): Promise<AgentResult<ApprovalRoute>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
        };
    }

    try {
        const requisition = await db.select({
            id: requisitions.id,
            title: requisitions.title,
            estimatedAmount: requisitions.estimatedAmount,
            department: requisitions.department,
            requestedById: requisitions.requestedById,
            status: requisitions.status,
            createdAt: requisitions.createdAt,
        })
            .from(requisitions)
            .where(eq(requisitions.id, requisitionId))
            .limit(1);

        if (requisition.length === 0) {
            return {
                success: false,
                error: "Requisition not found",
                confidence: 0,
                executionTimeMs: Date.now() - startTime,
                agentName: "smart-approval-routing",
                timestamp: new Date(),
            };
        }

        const req = requisition[0];
        const amount = toNumber(req.estimatedAmount);
        const riskFactors = await calculateRiskFactors(req.requestedById, req.department, amount);
        const route = await determineApprovalPath(req, amount, riskFactors);

        await TelemetryService.trackEvent("SmartApprovalRouting", "route_calculated", {
            requisitionId,
            amount,
            riskLevel: route.riskLevel,
            autoApprovalEligible: route.autoApprovalEligible,
            stepCount: route.recommendedPath.length,
        });

        return {
            success: true,
            data: route,
            confidence: calculateConfidence(riskFactors),
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
            reasoning: route.reasoning,
            sources: ["requisition_history", "department_spend", "supplier_exposure", "org_hierarchy"],
        };
    } catch (error) {
        console.error("Smart Approval Routing Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Routing failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
        };
    }
}

async function calculateRiskFactors(
    requesterId: string,
    department: string | null,
    amount: number,
): Promise<RiskFactors> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const oneHundredTwentyDaysAgo = new Date(now);
    oneHundredTwentyDaysAgo.setDate(now.getDate() - 120);

    const departmentHistoryRows = await (
        department
            ? db.select({
                amount: requisitions.estimatedAmount,
                createdAt: requisitions.createdAt,
            })
                .from(requisitions)
                .where(and(
                    eq(requisitions.department, department),
                    gte(requisitions.createdAt, oneHundredTwentyDaysAgo),
                ))
                .limit(500)
            : Promise.resolve([])
    );

    const requesterHistoryRows = await db.select({
        totalRequests: requisitions.id,
        status: requisitions.status,
        amount: requisitions.estimatedAmount,
    })
        .from(requisitions)
        .where(eq(requisitions.requestedById, requesterId))
        .limit(500);

    const totalRequests = requesterHistoryRows.length;
    const approvedRequests = requesterHistoryRows.filter((row) => row.status === "approved" || row.status === "converted_to_po").length;
    const rejectedRequests = requesterHistoryRows.filter((row) => row.status === "rejected").length;
    const averageAmount = totalRequests > 0
        ? requesterHistoryRows.reduce((sum, row) => sum + toNumber(row.amount), 0) / totalRequests
        : 0;

    let trustScore = 50;
    if (totalRequests > 0) {
        const approvalRate = approvedRequests / totalRequests;
        trustScore = Math.min(100, Math.round(50 + (approvalRate * 50)));
        if (rejectedRequests > 2) {
            trustScore = Math.max(20, trustScore - (rejectedRequests * 5));
        }
    }

    const isUnusual =
        (averageAmount > 0 && amount > averageAmount * 3)
        || now.getDay() === 0
        || now.getDay() === 6
        || now.getHours() < 6
        || now.getHours() > 22;

    const currentDepartmentSpend = departmentHistoryRows
        .filter((row) => row.createdAt && row.createdAt >= thirtyDaysAgo)
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const priorDepartmentSpend = departmentHistoryRows
        .filter((row) => row.createdAt && row.createdAt < thirtyDaysAgo)
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
    const baselineMonthlySpend = priorDepartmentSpend > 0 ? priorDepartmentSpend / 3 : 0;
    const budgetUtilization = baselineMonthlySpend > 0
        ? clampPercentage((currentDepartmentSpend / baselineMonthlySpend) * 100)
        : currentDepartmentSpend > 0 ? 100 : 0;

    const supplierExposureRows = department
        ? await db.select({ riskScore: suppliers.riskScore })
            .from(procurementOrders)
            .innerJoin(requisitions, eq(procurementOrders.requisitionId, requisitions.id))
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(requisitions.department, department))
            .orderBy(desc(procurementOrders.createdAt))
            .limit(20)
        : await db.select({ riskScore: suppliers.riskScore })
            .from(procurementOrders)
            .innerJoin(requisitions, eq(procurementOrders.requisitionId, requisitions.id))
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .where(eq(requisitions.requestedById, requesterId))
            .orderBy(desc(procurementOrders.createdAt))
            .limit(20);

    const supplierRiskScore = supplierExposureRows.length > 0
        ? clampPercentage(Math.max(...supplierExposureRows.map((row) => Number(row.riskScore || 0))))
        : 0;

    const complianceFlags: string[] = [];
    if (!department) {
        complianceFlags.push("missing_department_scope");
    }
    if (budgetUtilization >= 90) {
        complianceFlags.push("department_budget_stress");
    }
    if (supplierRiskScore >= 70) {
        complianceFlags.push("elevated_supplier_risk");
    }

    return {
        requesterTrustScore: trustScore,
        budgetUtilization,
        supplierRiskScore,
        unusualPatterns: isUnusual,
        urgencyFlag: amount >= APPROVAL_THRESHOLDS.dualApprover,
        complianceFlags,
    };
}

async function determineApprovalPath(
    requisition: { id: string; title: string; department: string | null },
    amount: number,
    riskFactors: RiskFactors,
): Promise<ApprovalRoute> {
    const steps: ApprovalStep[] = [];
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    let autoApprovalEligible = false;
    let reasoning = "";

    const riskMultiplier = riskFactors.unusualPatterns
        ? 0.5
        : riskFactors.requesterTrustScore > 80
            ? 1.25
            : 1;
    const adjustedAutoApprove = APPROVAL_THRESHOLDS.autoApprove * riskMultiplier;
    const adjustedSingleApprover = APPROVAL_THRESHOLDS.singleApprover * riskMultiplier;
    const requiresFinanceReview = riskFactors.budgetUtilization >= 90 || riskFactors.supplierRiskScore >= 70;
    const requiresExecutiveReview = amount >= APPROVAL_THRESHOLDS.dualApprover || riskFactors.complianceFlags.length >= 2;

    const approvers = await db.select({
        id: users.id,
        name: users.name,
        role: users.role,
        department: users.department,
        accessProfile: users.accessProfile,
    })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(25);

    const sourcingApprover = findApprover(approvers, ["sourcing_manager", "super_admin"], requisition.department);
    const financeApprover = findApprover(approvers, ["finance_auditor", "super_admin"], requisition.department);
    const executiveApprover = findApprover(approvers, ["super_admin"]);

    if (
        amount < adjustedAutoApprove
        && riskFactors.requesterTrustScore >= 75
        && !riskFactors.unusualPatterns
        && riskFactors.budgetUtilization < 75
        && riskFactors.supplierRiskScore < 60
        && riskFactors.complianceFlags.length === 0
    ) {
        autoApprovalEligible = true;
        riskLevel = "low";
        reasoning = `Amount ${amount.toLocaleString("en-IN")} is within the governed auto-approval window, requester trust is ${riskFactors.requesterTrustScore}, and no budget or supplier-risk escalation flags are active.`;
        steps.push({
            order: 1,
            approverRole: "system",
            approverName: "Auto-Approval System",
            estimatedResponseTime: 0,
            isOptional: false,
            condition: "Automatic approval based on policy rules",
        });
    } else if (amount < adjustedSingleApprover && !requiresFinanceReview && !requiresExecutiveReview) {
        riskLevel = riskFactors.unusualPatterns ? "medium" : "low";
        reasoning = "Single-approver route selected because the requisition amount stays below the managed threshold and no finance or executive escalation rule fired.";
        steps.push(buildApprovalStep(1, "Sourcing Manager", 4, sourcingApprover));
    } else if (!requiresExecutiveReview) {
        riskLevel = requiresFinanceReview || riskFactors.unusualPatterns ? "high" : "medium";
        reasoning = "Dual-approval route selected because the requisition amount or operating posture requires sourcing plus finance review before release.";
        steps.push(buildApprovalStep(1, "Sourcing Manager", 4, sourcingApprover));
        steps.push(buildApprovalStep(2, "Finance Controller", 8, financeApprover));
    } else {
        riskLevel = amount > 2000000 || riskFactors.complianceFlags.length >= 2 ? "critical" : "high";
        reasoning = "Executive approval chain selected because the requisition exceeds the high-value threshold or carries stacked escalation signals.";
        steps.push(buildApprovalStep(1, "Sourcing Manager", 4, sourcingApprover));
        steps.push(buildApprovalStep(2, "Finance Controller", 12, financeApprover));
        steps.push(buildApprovalStep(3, "Super Admin", 24, executiveApprover, "Required for high-value or stacked-risk approval routes"));
    }

    if (riskFactors.complianceFlags.length > 0) {
        steps.push(buildApprovalStep(
            steps.length + 1,
            "Compliance Review",
            8,
            financeApprover,
            `Compliance review for: ${riskFactors.complianceFlags.join(", ")}`
        ));
        riskLevel = riskLevel === "critical" ? "critical" : "high";
    }

    return {
        requisitionId: requisition.id,
        recommendedPath: steps,
        estimatedTimeToApproval: steps.reduce((sum, step) => sum + step.estimatedResponseTime, 0),
        riskLevel,
        autoApprovalEligible,
        reasoning,
    };
}

function calculateConfidence(riskFactors: RiskFactors): number {
    let confidence = 82;

    if (riskFactors.requesterTrustScore > 70) {
        confidence += 8;
    }
    if (riskFactors.unusualPatterns) {
        confidence -= 12;
    }
    if (riskFactors.complianceFlags.length > 0) {
        confidence -= Math.min(12, riskFactors.complianceFlags.length * 4);
    }
    if (riskFactors.budgetUtilization >= 90) {
        confidence -= 6;
    }

    return Math.max(50, Math.min(100, confidence));
}

export async function processAutoApprovals(): Promise<AgentResult<{
    processed: number;
    approved: number;
    skipped: number;
}>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
        };
    }

    try {
        const pendingReqs = await db.select()
            .from(requisitions)
            .where(eq(requisitions.status, "pending_approval"))
            .limit(50);

        let approved = 0;
        let skipped = 0;

        for (const req of pendingReqs) {
            const routeResult = await calculateApprovalRoute(req.id);

            if (routeResult.success && routeResult.data?.autoApprovalEligible) {
                await db.update(requisitions)
                    .set({ status: "approved" })
                    .where(eq(requisitions.id, req.id));

                await createNotification({
                    userId: req.requestedById,
                    title: "Requisition Auto-Approved",
                    message: `Your requisition "${req.title}" has been automatically approved.`,
                    type: "success",
                    link: "/sourcing/requisitions",
                });

                await db.insert(auditLogs).values({
                    userId: session.user.id,
                    action: "AUTO_APPROVE",
                    entityType: "requisition",
                    entityId: req.id,
                    details: JSON.stringify({
                        agent: "smart-approval-routing",
                        reasoning: routeResult.data.reasoning,
                    }),
                });

                approved += 1;
            } else {
                skipped += 1;
            }
        }

        await TelemetryService.trackMetric("SmartApprovalRouting", "auto_approvals", approved);

        return {
            success: true,
            data: {
                processed: pendingReqs.length,
                approved,
                skipped,
            },
            confidence: 95,
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
            reasoning: `Processed ${pendingReqs.length} pending requisitions. Auto-approved ${approved}, skipped ${skipped}.`,
        };
    } catch (error) {
        console.error("Auto Approval Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Auto approval failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "smart-approval-routing",
            timestamp: new Date(),
        };
    }
}

function classifyApprovalStage(amount: number) {
    if (amount >= APPROVAL_THRESHOLDS.dualApprover) {
        return "Executive Review";
    }
    if (amount >= APPROVAL_THRESHOLDS.singleApprover) {
        return "Finance Review";
    }
    return "Sourcing Review";
}

export async function getApprovalRoutingAnalytics(): Promise<{
    avgApprovalTime: number;
    autoApprovalRate: number;
    bottleneckStages: { stage: string; avgDelay: number }[];
    volumeByRiskLevel: { level: string; count: number }[];
}> {
    const session = await auth();
    if (!session?.user) {
        return {
            avgApprovalTime: 0,
            autoApprovalRate: 0,
            bottleneckStages: [],
            volumeByRiskLevel: [],
        };
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [recentRequisitions, conversionRows, autoApprovalRows] = await Promise.all([
        db.select({
            id: requisitions.id,
            status: requisitions.status,
            estimatedAmount: requisitions.estimatedAmount,
            createdAt: requisitions.createdAt,
        })
            .from(requisitions)
            .where(gte(requisitions.createdAt, ninetyDaysAgo))
            .limit(500),
        db.select({
            requisitionCreatedAt: requisitions.createdAt,
            orderCreatedAt: procurementOrders.createdAt,
        })
            .from(procurementOrders)
            .innerJoin(requisitions, eq(procurementOrders.requisitionId, requisitions.id))
            .where(gte(requisitions.createdAt, ninetyDaysAgo))
            .limit(500),
        db.select({
            count: auditLogs.id,
        })
            .from(auditLogs)
            .where(and(
                eq(auditLogs.entityType, "requisition"),
                eq(auditLogs.action, "AUTO_APPROVE"),
                gte(auditLogs.createdAt, ninetyDaysAgo),
            ))
            .limit(500),
    ]);

    const convertedCount = recentRequisitions.filter((row) => row.status === "approved" || row.status === "converted_to_po").length;
    const avgApprovalTime = conversionRows.length > 0
        ? Math.round((conversionRows.reduce((sum, row) => {
            const start = row.requisitionCreatedAt?.getTime() || 0;
            const end = row.orderCreatedAt?.getTime() || start;
            return sum + ((end - start) / (1000 * 60 * 60));
        }, 0) / conversionRows.length) * 10) / 10
        : 0;
    const autoApprovalRate = convertedCount > 0
        ? Math.round((autoApprovalRows.length / convertedCount) * 100)
        : 0;

    const bottleneckMap = new Map<string, number[]>();
    for (const req of recentRequisitions.filter((row) => row.status === "pending_approval")) {
        const stage = classifyApprovalStage(toNumber(req.estimatedAmount));
        const ageHours = req.createdAt
            ? (Date.now() - req.createdAt.getTime()) / (1000 * 60 * 60)
            : 0;
        const existing = bottleneckMap.get(stage) || [];
        existing.push(ageHours);
        bottleneckMap.set(stage, existing);
    }

    const bottleneckStages = Array.from(bottleneckMap.entries())
        .map(([stage, delays]) => ({
            stage,
            avgDelay: Math.round((delays.reduce((sum, value) => sum + value, 0) / Math.max(delays.length, 1)) * 10) / 10,
        }))
        .sort((left, right) => right.avgDelay - left.avgDelay);

    const riskBuckets = new Map<string, number>();
    for (const req of recentRequisitions) {
        const level = classifyRiskLevel(toNumber(req.estimatedAmount));
        riskBuckets.set(level, (riskBuckets.get(level) || 0) + 1);
    }

    const volumeByRiskLevel = ["low", "medium", "high", "critical"].map((level) => ({
        level,
        count: riskBuckets.get(level) || 0,
    }));

    return {
        avgApprovalTime,
        autoApprovalRate,
        bottleneckStages,
        volumeByRiskLevel,
    };
}
