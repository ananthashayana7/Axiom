/**
 * Payment Optimization Agent
 * AI-powered payment timing and discount capture optimization
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    invoices,
    procurementOrders,
    suppliers,
    contracts,
    paymentOptimizations
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult, PaymentOptimization } from "@/lib/ai/agent-types";

/**
 * Main payment optimization function
 * Analyzes pending payments and identifies savings opportunities
 */
export async function runPaymentOptimizationAgent(): Promise<AgentResult<PaymentOptimization[]>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "payment-optimizer",
            timestamp: new Date()
        };
    }

    try {
        const optimizations: PaymentOptimization[] = [];

        // Get pending invoices with their associated order and contract data
        const pendingInvoices = await db
            .select({
                invoiceId: invoices.id,
                orderId: invoices.orderId,
                supplierId: invoices.supplierId,
                invoiceNumber: invoices.invoiceNumber,
                amount: invoices.amount,
                createdAt: invoices.createdAt,
                supplierName: suppliers.name,
                orderAmount: procurementOrders.totalAmount,
                contractId: procurementOrders.contractId
            })
            .from(invoices)
            .innerJoin(suppliers, eq(invoices.supplierId, suppliers.id))
            .innerJoin(procurementOrders, eq(invoices.orderId, procurementOrders.id))
            .where(eq(invoices.status, 'pending'))
            .orderBy(desc(invoices.createdAt))
            .limit(100);

        // Analyze each pending invoice for optimization opportunities
        for (const invoice of pendingInvoices) {
            const optimization = await analyzePaymentOpportunity(invoice);
            if (optimization && optimization.potentialSavings > 0) {
                optimizations.push(optimization);

                // Store in database
                await db.insert(paymentOptimizations).values({
                    orderId: invoice.orderId,
                    invoiceId: invoice.invoiceId,
                    supplierName: invoice.supplierName,
                    invoiceAmount: invoice.amount,
                    discountTerms: optimization.discountTerms,
                    currentDueDate: optimization.currentDueDate,
                    suggestedPaymentDate: optimization.suggestedPaymentDate,
                    potentialSavings: optimization.potentialSavings.toString(),
                    savingsType: optimization.savingsType,
                    reason: optimization.reason,
                    annualizedReturn: optimization.annualizedReturn?.toString()
                });
            }
        }

        // Calculate total potential savings
        const totalSavings = optimizations.reduce((sum, o) => sum + o.potentialSavings, 0);

        // Notify finance team if significant savings available
        if (totalSavings > 10000) { // > ₹10K
            const adminUsers = await db
                .select({ id: suppliers.id })
                .from(suppliers)
                .limit(1); // Placeholder - would query finance users

            await TelemetryService.trackMetric(
                "PaymentOptimizerAgent",
                "total_potential_savings",
                totalSavings
            );
        }

        return {
            success: true,
            data: optimizations,
            confidence: 85,
            executionTimeMs: Date.now() - startTime,
            agentName: "payment-optimizer",
            timestamp: new Date(),
            reasoning: `Analyzed ${pendingInvoices.length} pending invoices. Found ${optimizations.length} optimization opportunities with total potential savings of ₹${totalSavings.toLocaleString()}.`,
            sources: ["invoices", "contracts", "payment_terms"]
        };

    } catch (error) {
        console.error("Payment Optimization Error:", error);
        await TelemetryService.trackError(
            "PaymentOptimizerAgent",
            "optimization_failed",
            error instanceof Error ? error : new Error(String(error))
        );

        return {
            success: false,
            error: error instanceof Error ? error.message : "Payment optimization failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "payment-optimizer",
            timestamp: new Date()
        };
    }
}

/**
 * Analyze a single invoice for payment optimization
 */
async function analyzePaymentOpportunity(invoice: {
    invoiceId: string;
    orderId: string;
    supplierId: string;
    supplierName: string;
    amount: string;
    createdAt: Date | null;
    contractId: string | null;
}): Promise<PaymentOptimization | null> {
    const invoiceAmount = Number(invoice.amount);
    const invoiceDate = invoice.createdAt || new Date();

    // Default payment terms (Net 30)
    let paymentTerms = { discountPercent: 0, discountDays: 0, netDays: 30 };

    // Try to get actual terms from contract
    if (invoice.contractId) {
        const contractData = await db
            .select({
                slaKpis: contracts.slaKpis
            })
            .from(contracts)
            .where(eq(contracts.id, invoice.contractId))
            .limit(1);

        if (contractData.length > 0 && contractData[0].slaKpis) {
            try {
                const sla = JSON.parse(contractData[0].slaKpis);
                if (sla.paymentTerms) {
                    paymentTerms = parsePaymentTerms(sla.paymentTerms);
                }
            } catch {
                // Use defaults
            }
        }
    }

    // Check for early payment discount opportunity
    if (paymentTerms.discountPercent > 0) {
        const discountDeadline = new Date(invoiceDate);
        discountDeadline.setDate(discountDeadline.getDate() + paymentTerms.discountDays);

        const today = new Date();
        const daysUntilDeadline = Math.ceil((discountDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only suggest if we can still make the deadline
        if (daysUntilDeadline > 0) {
            const savings = invoiceAmount * (paymentTerms.discountPercent / 100);

            // Calculate annualized return
            const daysEarly = paymentTerms.netDays - paymentTerms.discountDays;
            const annualizedReturn = ((paymentTerms.discountPercent / 100) / (daysEarly / 365)) * 100;

            const dueDate = new Date(invoiceDate);
            dueDate.setDate(dueDate.getDate() + paymentTerms.netDays);

            return {
                orderId: invoice.orderId,
                invoiceId: invoice.invoiceId,
                supplierName: invoice.supplierName,
                invoiceAmount,
                discountTerms: `${paymentTerms.discountPercent}/${paymentTerms.discountDays} Net ${paymentTerms.netDays}`,
                currentDueDate: dueDate,
                suggestedPaymentDate: discountDeadline,
                potentialSavings: Math.round(savings * 100) / 100,
                savingsType: 'early_payment_discount',
                reason: `Pay ${daysUntilDeadline} days early to capture ${paymentTerms.discountPercent}% discount. Annualized return: ${annualizedReturn.toFixed(1)}%`,
                annualizedReturn: Math.round(annualizedReturn * 10) / 10
            };
        }
    }

    // Check for penalty avoidance (simulated - would need actual due date tracking)
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + paymentTerms.netDays);

    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Alert if payment is approaching due date
    if (daysUntilDue <= 5 && daysUntilDue > 0) {
        // Typical late payment penalty is 1.5% per month
        const potentialPenalty = invoiceAmount * 0.015;

        return {
            orderId: invoice.orderId,
            invoiceId: invoice.invoiceId,
            supplierName: invoice.supplierName,
            invoiceAmount,
            currentDueDate: dueDate,
            suggestedPaymentDate: new Date(), // Pay immediately
            potentialSavings: Math.round(potentialPenalty * 100) / 100,
            savingsType: 'penalty_avoidance',
            reason: `Payment due in ${daysUntilDue} days. Pay now to avoid potential late payment penalties.`
        };
    }

    // For large invoices, suggest cash flow optimization
    if (invoiceAmount > 1000000 && daysUntilDue > 10) {
        // Large invoice - suggest waiting until closer to due date for cash flow
        const optimalPayDate = new Date(dueDate);
        optimalPayDate.setDate(optimalPayDate.getDate() - 3); // Pay 3 days before due

        const daysToHold = Math.ceil((optimalPayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Assume 5% annual return on held cash
        const interestSavings = (invoiceAmount * 0.05 * daysToHold) / 365;

        if (interestSavings > 1000) { // Only suggest if meaningful
            return {
                orderId: invoice.orderId,
                invoiceId: invoice.invoiceId,
                supplierName: invoice.supplierName,
                invoiceAmount,
                currentDueDate: dueDate,
                suggestedPaymentDate: optimalPayDate,
                potentialSavings: Math.round(interestSavings * 100) / 100,
                savingsType: 'cash_flow_optimization',
                reason: `Hold payment for ${daysToHold} days to optimize cash flow. Estimated interest savings: ₹${Math.round(interestSavings).toLocaleString()}`
            };
        }
    }

    return null;
}

/**
 * Parse payment terms string (e.g., "2/10 net 30")
 */
function parsePaymentTerms(terms: string): { discountPercent: number; discountDays: number; netDays: number } {
    const defaults = { discountPercent: 0, discountDays: 0, netDays: 30 };

    if (!terms) return defaults;

    // Handle "2/10 net 30" format
    const match = terms.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*(?:net\s*)?(\d+)/i);
    if (match) {
        return {
            discountPercent: parseFloat(match[1]),
            discountDays: parseInt(match[2]),
            netDays: parseInt(match[3])
        };
    }

    // Handle "net 30" format
    const netMatch = terms.match(/net\s*(\d+)/i);
    if (netMatch) {
        return { ...defaults, netDays: parseInt(netMatch[1]) };
    }

    return defaults;
}

/**
 * Get payment optimization summary for dashboard
 */
export async function getPaymentOptimizationSummary(): Promise<{
    totalPendingAmount: number;
    totalPotentialSavings: number;
    opportunityCount: number;
    byType: { type: string; count: number; savings: number }[];
    topOpportunities: PaymentOptimization[];
}> {
    const session = await auth();
    if (!session?.user) {
        return {
            totalPendingAmount: 0,
            totalPotentialSavings: 0,
            opportunityCount: 0,
            byType: [],
            topOpportunities: []
        };
    }

    try {
        // Get pending optimizations
        const optimizations = await db
            .select()
            .from(paymentOptimizations)
            .where(eq(paymentOptimizations.status, 'pending'))
            .orderBy(desc(sql`${paymentOptimizations.potentialSavings}::numeric`))
            .limit(50);

        // Calculate totals
        const totalPendingAmount = optimizations.reduce(
            (sum, o) => sum + Number(o.invoiceAmount), 0
        );
        const totalPotentialSavings = optimizations.reduce(
            (sum, o) => sum + Number(o.potentialSavings || 0), 0
        );

        // Group by type
        const byTypeMap = new Map<string, { count: number; savings: number }>();
        for (const opt of optimizations) {
            const type = opt.savingsType || 'other';
            const existing = byTypeMap.get(type) || { count: 0, savings: 0 };
            existing.count++;
            existing.savings += Number(opt.potentialSavings || 0);
            byTypeMap.set(type, existing);
        }

        const byType = Array.from(byTypeMap.entries()).map(([type, data]) => ({
            type,
            count: data.count,
            savings: Math.round(data.savings * 100) / 100
        }));

        // Get top opportunities
        const topOpportunities: PaymentOptimization[] = optimizations.slice(0, 5).map(opt => ({
            orderId: opt.orderId,
            invoiceId: opt.invoiceId || undefined,
            supplierName: opt.supplierName,
            invoiceAmount: Number(opt.invoiceAmount),
            discountTerms: opt.discountTerms || undefined,
            currentDueDate: opt.currentDueDate || new Date(),
            suggestedPaymentDate: opt.suggestedPaymentDate || new Date(),
            potentialSavings: Number(opt.potentialSavings || 0),
            savingsType: (opt.savingsType as 'early_payment_discount' | 'cash_flow_optimization' | 'penalty_avoidance') || 'early_payment_discount',
            reason: opt.reason || '',
            annualizedReturn: opt.annualizedReturn ? Number(opt.annualizedReturn) : undefined
        }));

        return {
            totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
            totalPotentialSavings: Math.round(totalPotentialSavings * 100) / 100,
            opportunityCount: optimizations.length,
            byType,
            topOpportunities
        };

    } catch (error) {
        console.error("Failed to get payment optimization summary:", error);
        return {
            totalPendingAmount: 0,
            totalPotentialSavings: 0,
            opportunityCount: 0,
            byType: [],
            topOpportunities: []
        };
    }
}

/**
 * Execute a payment optimization (mark as actioned)
 */
export async function executePaymentOptimization(
    optimizationId: string
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db
            .update(paymentOptimizations)
            .set({ status: 'executed' })
            .where(eq(paymentOptimizations.id, optimizationId));

        await TelemetryService.trackEvent("PaymentOptimization", "executed", {
            optimizationId
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to execute payment optimization:", error);
        return { success: false, error: "Failed to execute optimization" };
    }
}

/**
 * Dismiss a payment optimization
 */
export async function dismissPaymentOptimization(
    optimizationId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db
            .update(paymentOptimizations)
            .set({
                status: 'dismissed',
                reason: reason || 'Dismissed by user'
            })
            .where(eq(paymentOptimizations.id, optimizationId));

        return { success: true };
    } catch (error) {
        console.error("Failed to dismiss payment optimization:", error);
        return { success: false, error: "Failed to dismiss optimization" };
    }
}
