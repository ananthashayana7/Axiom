/**
 * Supplier Ecosystem Agent
 * Maps supplier relationships and risk propagation across the supply chain
 */

'use server'

import { db } from "@/db";
import { auth } from "@/auth";
import {
    suppliers, procurementOrders, parts, orderItems, contracts
} from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { TelemetryService } from "@/lib/telemetry";
import type { AgentResult } from "@/lib/ai/agent-types";

interface SupplierNode {
    id: string;
    name: string;
    riskScore: number;
    category: string;
    orderVolume: number;
    orderValue: number;
    partCategories: string[];
    contractStatus: 'active' | 'expiring' | 'none';
    performanceScore: number;
}

interface SupplierRelationship {
    fromId: string;
    toId: string;
    relationshipType: 'shared_category' | 'shared_parts' | 'competitor' | 'backup';
    strength: number; // 0-100
}

interface RiskPropagation {
    sourceSupplier: string;
    affectedSuppliers: string[];
    affectedParts: string[];
    impactSeverity: 'low' | 'medium' | 'high' | 'critical';
    financialExposure: number;
    mitigationOptions: string[];
}

interface SupplierEcosystem {
    nodes: SupplierNode[];
    relationships: SupplierRelationship[];
    clusters: { name: string; supplierIds: string[] }[];
    riskHotspots: RiskPropagation[];
    overallHealthScore: number;
    recommendations: string[];
}

/**
 * Build supplier ecosystem map
 */
export async function buildSupplierEcosystem(): Promise<AgentResult<SupplierEcosystem>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date()
        };
    }

    try {
        // Build nodes
        const nodes = await buildSupplierNodes();

        // Build relationships
        const relationships = await buildRelationships(nodes);

        // Identify clusters
        const clusters = identifyClusters(nodes, relationships);

        // Analyze risk propagation
        const riskHotspots = await analyzeRiskPropagation(nodes);

        // Calculate overall health
        const overallHealthScore = calculateEcosystemHealth(nodes, riskHotspots);

        // Generate recommendations
        const recommendations = generateRecommendations(nodes, riskHotspots, clusters);

        const ecosystem: SupplierEcosystem = {
            nodes,
            relationships,
            clusters,
            riskHotspots,
            overallHealthScore,
            recommendations
        };

        await TelemetryService.trackEvent("SupplierEcosystem", "map_built", {
            nodeCount: nodes.length,
            relationshipCount: relationships.length,
            healthScore: overallHealthScore
        });

        return {
            success: true,
            data: ecosystem,
            confidence: 85,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date(),
            reasoning: `Mapped ${nodes.length} suppliers with ${relationships.length} relationships. Health score: ${overallHealthScore}/100.`,
            sources: ["suppliers", "orders", "contracts", "parts"]
        };

    } catch (error) {
        console.error("Supplier Ecosystem Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Mapping failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date()
        };
    }
}

async function buildSupplierNodes(): Promise<SupplierNode[]> {
    // Get supplier base data with order stats
    const supplierData = await db
        .select({
            id: suppliers.id,
            name: suppliers.name,
            riskScore: suppliers.riskScore,
            category: suppliers.category,
            deliveryReliability: suppliers.deliveryReliability,
            qualityRating: suppliers.qualityScore
        })
        .from(suppliers)
        .where(eq(suppliers.status, 'active'));

    const nodes: SupplierNode[] = [];

    for (const supplier of supplierData) {
        // Get order volume and value
        const orderStats = await db
            .select({
                orderCount: sql<number>`COUNT(*)::int`,
                totalValue: sql<number>`COALESCE(SUM(${procurementOrders.totalAmount}::numeric), 0)`
            })
            .from(procurementOrders)
            .where(eq(procurementOrders.supplierId, supplier.id))
            .limit(1);

        // Get part categories
        const partCats = await db
            .select({ category: parts.category })
            .from(orderItems)
            .innerJoin(parts, eq(orderItems.partId, parts.id))
            .innerJoin(procurementOrders, eq(orderItems.orderId, procurementOrders.id))
            .where(eq(procurementOrders.supplierId, supplier.id))
            .groupBy(parts.category);

        // Check contract status
        const contractData = await db
            .select({ validTo: contracts.validTo, status: contracts.status })
            .from(contracts)
            .where(eq(contracts.supplierId, supplier.id))
            .orderBy(desc(contracts.validTo))
            .limit(1);

        let contractStatus: 'active' | 'expiring' | 'none' = 'none';
        if (contractData.length > 0 && contractData[0].status === 'active') {
            const daysToExpiry = contractData[0].validTo
                ? Math.ceil((new Date(contractData[0].validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 999;
            contractStatus = daysToExpiry < 60 ? 'expiring' : 'active';
        }

        // Calculate performance score
        const performanceScore = Math.round(
            ((supplier.deliveryReliability || 70) + (supplier.qualityRating || 70)) / 2
        );

        nodes.push({
            id: supplier.id,
            name: supplier.name,
            riskScore: supplier.riskScore || 50,
            category: supplier.category || 'General',
            orderVolume: orderStats[0]?.orderCount || 0,
            orderValue: Number(orderStats[0]?.totalValue || 0),
            partCategories: partCats.map(p => p.category || 'Uncategorized'),
            contractStatus,
            performanceScore
        });
    }

    return nodes;
}

async function buildRelationships(nodes: SupplierNode[]): Promise<SupplierRelationship[]> {
    const relationships: SupplierRelationship[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Find suppliers sharing categories (potential competitors/alternatives)
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];

            // Check for shared part categories
            const sharedCategories = a.partCategories.filter(cat =>
                b.partCategories.includes(cat)
            );

            if (sharedCategories.length > 0) {
                const strength = Math.min(100, sharedCategories.length * 25);
                relationships.push({
                    fromId: a.id,
                    toId: b.id,
                    relationshipType: 'shared_category',
                    strength
                });
            }

            // Check if one could be backup for other (similar category, lower volume)
            if (a.category === b.category) {
                if (a.orderVolume > b.orderVolume * 2 && b.performanceScore > 60) {
                    relationships.push({
                        fromId: a.id,
                        toId: b.id,
                        relationshipType: 'backup',
                        strength: b.performanceScore
                    });
                } else if (b.orderVolume > a.orderVolume * 2 && a.performanceScore > 60) {
                    relationships.push({
                        fromId: b.id,
                        toId: a.id,
                        relationshipType: 'backup',
                        strength: a.performanceScore
                    });
                }
            }
        }
    }

    return relationships;
}

function identifyClusters(
    nodes: SupplierNode[],
    relationships: SupplierRelationship[]
): { name: string; supplierIds: string[] }[] {
    const clusters: { name: string; supplierIds: string[] }[] = [];
    const categoryGroups = new Map<string, string[]>();

    for (const node of nodes) {
        const cat = node.category;
        if (!categoryGroups.has(cat)) {
            categoryGroups.set(cat, []);
        }
        categoryGroups.get(cat)!.push(node.id);
    }

    for (const [category, supplierIds] of categoryGroups) {
        if (supplierIds.length > 1) {
            clusters.push({
                name: `${category} Suppliers`,
                supplierIds
            });
        }
    }

    return clusters;
}

async function analyzeRiskPropagation(nodes: SupplierNode[]): Promise<RiskPropagation[]> {
    const hotspots: RiskPropagation[] = [];

    // Find high-risk single-source suppliers
    const highRiskSuppliers = nodes.filter(n =>
        n.riskScore > 70 && n.orderValue > 100000
    );

    for (const supplier of highRiskSuppliers) {
        // Check if there are alternatives
        const alternatives = nodes.filter(n =>
            n.id !== supplier.id &&
            n.category === supplier.category &&
            n.riskScore < supplier.riskScore
        );

        const severity = alternatives.length === 0 ? 'critical' :
            alternatives.length === 1 ? 'high' :
                supplier.riskScore > 85 ? 'high' : 'medium';

        hotspots.push({
            sourceSupplier: supplier.name,
            affectedSuppliers: [], // Would need deeper analysis
            affectedParts: supplier.partCategories,
            impactSeverity: severity,
            financialExposure: supplier.orderValue,
            mitigationOptions: alternatives.length > 0
                ? [`Switch to ${alternatives[0].name} (Risk: ${alternatives[0].riskScore})`]
                : ['Develop alternative supplier', 'Increase safety stock']
        });
    }

    // Find concentration risk
    const totalValue = nodes.reduce((sum, n) => sum + n.orderValue, 0);
    const highConcentration = nodes.filter(n => n.orderValue > totalValue * 0.3);

    for (const supplier of highConcentration) {
        if (!hotspots.some(h => h.sourceSupplier === supplier.name)) {
            hotspots.push({
                sourceSupplier: supplier.name,
                affectedSuppliers: [],
                affectedParts: supplier.partCategories,
                impactSeverity: supplier.orderValue > totalValue * 0.5 ? 'critical' : 'high',
                financialExposure: supplier.orderValue,
                mitigationOptions: [
                    'Diversify spend across multiple suppliers',
                    'Establish secondary source for critical parts'
                ]
            });
        }
    }

    return hotspots.sort((a, b) => b.financialExposure - a.financialExposure);
}

function calculateEcosystemHealth(
    nodes: SupplierNode[],
    hotspots: RiskPropagation[]
): number {
    if (nodes.length === 0) return 50;

    // Base score from average performance
    const avgPerformance = nodes.reduce((sum, n) => sum + (Number(n.performanceScore) || 70), 0) / nodes.length;

    // Penalty for risk hotspots
    const criticalHotspots = hotspots.filter(h => h.impactSeverity === 'critical').length;
    const highHotspots = hotspots.filter(h => h.impactSeverity === 'high').length;
    const hotspotPenalty = (criticalHotspots * 15) + (highHotspots * 5);

    // Bonus for diversity
    const uniqueCategories = new Set(nodes.map(n => n.category)).size;
    const diversityBonus = Math.min(10, uniqueCategories * 2);

    // Contract coverage bonus
    const activeContracts = nodes.filter(n => n.contractStatus === 'active').length;
    const contractBonus = Math.round((activeContracts / nodes.length) * 10);

    return Math.max(20, Math.min(100, Math.round(
        avgPerformance - hotspotPenalty + diversityBonus + contractBonus
    )));
}

function generateRecommendations(
    nodes: SupplierNode[],
    hotspots: RiskPropagation[],
    clusters: { name: string; supplierIds: string[] }[]
): string[] {
    const recommendations: string[] = [];

    // Single-source risk
    if (hotspots.some(h => h.impactSeverity === 'critical')) {
        recommendations.push('🚨 Develop alternative suppliers for critical single-source categories');
    }

    // Expiring contracts
    const expiring = nodes.filter(n => n.contractStatus === 'expiring');
    if (expiring.length > 0) {
        recommendations.push(`📄 ${expiring.length} supplier contracts expiring soon - initiate renewal discussions`);
    }

    // Low-performing suppliers
    const lowPerformers = nodes.filter(n => n.performanceScore < 60 && n.orderValue > 50000);
    if (lowPerformers.length > 0) {
        recommendations.push(`⚠️ ${lowPerformers.length} key suppliers below performance threshold - consider review or replacement`);
    }

    // Concentration risk
    const topSpend = nodes.reduce((sum, n) => sum + n.orderValue, 0);
    const topSupplier = nodes.sort((a, b) => b.orderValue - a.orderValue)[0];
    if (topSupplier && topSupplier.orderValue > topSpend * 0.4) {
        recommendations.push(`📊 ${topSupplier.name} represents >${Math.round(topSupplier.orderValue / topSpend * 100)}% of spend - consider diversification`);
    }

    // Small clusters
    const singleSupplierCats = nodes.filter(n =>
        !clusters.some(c => c.supplierIds.includes(n.id) && c.supplierIds.length > 1)
    );
    if (singleSupplierCats.length > 2) {
        recommendations.push('🔍 Multiple categories with single suppliers - scout alternative suppliers');
    }

    return recommendations.slice(0, 5);
}

/**
 * Get supplier dependency analysis for a specific supplier
 */
export async function analyzeSupplierDependency(supplierId: string): Promise<AgentResult<{
    supplier: SupplierNode;
    dependencyScore: number;
    alternatives: SupplierNode[];
    impactIfLost: { metric: string; value: string }[];
    switchingCost: number;
}>> {
    const startTime = Date.now();
    const session = await auth();

    if (!session?.user) {
        return {
            success: false,
            error: "Unauthorized",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date()
        };
    }

    try {
        const ecosystem = await buildSupplierEcosystem();
        if (!ecosystem.success || !ecosystem.data) {
            throw new Error("Failed to build ecosystem");
        }

        const supplier = ecosystem.data.nodes.find(n => n.id === supplierId);
        if (!supplier) {
            throw new Error("Supplier not found");
        }

        // Find alternatives
        const alternatives = ecosystem.data.nodes.filter(n =>
            n.id !== supplierId &&
            n.category === supplier.category &&
            n.performanceScore >= 60
        ).sort((a, b) => b.performanceScore - a.performanceScore);

        // Calculate dependency score
        const totalValue = ecosystem.data.nodes.reduce((sum, n) => sum + n.orderValue, 0);
        const spendShare = supplier.orderValue / (totalValue || 1);
        const hasAlternatives = alternatives.length > 0;
        const dependencyScore = Math.round(
            (spendShare * 50) +
            (hasAlternatives ? 0 : 30) +
            (supplier.partCategories.length * 5)
        );

        return {
            success: true,
            data: {
                supplier,
                dependencyScore: Math.min(100, dependencyScore),
                alternatives: alternatives.slice(0, 3),
                impactIfLost: [
                    { metric: 'Annual Spend at Risk', value: `₹${supplier.orderValue.toLocaleString()}` },
                    { metric: 'Part Categories Affected', value: `${supplier.partCategories.length}` },
                    { metric: 'Alternative Suppliers', value: `${alternatives.length}` }
                ],
                switchingCost: Math.round(supplier.orderValue * 0.1) // Estimated 10% switching cost
            },
            confidence: 80,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date()
        };

    } catch (error) {
        console.error("Dependency Analysis Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Analysis failed",
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName: "supplier-ecosystem",
            timestamp: new Date()
        };
    }
}
