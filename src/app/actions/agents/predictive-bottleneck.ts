/**
 * Predictive Bottleneck Alerts Agent
 * Identifies workflow delays and predicts processing bottlenecks
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    requisitions, procurementOrders, rfqs, contracts,
    users, agentRecommendations
} from "@/db/schema";
import { eq, sql, desc, and, gte, lte, lt } from "drizzle-orm";
import { TelemetryService } from "@/lib/telemetry";
import { createNotification } from "@/app/actions/notifications";
import type { AgentResult } from "@/lib/ai/agent-types";

interface WorkflowBottleneck {
    workflowType: 'requisition' | 'order' | 'rfq' | 'contract';
    entityId: string;
    entityTitle: string;
    currentStage: string;
    stuckDuration: number;  // hours
    normalDuration: number; // expected hours
    delayRatio: number;     // stuckDuration / normalDuration
    severity: 'warning' | 'critical' | 'overdue';
    assignedTo?: string;
    suggestedAction: string;
    predictedResolutionTime?: number;
}

// Stage SLA thresholds (in hours)
const STAGE_SLAS: Record<string, Record<string, number>> = {
    requisition: {
        'draft': 24,
        'pending_approval': 48,
        'approved': 24
    },
    order: {
        'draft': 24,
        'pending_approval': 48,
        'approved': 24,
        'sent': 168 // 7 days for fulfillment
    },
    rfq: {
        'draft': 48,
        'open': 168 // 7 days
    },
    contract: {
        'draft': 72,
        'pending_renewal': 336 // 14 days
    }
};

/**
 * Scan all workflows for bottlenecks
 */
export async function detectBottlenecks(): Promise<AgentResult<WorkflowBottleneck[]>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "predictive-bottleneck",
            timestamp: new Date()
        };
    }

    try {
        const bottlenecks: WorkflowBottleneck[] = [];

        // Check requisitions
        const reqBottlenecks = await detectRequisitionBottlenecks();
        bottlenecks.push(...reqBottlenecks);

        // Check orders
        const orderBottlenecks = await detectOrderBottlenecks();
        bottlenecks.push(...orderBottlenecks);

        // Check RFQs
        const rfqBottlenecks = await detectRfqBottlenecks();
        bottlenecks.push(...rfqBottlenecks);

        // Check contracts
        const contractBottlenecks = await detectContractBottlenecks();
        bottlenecks.push(...contractBottlenecks);

        // Sort by severity
        const severityOrder = { overdue: 0, critical: 1, warning: 2 };
        bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        // Store critical alerts as recommendations
        for (const bottleneck of bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'overdue')) {
            await db.insert(agentRecommendations).values({
                agentName: 'predictive-bottleneck',
                recommendationType: 'workflow_delay',
                title: `${bottleneck.severity.toUpperCase()}: ${bottleneck.workflowType} stuck for ${Math.round(bottleneck.stuckDuration)}h`,
                description: bottleneck.suggestedAction,
                impact: bottleneck.severity === 'overdue' ? 'critical' : 'high',
                actionPayload: JSON.stringify({
                    workflowType: bottleneck.workflowType,
                    entityId: bottleneck.entityId,
                    currentStage: bottleneck.currentStage
                })
            });

            // Notify relevant users
            if (bottleneck.assignedTo) {
                await createNotification({
                    userId: bottleneck.assignedTo,
                    title: `⚠️ ${bottleneck.workflowType} Delayed`,
                    message: `"${bottleneck.entityTitle}" has been in ${bottleneck.currentStage} for ${Math.round(bottleneck.stuckDuration)} hours.`,
                    type: bottleneck.severity === 'overdue' ? 'error' : 'warning',
                    link: `/${bottleneck.workflowType}s`
                });
            }
        }

        await TelemetryService.trackMetric(
            "PredictiveBottleneck",
            "bottlenecks_detected",
            bottlenecks.length
        );

        return {
            success: true,
            data: bottlenecks,
            confidence: 90,
            executionTimeMs: Date.now() - startTime,
            agentName: "predictive-bottleneck",
            timestamp: new Date(),
            reasoning: `Scanned 4 workflow types. Found ${bottlenecks.length} bottlenecks: ${bottlenecks.filter(b => b.severity === 'overdue').length} overdue, ${bottlenecks.filter(b => b.severity === 'critical').length} critical.`,
            sources: ["requisitions", "orders", "rfqs", "contracts"]
        };

    } catch (error) {
        console.error("Bottleneck Detection Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Detection failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "predictive-bottleneck",
            timestamp: new Date()
        };
    }
}

async function detectRequisitionBottlenecks(): Promise<WorkflowBottleneck[]> {
    const bottlenecks: WorkflowBottleneck[] = [];

    const stuckReqs = await db
        .select({
            id: requisitions.id,
            title: requisitions.title,
            status: requisitions.status,
            createdAt: requisitions.createdAt,
            requestedById: requisitions.requestedById
        })
        .from(requisitions)
        .where(
            and(
                sql`${requisitions.status} IN ('draft', 'pending_approval')`,
                lt(requisitions.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
            )
        );

    for (const req of stuckReqs) {
        const hoursStuck = (Date.now() - new Date(req.createdAt!).getTime()) / (1000 * 60 * 60);
        const sla = STAGE_SLAS.requisition[req.status!] || 48;
        const delayRatio = hoursStuck / sla;

        if (delayRatio > 0.75) {
            let severity: 'warning' | 'critical' | 'overdue' = 'warning';
            if (delayRatio > 2) severity = 'overdue';
            else if (delayRatio > 1) severity = 'critical';

            bottlenecks.push({
                workflowType: 'requisition',
                entityId: req.id,
                entityTitle: req.title,
                currentStage: req.status!,
                stuckDuration: hoursStuck,
                normalDuration: sla,
                delayRatio,
                severity,
                assignedTo: req.requestedById,
                suggestedAction: req.status === 'draft'
                    ? 'Submit requisition for approval or save as draft for later'
                    : 'Escalate to department manager for approval'
            });
        }
    }

    return bottlenecks;
}

async function detectOrderBottlenecks(): Promise<WorkflowBottleneck[]> {
    const bottlenecks: WorkflowBottleneck[] = [];

    const stuckOrders = await db
        .select({
            id: procurementOrders.id,
            status: procurementOrders.status,
            createdAt: procurementOrders.createdAt,
            supplierId: procurementOrders.supplierId
        })
        .from(procurementOrders)
        .where(
            and(
                sql`${procurementOrders.status} IN ('draft', 'pending_approval', 'sent')`,
                lt(procurementOrders.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
            )
        );

    for (const order of stuckOrders) {
        const hoursStuck = (Date.now() - new Date(order.createdAt!).getTime()) / (1000 * 60 * 60);
        const sla = STAGE_SLAS.order[order.status!] || 48;
        const delayRatio = hoursStuck / sla;

        if (delayRatio > 0.75) {
            let severity: 'warning' | 'critical' | 'overdue' = 'warning';
            if (delayRatio > 2) severity = 'overdue';
            else if (delayRatio > 1) severity = 'critical';

            let suggestedAction = 'Review and progress order';
            if (order.status === 'sent') {
                suggestedAction = 'Follow up with supplier on order fulfillment status';
            } else if (order.status === 'pending_approval') {
                suggestedAction = 'Escalate to approver for immediate review';
            }

            bottlenecks.push({
                workflowType: 'order',
                entityId: order.id,
                entityTitle: `PO-${order.id.slice(0, 8)}`,
                currentStage: order.status!,
                stuckDuration: hoursStuck,
                normalDuration: sla,
                delayRatio,
                severity,
                suggestedAction
            });
        }
    }

    return bottlenecks;
}

async function detectRfqBottlenecks(): Promise<WorkflowBottleneck[]> {
    const bottlenecks: WorkflowBottleneck[] = [];

    const stuckRfqs = await db
        .select({
            id: rfqs.id,
            title: rfqs.title,
            status: rfqs.status,
            createdAt: rfqs.createdAt
        })
        .from(rfqs)
        .where(
            and(
                sql`${rfqs.status} IN ('draft', 'open')`,
                lt(rfqs.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000))
            )
        );

    for (const rfq of stuckRfqs) {
        const hoursStuck = (Date.now() - new Date(rfq.createdAt!).getTime()) / (1000 * 60 * 60);
        const sla = STAGE_SLAS.rfq[rfq.status!] || 72;
        const delayRatio = hoursStuck / sla;

        if (delayRatio > 0.75) {
            let severity: 'warning' | 'critical' | 'overdue' = 'warning';
            if (delayRatio > 2) severity = 'overdue';
            else if (delayRatio > 1) severity = 'critical';

            bottlenecks.push({
                workflowType: 'rfq',
                entityId: rfq.id,
                entityTitle: rfq.title,
                currentStage: rfq.status!,
                stuckDuration: hoursStuck,
                normalDuration: sla,
                delayRatio,
                severity,
                suggestedAction: rfq.status === 'draft'
                    ? 'Finalize and publish RFQ to suppliers'
                    : 'Follow up with invited suppliers for quotes'
            });
        }
    }

    return bottlenecks;
}

async function detectContractBottlenecks(): Promise<WorkflowBottleneck[]> {
    const bottlenecks: WorkflowBottleneck[] = [];

    // Check contracts pending renewal
    const expiringContracts = await db
        .select({
            id: contracts.id,
            title: contracts.title,
            status: contracts.status,
            validTo: contracts.validTo,
            noticePeriod: contracts.noticePeriod,
            renewalStatus: contracts.renewalStatus
        })
        .from(contracts)
        .where(eq(contracts.status, 'pending_renewal'));

    for (const contract of expiringContracts) {
        if (!contract.validTo) continue;

        const daysUntilExpiry = (new Date(contract.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        const noticePeriod = contract.noticePeriod || 30;

        let severity: 'warning' | 'critical' | 'overdue' = 'warning';
        if (daysUntilExpiry < 0) severity = 'overdue';
        else if (daysUntilExpiry < noticePeriod) severity = 'critical';
        else if (daysUntilExpiry < noticePeriod * 2) severity = 'warning';
        else continue; // Not yet a bottleneck

        bottlenecks.push({
            workflowType: 'contract',
            entityId: contract.id,
            entityTitle: contract.title,
            currentStage: 'pending_renewal',
            stuckDuration: daysUntilExpiry < 0 ? Math.abs(daysUntilExpiry) * 24 : 0,
            normalDuration: noticePeriod * 24,
            delayRatio: 1,
            severity,
            suggestedAction: daysUntilExpiry < 0
                ? 'Contract has expired! Initiate emergency renewal or replacement'
                : `Contact supplier for renewal terms. ${Math.round(daysUntilExpiry)} days until expiry.`
        });
    }

    return bottlenecks;
}

/**
 * Get bottleneck analytics for dashboard
 */
export async function getBottleneckAnalytics(): Promise<{
    totalActive: number;
    bySeverity: { severity: string; count: number }[];
    byWorkflow: { workflow: string; count: number }[];
    avgResolutionTime: number;
}> {
    const session = await auth();
    if (!session?.user) {
        return { totalActive: 0, bySeverity: [], byWorkflow: [], avgResolutionTime: 0 };
    }

    const result = await detectBottlenecks();
    if (!result.success || !result.data) {
        return { totalActive: 0, bySeverity: [], byWorkflow: [], avgResolutionTime: 0 };
    }

    const bottlenecks = result.data;

    // Group by severity
    const severityCounts = new Map<string, number>();
    const workflowCounts = new Map<string, number>();

    for (const b of bottlenecks) {
        severityCounts.set(b.severity, (severityCounts.get(b.severity) || 0) + 1);
        workflowCounts.set(b.workflowType, (workflowCounts.get(b.workflowType) || 0) + 1);
    }

    return {
        totalActive: bottlenecks.length,
        bySeverity: Array.from(severityCounts.entries()).map(([severity, count]) => ({ severity, count })),
        byWorkflow: Array.from(workflowCounts.entries()).map(([workflow, count]) => ({ workflow, count })),
        avgResolutionTime: bottlenecks.length > 0
            ? bottlenecks.reduce((sum, b) => sum + b.stuckDuration, 0) / bottlenecks.length
            : 0
    };
}
