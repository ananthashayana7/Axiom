/**
 * Fraud Detection Agent
 * AI-powered anomaly detection across procurement transactions
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    invoices,
    procurementOrders,
    orderItems,
    suppliers,
    users,
    auditLogs,
    fraudAlerts
} from "@/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { TelemetryService } from "@/lib/telemetry";
import { createNotification } from "@/app/actions/notifications";
import type { AgentResult, FraudAlert } from "@/lib/ai/agent-types";

/**
 * Main fraud detection function
 * Scans recent transactions for anomalies
 */
export async function runFraudDetectionAgent(
    lookbackDays: number = 30
): Promise<AgentResult<FraudAlert[]>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "fraud-detection",
            timestamp: new Date()
        };
    }

    try {
        const alerts: FraudAlert[] = [];
        const lookbackDate = new Date();
        lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

        // Run all detection checks
        const [
            duplicateInvoices,
            zeroValueOrders,
            unusualAmounts,
            newVendorHighValue,
            roundNumberPatterns,
            segregationViolations
        ] = await Promise.all([
            detectDuplicateInvoices(lookbackDate),
            detectZeroValueOrders(lookbackDate),
            detectUnusualAmounts(lookbackDate),
            detectNewVendorHighValue(lookbackDate),
            detectRoundNumberPatterns(lookbackDate),
            detectSegregationViolations(lookbackDate)
        ]);

        alerts.push(...duplicateInvoices);
        alerts.push(...zeroValueOrders);
        alerts.push(...unusualAmounts);
        alerts.push(...newVendorHighValue);
        alerts.push(...roundNumberPatterns);
        alerts.push(...segregationViolations);

        // Store alerts in database and notify admins for critical ones
        for (const alert of alerts) {
            try {
                await db.insert(fraudAlerts).values({
                    entityType: alert.entityType,
                    entityId: alert.entityId,
                    alertType: alert.alertType,
                    severity: alert.severity,
                    description: alert.description,
                    indicators: JSON.stringify(alert.indicators),
                    suggestedAction: alert.suggestedAction,
                    falsePositiveProbability: alert.falsePositiveProbability.toString()
                });

                // Notify admins for high/critical alerts
                if (alert.severity === 'high' || alert.severity === 'critical') {
                    const adminUsers = await db
                        .select({ id: users.id })
                        .from(users)
                        .where(eq(users.role, 'admin'))
                        .limit(5);

                    for (const admin of adminUsers) {
                        try {
                            await createNotification({
                                userId: admin.id,
                                title: `🚨 ${alert.severity.toUpperCase()} Fraud Alert`,
                                message: alert.description,
                                type: alert.severity === 'critical' ? 'error' : 'warning',
                                link: `/admin/fraud-alerts`
                            });
                        } catch (notifError) {
                            console.error(`Failed to notify admin ${admin.id} for fraud alert:`, notifError);
                        }
                    }
                }
            } catch (alertError) {
                console.error(`Failed to store fraud alert (${alert.alertType}):`, alertError);
            }
        }

        await TelemetryService.trackMetric(
            "FraudDetectionAgent",
            "alerts_generated",
            alerts.length
        );

        // Calculate overall confidence based on false positive probabilities
        const avgConfidence = alerts.length > 0
            ? alerts.reduce((sum, a) => sum + (100 - a.falsePositiveProbability), 0) / alerts.length
            : 95;

        return {
            success: true,
            data: alerts,
            confidence: Math.round(avgConfidence),
            executionTimeMs: Date.now() - startTime,
            agentName: "fraud-detection",
            timestamp: new Date(),
            reasoning: `Scanned ${lookbackDays} days of transactions. Found ${alerts.length} potential anomalies.`,
            sources: ["invoices", "orders", "audit_logs", "suppliers"]
        };

    } catch (error) {
        console.error("Fraud Detection Error:", error);
        await TelemetryService.trackError(
            "FraudDetectionAgent",
            "detection_failed",
            error instanceof Error ? error : new Error(String(error))
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Fraud detection failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "fraud-detection",
            timestamp: new Date()
        };
    }
}

/**
 * Detect duplicate invoices (same invoice number or similar amounts)
 */
async function detectDuplicateInvoices(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        // Check for exact duplicate invoice numbers
        const duplicates = await db
            .select({
                invoiceNumber: invoices.invoiceNumber,
                count: sql<number>`COUNT(*)::int`,
                totalAmount: sql<number>`SUM(${invoices.amount}::numeric)`,
                firstId: sql<string>`MIN(${invoices.id}::text)`,
                supplierIds: sql<string[]>`ARRAY_AGG(DISTINCT ${invoices.supplierId}::text)`
            })
            .from(invoices)
            .where(gte(invoices.createdAt, since))
            .groupBy(invoices.invoiceNumber)
            .having(sql`COUNT(*) > 1`);

        for (const dup of duplicates) {
            alerts.push({
                entityType: 'invoice',
                entityId: dup.firstId,
                alertType: 'duplicate_invoice',
                severity: dup.count > 2 ? 'critical' : 'high',
                description: `Duplicate invoice number "${dup.invoiceNumber}" found ${dup.count} times. Total value: ₹${Number(dup.totalAmount).toLocaleString()}`,
                indicators: [
                    `${dup.count} invoices with same number`,
                    `Total combined value: ₹${Number(dup.totalAmount).toLocaleString()}`,
                    dup.supplierIds.length > 1 ? `Multiple suppliers involved` : `Single supplier`
                ],
                suggestedAction: "Review all invoices with this number and verify legitimacy with suppliers",
                falsePositiveProbability: 10 // Duplicate invoice numbers are highly suspicious
            });
        }

        // Check for very similar amounts from same supplier on same day
        const similarAmounts = await db
            .select({
                supplierId: invoices.supplierId,
                amount: invoices.amount,
                invoiceDate: sql<string>`DATE(${invoices.createdAt})`,
                count: sql<number>`COUNT(*)::int`,
                ids: sql<string[]>`ARRAY_AGG(${invoices.id}::text)`
            })
            .from(invoices)
            .where(gte(invoices.createdAt, since))
            .groupBy(invoices.supplierId, invoices.amount, sql`DATE(${invoices.createdAt})`)
            .having(sql`COUNT(*) > 1`);

        for (const sim of similarAmounts) {
            alerts.push({
                entityType: 'invoice',
                entityId: sim.ids[0],
                alertType: 'duplicate_invoice',
                severity: 'medium',
                description: `${sim.count} invoices with identical amount ₹${Number(sim.amount).toLocaleString()} from same supplier on ${sim.invoiceDate}`,
                indicators: [
                    `Exact same amount: ₹${Number(sim.amount).toLocaleString()}`,
                    `Same supplier, same day`,
                    `${sim.count} invoices affected`
                ],
                suggestedAction: "Verify these are distinct legitimate transactions",
                falsePositiveProbability: 35 // Could be legitimate batch processing
            });
        }
    } catch (error) {
        console.warn("Duplicate invoice detection error:", error);
    }

    return alerts;
}

/**
 * Detect suspicious orders created with zero or missing value.
 */
async function detectZeroValueOrders(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        const orders = await db
            .select({
                id: procurementOrders.id,
                supplierId: procurementOrders.supplierId,
                supplierName: suppliers.name,
                amount: procurementOrders.totalAmount,
                status: procurementOrders.status,
                createdAt: procurementOrders.createdAt,
                itemCount: sql<number>`COUNT(${orderItems.id})::int`,
                itemValue: sql<number>`COALESCE(SUM(${orderItems.quantity} * ${orderItems.unitPrice}::numeric), 0)::numeric`
            })
            .from(procurementOrders)
            .leftJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .leftJoin(orderItems, eq(orderItems.orderId, procurementOrders.id))
            .where(gte(procurementOrders.createdAt, since))
            .groupBy(
                procurementOrders.id,
                procurementOrders.supplierId,
                suppliers.name,
                procurementOrders.totalAmount,
                procurementOrders.status,
                procurementOrders.createdAt
            )
            .having(sql`COALESCE(${procurementOrders.totalAmount}::numeric, 0) <= 0`);

        for (const order of orders) {
            const itemValue = Number(order.itemValue || 0);
            const itemCount = Number(order.itemCount || 0);
            const status = order.status || 'draft';

            alerts.push({
                entityType: 'order',
                entityId: order.id,
                alertType: 'zero_value_order',
                severity: status === 'sent' || status === 'fulfilled' || itemValue > 0 ? 'high' : 'medium',
                description: `Order ${order.id.slice(0, 8).toUpperCase()} for ${order.supplierName || 'unknown supplier'} was created with zero value`,
                indicators: [
                    `Recorded order total: ₹${Number(order.amount || 0).toLocaleString()}`,
                    `Order status: ${status}`,
                    `${itemCount} line items linked`,
                    `Computed line-item value: ₹${itemValue.toLocaleString()}`
                ],
                suggestedAction: itemValue > 0
                    ? 'Recalculate the order header total from its line items and review downstream financial matching.'
                    : 'Review the source RFQ or manual order entry. Orders should not be approved or sent with zero total value.',
                falsePositiveProbability: itemValue > 0 ? 10 : 15
            });
        }
    } catch (error) {
        console.warn("Zero-value order detection error:", error);
    }

    return alerts;
}

/**
 * Detect unusually high amounts compared to historical averages
 */
async function detectUnusualAmounts(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        // Get supplier average order amounts
        const supplierStats = await db
            .select({
                supplierId: procurementOrders.supplierId,
                supplierName: suppliers.name,
                avgAmount: sql<number>`AVG(${procurementOrders.totalAmount}::numeric)`,
                stdDev: sql<number>`STDDEV(${procurementOrders.totalAmount}::numeric)`,
                maxHistorical: sql<number>`MAX(${procurementOrders.totalAmount}::numeric)`
            })
            .from(procurementOrders)
            .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
            .groupBy(procurementOrders.supplierId, suppliers.name)
            .having(sql`COUNT(*) >= 3`); // Need enough data

        // Check recent orders against historical patterns
        const recentOrders = await db
            .select({
                id: procurementOrders.id,
                supplierId: procurementOrders.supplierId,
                amount: procurementOrders.totalAmount,
                createdAt: procurementOrders.createdAt
            })
            .from(procurementOrders)
            .where(gte(procurementOrders.createdAt, since));

        const statsMap = new Map(supplierStats.map(s => [s.supplierId, s]));

        for (const order of recentOrders) {
            const stats = statsMap.get(order.supplierId);
            if (!stats || !stats.stdDev) continue;

            const amount = Number(order.amount);
            const zScore = (amount - Number(stats.avgAmount)) / Number(stats.stdDev);

            // Flag if amount is more than 3 standard deviations above mean
            if (zScore > 3) {
                const severity = zScore > 5 ? 'critical' : zScore > 4 ? 'high' : 'medium';
                alerts.push({
                    entityType: 'order',
                    entityId: order.id,
                    alertType: 'unusual_amount',
                    severity,
                    description: `Order amount ₹${amount.toLocaleString()} is ${zScore.toFixed(1)}x standard deviations above average for ${stats.supplierName}`,
                    indicators: [
                        `Order amount: ₹${amount.toLocaleString()}`,
                        `Historical average: ₹${Number(stats.avgAmount).toLocaleString()}`,
                        `This is ${(amount / Number(stats.avgAmount)).toFixed(1)}x the typical amount`,
                        `Historical maximum: ₹${Number(stats.maxHistorical).toLocaleString()}`
                    ],
                    suggestedAction: "Verify order details and approval chain. Consider requiring additional approval.",
                    falsePositiveProbability: Math.max(5, 40 - (zScore * 5))
                });
            }
        }
    } catch (error) {
        console.warn("Unusual amount detection error:", error);
    }

    return alerts;
}

/**
 * Detect high-value transactions with new vendors
 */
async function detectNewVendorHighValue(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        // Find suppliers added in last 60 days with high-value orders
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const newVendorHighValue = await db
            .select({
                supplierId: suppliers.id,
                supplierName: suppliers.name,
                supplierCreatedAt: suppliers.createdAt,
                totalOrders: sql<number>`COUNT(${procurementOrders.id})::int`,
                totalValue: sql<number>`SUM(${procurementOrders.totalAmount}::numeric)`,
                maxOrder: sql<number>`MAX(${procurementOrders.totalAmount}::numeric)`
            })
            .from(suppliers)
            .innerJoin(procurementOrders, eq(suppliers.id, procurementOrders.supplierId))
            .where(
                and(
                    gte(suppliers.createdAt, sixtyDaysAgo),
                    gte(procurementOrders.createdAt, since)
                )
            )
            .groupBy(suppliers.id, suppliers.name, suppliers.createdAt)
            .having(sql`SUM(${procurementOrders.totalAmount}::numeric) > 500000`); // > ₹5L threshold

        for (const vendor of newVendorHighValue) {
            const daysSinceOnboarding = Math.floor(
                (Date.now() - new Date(vendor.supplierCreatedAt!).getTime()) / (1000 * 60 * 60 * 24)
            );

            let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
            if (Number(vendor.totalValue) > 2000000 && daysSinceOnboarding < 14) {
                severity = 'critical';
            } else if (Number(vendor.totalValue) > 1000000 || daysSinceOnboarding < 14) {
                severity = 'high';
            }

            alerts.push({
                entityType: 'supplier',
                entityId: vendor.supplierId,
                alertType: 'new_vendor_high_value',
                severity,
                description: `New vendor "${vendor.supplierName}" (${daysSinceOnboarding} days old) has ₹${Number(vendor.totalValue).toLocaleString()} in orders`,
                indicators: [
                    `Vendor age: ${daysSinceOnboarding} days`,
                    `Total order value: ₹${Number(vendor.totalValue).toLocaleString()}`,
                    `Number of orders: ${vendor.totalOrders}`,
                    `Largest single order: ₹${Number(vendor.maxOrder).toLocaleString()}`
                ],
                suggestedAction: "Conduct enhanced due diligence on this new vendor. Verify business registration and references.",
                falsePositiveProbability: daysSinceOnboarding < 14 ? 15 : 35
            });
        }
    } catch (error) {
        console.warn("New vendor high value detection error:", error);
    }

    return alerts;
}

/**
 * Detect round number patterns (potential manipulation)
 */
async function detectRoundNumberPatterns(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        // Find suppliers with unusually high proportion of round-number invoices
        const roundNumberStats = await db
            .select({
                supplierId: invoices.supplierId,
                supplierName: suppliers.name,
                totalInvoices: sql<number>`COUNT(*)::int`,
                roundInvoices: sql<number>`SUM(CASE WHEN CAST(${invoices.amount} AS NUMERIC) % 1000 = 0 THEN 1 ELSE 0 END)::int`,
                totalValue: sql<number>`SUM(${invoices.amount}::numeric)`
            })
            .from(invoices)
            .innerJoin(suppliers, eq(invoices.supplierId, suppliers.id))
            .where(gte(invoices.createdAt, since))
            .groupBy(invoices.supplierId, suppliers.name)
            .having(sql`COUNT(*) >= 5`); // Need enough samples

        for (const stat of roundNumberStats) {
            const roundProportion = stat.roundInvoices / stat.totalInvoices;

            // Flag if more than 70% of invoices are round numbers
            if (roundProportion > 0.7 && stat.roundInvoices >= 4) {
                alerts.push({
                    entityType: 'supplier',
                    entityId: stat.supplierId,
                    alertType: 'round_number_pattern',
                    severity: roundProportion > 0.9 ? 'high' : 'medium',
                    description: `${Math.round(roundProportion * 100)}% of invoices from "${stat.supplierName}" are round numbers`,
                    indicators: [
                        `${stat.roundInvoices} of ${stat.totalInvoices} invoices are round numbers`,
                        `Total invoiced: ₹${Number(stat.totalValue).toLocaleString()}`,
                        `This pattern may indicate estimated/fabricated invoices`
                    ],
                    suggestedAction: "Request detailed breakdowns and supporting documentation for recent invoices",
                    falsePositiveProbability: 45 // Some industries naturally have round pricing
                });
            }
        }
    } catch (error) {
        console.warn("Round number pattern detection error:", error);
    }

    return alerts;
}

/**
 * Detect segregation of duties violations
 */
async function detectSegregationViolations(since: Date): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = [];

    try {
        // Find users who both created and approved their own items
        const violations = await db
            .select({
                userId: auditLogs.userId,
                userName: users.name,
                entityType: auditLogs.entityType,
                entityId: auditLogs.entityId,
                actions: sql<string[]>`ARRAY_AGG(DISTINCT ${auditLogs.action})`
            })
            .from(auditLogs)
            .innerJoin(users, eq(auditLogs.userId, users.id))
            .where(
                and(
                    gte(auditLogs.createdAt, since),
                    sql`${auditLogs.action} IN ('CREATE', 'APPROVE')`
                )
            )
            .groupBy(auditLogs.userId, users.name, auditLogs.entityType, auditLogs.entityId)
            .having(sql`COUNT(DISTINCT ${auditLogs.action}) > 1`);

        for (const violation of violations) {
            if (violation.actions.includes('CREATE') && violation.actions.includes('APPROVE')) {
                alerts.push({
                    entityType: violation.entityType as 'invoice' | 'order' | 'supplier' | 'user',
                    entityId: violation.entityId,
                    alertType: 'segregation_violation',
                    severity: 'high',
                    description: `User "${violation.userName}" both created and approved ${violation.entityType} ${violation.entityId.slice(0, 8)}`,
                    indicators: [
                        `Actions performed: ${violation.actions.join(', ')}`,
                        `Same user for creation and approval`,
                        `Violates segregation of duties principle`
                    ],
                    suggestedAction: "Review this transaction. Consider implementing system controls to prevent self-approval.",
                    falsePositiveProbability: 5 // This is a clear policy violation
                });
            }
        }
    } catch (error) {
        console.warn("Segregation violation detection error:", error);
    }

    return alerts;
}

/**
 * Get all open fraud alerts for review
 */
export async function getOpenFraudAlerts(): Promise<{
    id: string;
    entityType: string;
    entityId: string;
    alertType: string;
    severity: string;
    description: string;
    indicators: string[];
    suggestedAction: string | null;
    createdAt: Date | null;
}[]> {
    const session = await auth();
    if (!session?.user || (session.user as { role: string }).role !== 'admin') {
        return [];
    }

    try {
        const alerts = await db
            .select()
            .from(fraudAlerts)
            .where(eq(fraudAlerts.status, 'open'))
            .orderBy(desc(fraudAlerts.createdAt))
            .limit(100);

        return alerts.map(alert => ({
            id: alert.id,
            entityType: alert.entityType,
            entityId: alert.entityId,
            alertType: alert.alertType,
            severity: alert.severity || 'medium',
            description: alert.description,
            indicators: alert.indicators ? JSON.parse(alert.indicators) : [],
            suggestedAction: alert.suggestedAction,
            createdAt: alert.createdAt
        }));
    } catch (error) {
        console.error("Failed to fetch fraud alerts:", error);
        return [];
    }
}

/**
 * Resolve a fraud alert
 */
export async function resolveFraudAlert(
    alertId: string,
    resolution: 'confirmed_fraud' | 'false_positive' | 'investigated'
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user || (session.user as { role: string }).role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db
            .update(fraudAlerts)
            .set({
                status: resolution,
                resolvedBy: (session.user as { id: string }).id,
                resolvedAt: new Date()
            })
            .where(eq(fraudAlerts.id, alertId));

        await TelemetryService.trackEvent("FraudAlert", "resolved", {
            alertId,
            resolution
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to resolve fraud alert:", error);
        return { success: false, error: "Failed to resolve alert" };
    }
}
