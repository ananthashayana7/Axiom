'use server';

import { auth } from "@/auth";
import { db } from "@/db";
import {
    goodsReceipts,
    invoices,
    orderItems,
    platformSettings,
    procurementOrders,
    suppliers,
    systemTelemetry,
} from "@/db/schema";
import { calculateThreeWayMatchStatus, getThreeWayMatchReasonLabel } from "@/lib/utils/three-way-match";
import {
    FX_RATE_STALE_HOURS,
    RECEIPT_REVIEW_SLA_HOURS,
    SUPPLIER_RELEASE_RISK_THRESHOLD,
    TELEMETRY_STALE_MINUTES,
    getRiskSeverityLabel,
    getSupplierReleaseBlockReason,
} from "@/lib/sourcing-guardrails";
import { desc, eq, inArray, sql } from "drizzle-orm";

type InternalUser = {
    id?: string | null;
    role?: string | null;
};

export type OperationalExceptionSeverity = "critical" | "high" | "medium";
export type OperationalExceptionType = "supplier_block" | "receipt_quarantine" | "invoice_dispute" | "match_pending";

export type OperationalExceptionItem = {
    id: string;
    severity: OperationalExceptionSeverity;
    type: OperationalExceptionType;
    title: string;
    subtitle: string;
    reason: string;
    nextAction: string;
    ageLabel: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref?: string;
    secondaryLabel?: string;
};

export type OperationalExceptionQueue = {
    total: number;
    critical: number;
    high: number;
    medium: number;
    blockedOrders: number;
    receiptQuarantine: number;
    financeHolds: number;
    items: OperationalExceptionItem[];
};

export type OperationalSignals = {
    telemetry: {
        status: "live" | "stale" | "offline";
        title: string;
        detail: string;
    };
    fxRates: {
        status: "fresh" | "stale" | "missing";
        title: string;
        detail: string;
    };
    exceptions: {
        title: string;
        detail: string;
        total: number;
        blockedOrders: number;
        critical: number;
    };
};

function minutesBetween(date: Date) {
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function hoursBetween(date: Date) {
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 3600000));
}

function formatAge(date: Date | null | undefined) {
    if (!date) {
        return "Unknown age";
    }

    const minutes = minutesBetween(date);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 48) {
        return `${hours}h ago`;
    }

    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function severityRank(severity: OperationalExceptionSeverity) {
    switch (severity) {
        case "critical":
            return 0;
        case "high":
            return 1;
        default:
            return 2;
    }
}

async function requireInternalUser() {
    const session = await auth();
    const user = session?.user as InternalUser | undefined;

    if (!user || user.role === "supplier") {
        return null;
    }

    return user;
}

async function buildExceptionQueueSnapshot(): Promise<OperationalExceptionQueue> {
    const activeOrderRows = await db.select({
        id: procurementOrders.id,
        status: procurementOrders.status,
        totalAmount: procurementOrders.totalAmount,
        createdAt: procurementOrders.createdAt,
        supplierName: suppliers.name,
        supplierCountryCode: suppliers.countryCode,
        supplierRiskScore: suppliers.riskScore,
        supplierStatus: suppliers.status,
        supplierLifecycleStatus: suppliers.lifecycleStatus,
    })
        .from(procurementOrders)
        .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
        .orderBy(desc(procurementOrders.createdAt))
        .limit(160);

    const receiptRows = await db.select({
        id: goodsReceipts.id,
        orderId: goodsReceipts.orderId,
        receivedAt: goodsReceipts.receivedAt,
        inspectionStatus: goodsReceipts.inspectionStatus,
        notes: goodsReceipts.notes,
        inspectionNotes: goodsReceipts.inspectionNotes,
        supplierName: suppliers.name,
    })
        .from(goodsReceipts)
        .innerJoin(procurementOrders, eq(goodsReceipts.orderId, procurementOrders.id))
        .innerJoin(suppliers, eq(procurementOrders.supplierId, suppliers.id))
        .orderBy(desc(goodsReceipts.receivedAt))
        .limit(200);

    const invoiceRows = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        createdAt: invoices.createdAt,
        orderId: invoices.orderId,
        supplierName: suppliers.name,
        orderTotalAmount: procurementOrders.totalAmount,
    })
        .from(invoices)
        .leftJoin(procurementOrders, eq(invoices.orderId, procurementOrders.id))
        .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
        .orderBy(desc(invoices.createdAt))
        .limit(200);

    const linkedOrderIds = Array.from(new Set(invoiceRows
        .map((invoice) => invoice.orderId)
        .filter((orderId): orderId is string => Boolean(orderId))));

    const itemTotals = linkedOrderIds.length > 0
        ? await db.select({
            orderId: orderItems.orderId,
            total: sql<string>`COALESCE(SUM(${orderItems.quantity} * CAST(${orderItems.unitPrice} AS numeric)), 0)`,
        })
            .from(orderItems)
            .where(inArray(orderItems.orderId, linkedOrderIds))
            .groupBy(orderItems.orderId)
        : [];

    const allLinkedInvoices = linkedOrderIds.length > 0
        ? await db.select({
            orderId: invoices.orderId,
            amount: invoices.amount,
        })
            .from(invoices)
            .where(inArray(invoices.orderId, linkedOrderIds))
        : [];

    const receiptByOrder = new Map<string, Array<typeof receiptRows[number]>>();
    const qcPassedByOrder = new Map<string, boolean>();

    for (const receipt of receiptRows) {
        const existing = receiptByOrder.get(receipt.orderId) || [];
        existing.push(receipt);
        receiptByOrder.set(receipt.orderId, existing);

        if (receipt.inspectionStatus === "passed") {
            qcPassedByOrder.set(receipt.orderId, true);
        } else if (!qcPassedByOrder.has(receipt.orderId)) {
            qcPassedByOrder.set(receipt.orderId, false);
        }
    }

    const itemTotalByOrder = new Map(itemTotals.map((row) => [row.orderId, Number(row.total || 0)]));
    const invoiceAmountsByOrder = new Map<string, number[]>();
    for (const invoice of allLinkedInvoices) {
        if (!invoice.orderId) {
            continue;
        }

        const existing = invoiceAmountsByOrder.get(invoice.orderId) || [];
        existing.push(Number(invoice.amount || 0));
        invoiceAmountsByOrder.set(invoice.orderId, existing);
    }

    const items: OperationalExceptionItem[] = [];

    for (const order of activeOrderRows) {
        if (!["draft", "pending_approval", "approved", "sent"].includes(order.status || "")) {
            continue;
        }

        const releaseBlockReason = getSupplierReleaseBlockReason({
            name: order.supplierName,
            riskScore: order.supplierRiskScore,
            status: order.supplierStatus,
            lifecycleStatus: order.supplierLifecycleStatus,
        });

        if (!releaseBlockReason) {
            continue;
        }

        const riskLabel = getRiskSeverityLabel(order.supplierRiskScore);
        items.push({
            id: `order-${order.id}`,
            severity: riskLabel === "critical" ? "critical" : "high",
            type: "supplier_block",
            title: `${order.supplierName} release block`,
            subtitle: `Order ${order.id.slice(0, 8).toUpperCase()} is parked before release`,
            reason: releaseBlockReason,
            nextAction: `Review supplier risk, compliance evidence, and scenario impact before sending the PO. Release blocks start at risk ${SUPPLIER_RELEASE_RISK_THRESHOLD}.`,
            ageLabel: formatAge(order.createdAt),
            primaryHref: `/sourcing/orders/${order.id}`,
            primaryLabel: "Open order",
            secondaryHref: "/admin/risk",
            secondaryLabel: "Risk intelligence",
        });
    }

    for (const receipt of receiptRows) {
        const receiptAgeHours = receipt.receivedAt ? hoursBetween(receipt.receivedAt) : 0;
        const needsPendingReview = (!receipt.inspectionStatus || receipt.inspectionStatus === "pending") && receiptAgeHours >= RECEIPT_REVIEW_SLA_HOURS;

        if (!["failed", "conditional"].includes(receipt.inspectionStatus || "") && !needsPendingReview) {
            continue;
        }

        const severity: OperationalExceptionSeverity = receipt.inspectionStatus === "failed"
            ? "critical"
            : receipt.inspectionStatus === "conditional"
                ? "high"
                : "medium";

        const reason = receipt.inspectionStatus === "failed"
            ? "QC failed and the receipt is quarantined from downstream finance release."
            : receipt.inspectionStatus === "conditional"
                ? "QC marked the receipt as conditional, so the order cannot move cleanly into matching."
                : "A goods receipt is logged without a timely inspection outcome.";

        items.push({
            id: `receipt-${receipt.id}`,
            severity,
            type: "receipt_quarantine",
            title: `${receipt.supplierName} receipt quarantine`,
            subtitle: `Order ${receipt.orderId.slice(0, 8).toUpperCase()} is waiting on warehouse resolution`,
            reason,
            nextAction: receipt.inspectionNotes || receipt.notes || "Finalize inspection notes, disposition the receipt, and re-run the matching path.",
            ageLabel: formatAge(receipt.receivedAt),
            primaryHref: "/sourcing/goods-receipts",
            primaryLabel: "Open receipts",
            secondaryHref: `/sourcing/orders/${receipt.orderId}`,
            secondaryLabel: "View order",
        });
    }

    for (const invoice of invoiceRows) {
        if (!["pending", "disputed"].includes(invoice.status || "")) {
            continue;
        }

        const invoiceAge = formatAge(invoice.createdAt);

        if (!invoice.orderId) {
            items.push({
                id: `invoice-${invoice.id}`,
                severity: "high",
                type: "match_pending",
                title: `${invoice.supplierName || "Supplier"} invoice needs PO link`,
                subtitle: `Invoice ${invoice.invoiceNumber} is not attached to a purchase order`,
                reason: "Finance cannot run deterministic matching until the invoice is tied to a purchase order.",
                nextAction: "Attach the invoice to the right order reference before approval or payment review.",
                ageLabel: invoiceAge,
                primaryHref: "/sourcing/invoices",
                primaryLabel: "Open invoices",
            });
            continue;
        }

        const receiptGroup = receiptByOrder.get(invoice.orderId) || [];
        const matchStatus = calculateThreeWayMatchStatus({
            poAmount: Number(invoice.orderTotalAmount || 0) > 0
                ? Number(invoice.orderTotalAmount || 0)
                : Number(itemTotalByOrder.get(invoice.orderId) || 0),
            invoiceAmounts: invoiceAmountsByOrder.get(invoice.orderId) || [Number(invoice.amount || 0)],
            hasReceipt: receiptGroup.length > 0,
            qcPassed: qcPassedByOrder.get(invoice.orderId) || false,
        });

        const severity: OperationalExceptionSeverity = invoice.status === "disputed"
            ? "critical"
            : matchStatus.reason === "MISSING_RECEIPT" || matchStatus.reason === "QC_PENDING_OR_FAILED"
                ? "high"
                : "medium";

        items.push({
            id: `invoice-${invoice.id}`,
            severity,
            type: invoice.status === "disputed" ? "invoice_dispute" : "match_pending",
            title: `${invoice.supplierName || "Supplier"} finance hold`,
            subtitle: `Invoice ${invoice.invoiceNumber} is blocked before release`,
            reason: invoice.status === "disputed"
                ? "Invoice total diverges from the purchase order and payment release is blocked."
                : getThreeWayMatchReasonLabel(matchStatus.reason),
            nextAction: invoice.status === "disputed"
                ? "Resolve the PO or invoice amount difference, then re-run matching."
                : "Clear the upstream receipt or QC condition before finance release.",
            ageLabel: invoiceAge,
            primaryHref: "/sourcing/invoices",
            primaryLabel: "Open invoices",
            secondaryHref: `/sourcing/orders/${invoice.orderId}`,
            secondaryLabel: "View order",
        });
    }

    items.sort((left, right) => {
        const severityDelta = severityRank(left.severity) - severityRank(right.severity);
        if (severityDelta !== 0) {
            return severityDelta;
        }

        return left.title.localeCompare(right.title);
    });

    const critical = items.filter((item) => item.severity === "critical").length;
    const high = items.filter((item) => item.severity === "high").length;
    const medium = items.filter((item) => item.severity === "medium").length;
    const blockedOrders = items.filter((item) => item.type === "supplier_block").length;
    const receiptQuarantine = items.filter((item) => item.type === "receipt_quarantine").length;
    const financeHolds = items.filter((item) => item.type === "invoice_dispute" || item.type === "match_pending").length;

    return {
        total: items.length,
        critical,
        high,
        medium,
        blockedOrders,
        receiptQuarantine,
        financeHolds,
        items,
    };
}

export async function getExceptionQueue(): Promise<OperationalExceptionQueue> {
    const user = await requireInternalUser();
    if (!user) {
        return {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            blockedOrders: 0,
            receiptQuarantine: 0,
            financeHolds: 0,
            items: [],
        };
    }

    try {
        return await buildExceptionQueueSnapshot();
    } catch (error) {
        console.error("Failed to build exception queue:", error);
        return {
            total: 0,
            critical: 0,
            high: 0,
            medium: 0,
            blockedOrders: 0,
            receiptQuarantine: 0,
            financeHolds: 0,
            items: [],
        };
    }
}

export async function getOperationalSignals(): Promise<OperationalSignals | null> {
    const user = await requireInternalUser();
    if (!user) {
        return null;
    }

    try {
        const [latestTelemetry] = await db.select({
            createdAt: systemTelemetry.createdAt,
        })
            .from(systemTelemetry)
            .orderBy(desc(systemTelemetry.createdAt))
            .limit(1);

        const [settings] = await db.select({
            updatedAt: platformSettings.updatedAt,
            exchangeRates: platformSettings.exchangeRates,
        })
            .from(platformSettings)
            .limit(1);

        const queue = await buildExceptionQueueSnapshot();

        const telemetryStatus = !latestTelemetry?.createdAt
            ? {
                status: "offline" as const,
                title: "Telemetry heartbeat offline",
                detail: "No recent telemetry heartbeat is available, so watch coverage should be treated as incomplete.",
            }
            : minutesBetween(latestTelemetry.createdAt) > TELEMETRY_STALE_MINUTES
                ? {
                    status: "stale" as const,
                    title: "Telemetry heartbeat stale",
                    detail: `Last signal ${formatAge(latestTelemetry.createdAt)}. Review telemetry before trusting coverage claims.`,
                }
                : {
                    status: "live" as const,
                    title: "Telemetry heartbeat live",
                    detail: `Last signal ${formatAge(latestTelemetry.createdAt)} across the monitored routes.`,
                };

        const hasExchangeRates = Boolean(settings?.exchangeRates?.trim());
        const fxStatus = !hasExchangeRates
            ? {
                status: "missing" as const,
                title: "FX rates missing",
                detail: "Reporting-book rates are not loaded yet, so global rollups should stay in source currency views.",
            }
            : !settings?.updatedAt || hoursBetween(settings.updatedAt) > FX_RATE_STALE_HOURS
                ? {
                    status: "stale" as const,
                    title: "FX rates need refresh",
                    detail: settings?.updatedAt
                        ? `Last rates update ${formatAge(settings.updatedAt)}. Refresh book rates before relying on global spend totals.`
                        : "FX updates are not timestamped yet.",
                }
                : {
                    status: "fresh" as const,
                    title: "FX rates loaded",
                    detail: `Reporting-book rates refreshed ${formatAge(settings.updatedAt)}.`,
                };

        return {
            telemetry: telemetryStatus,
            fxRates: fxStatus,
            exceptions: {
                title: queue.total > 0 ? `${queue.total} live exceptions` : "No live exceptions",
                detail: queue.total > 0
                    ? `${queue.blockedOrders} release block${queue.blockedOrders === 1 ? "" : "s"} and ${queue.critical} critical item${queue.critical === 1 ? "" : "s"} need review.`
                    : "Release blocks, quarantined receipts, and finance holds are currently clear.",
                total: queue.total,
                blockedOrders: queue.blockedOrders,
                critical: queue.critical,
            },
        };
    } catch (error) {
        console.error("Failed to fetch operational signals:", error);
        return null;
    }
}
