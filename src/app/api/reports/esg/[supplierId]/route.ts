import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { suppliers, procurementOrders, invoices, supplierPerformanceLogs } from '@/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { enforceRateLimit } from '@/lib/api-rate-limit';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ supplierId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = session.user as any;
        const limited = enforceRateLimit(req, 'read', user.id);
        if (limited) return limited;

        if (user.role !== 'admin') {
            const { supplierId: sid } = await params;
            if (user.role !== 'supplier' || user.supplierId !== sid) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const { supplierId } = await params;

        // 1. Fetch supplier with all ESG/risk data
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) {
            return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
        }

        // 2. Fetch spend data
        const [spendData] = await db.select({
            totalSpend: sql<string>`COALESCE(SUM(CAST(${procurementOrders.totalAmount} AS numeric)), 0)`,
            orderCount: sql<string>`COUNT(*)`,
        }).from(procurementOrders).where(eq(procurementOrders.supplierId, supplierId));

        // 3. Fetch invoice stats
        const [invoiceData] = await db.select({
            totalInvoiced: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
            invoiceCount: sql<string>`COUNT(*)`,
        }).from(invoices).where(eq(invoices.supplierId, supplierId));

        // 4. Fetch performance history
        const perfLogs = await db.select()
            .from(supplierPerformanceLogs)
            .where(eq(supplierPerformanceLogs.supplierId, supplierId))
            .orderBy(desc(supplierPerformanceLogs.recordedAt))
            .limit(12);

        // 5. Generate ESG report HTML → text representation
        const now = new Date();
        const reportDate = now.toISOString().split('T')[0];

        const report = {
            meta: {
                reportTitle: `ESG & Sustainability Report — ${supplier.name}`,
                reportDate,
                reportPeriod: `FY ${now.getFullYear()}`,
                framework: 'GRI Standards / CSRD Aligned',
                generatedBy: 'Axiom ESG Intelligence Engine',
            },
            supplier: {
                name: supplier.name,
                email: supplier.contactEmail,
                status: supplier.status,
                tier: supplier.tierLevel,
                city: supplier.city,
                country: supplier.countryCode,
                certifications: supplier.isoCertifications || [],
            },
            esgScores: {
                overall: supplier.esgScore || 0,
                environment: supplier.esgEnvironmentScore || 0,
                social: supplier.esgSocialScore || 0,
                governance: supplier.esgGovernanceScore || 0,
            },
            carbonFootprint: {
                scope1: parseFloat(supplier.carbonFootprintScope1 || '0'),
                scope2: parseFloat(supplier.carbonFootprintScope2 || '0'),
                scope3: parseFloat(supplier.carbonFootprintScope3 || '0'),
                total: parseFloat(supplier.carbonFootprintScope1 || '0') +
                    parseFloat(supplier.carbonFootprintScope2 || '0') +
                    parseFloat(supplier.carbonFootprintScope3 || '0'),
            },
            compliance: {
                conflictMinerals: supplier.conflictMineralsStatus,
                modernSlavery: supplier.modernSlaveryStatement,
                lastAuditDate: supplier.lastAuditDate?.toISOString() || 'Not audited',
                financialHealth: supplier.financialHealthRating || 'Unrated',
            },
            riskMetrics: {
                riskScore: supplier.riskScore || 0,
                performanceScore: supplier.performanceScore || 0,
                financialScore: supplier.financialScore || 0,
                abcClassification: supplier.abcClassification,
            },
            financial: {
                totalSpend: parseFloat(spendData?.totalSpend || '0'),
                orderCount: Number(spendData?.orderCount || 0),
                totalInvoiced: parseFloat(invoiceData?.totalInvoiced || '0'),
                invoiceCount: Number(invoiceData?.invoiceCount || 0),
            },
            performanceHistory: perfLogs.map(log => ({
                date: log.recordedAt?.toISOString(),
                deliveryRate: parseFloat(log.deliveryRate),
                qualityScore: parseFloat(log.qualityScore),
                collaborationScore: log.collaborationScore,
            })),
        };

        // Return as JSON (can be rendered into PDF on client using @react-pdf/renderer)
        return NextResponse.json({
            success: true,
            report,
        });
    } catch (error) {
        console.error('[ESG Report] Generation failed:', error);
        return NextResponse.json({ error: 'Report generation failed' }, { status: 500 });
    }
}
