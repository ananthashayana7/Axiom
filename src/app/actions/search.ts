'use server'

import { db } from "@/db";
import { suppliers, rfqs, procurementOrders, parts } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import { auth } from "@/auth";

export type SearchResult = {
    id: string;
    type: 'supplier' | 'rfq' | 'order' | 'part';
    title: string;
    subtitle?: string;
    href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const session = await auth();
    if (!session?.user) return [];

    const role = (session.user as any).role;
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) return [];

    const results: SearchResult[] = [];

    try {
        // 1. Search Suppliers (Admin/Manager only or if query is specific)
        if (role !== 'supplier') {
            const matchedSuppliers = await db.select()
                .from(suppliers)
                .where(ilike(suppliers.name, `%${trimmedQuery}%`))
                .limit(5);

            matchedSuppliers.forEach((s: any) => {
                results.push({
                    id: s.id,
                    type: 'supplier',
                    title: s.name,
                    subtitle: `Supplier • ${s.status}`,
                    href: `/suppliers/${s.id}`
                });
            });
        }

        // 2. Search RFQs
        const matchedRFQs = await db.select()
            .from(rfqs)
            .where(ilike(rfqs.title, `%${trimmedQuery}%`))
            .limit(5);

        matchedRFQs.forEach((r: any) => {
            const path = role === 'supplier' ? `/portal/rfqs/${r.id}` : `/sourcing/rfqs/${r.id}`;
            results.push({
                id: r.id,
                type: 'rfq',
                title: r.title,
                subtitle: `RFQ • ${r.status}`,
                href: path
            });
        });

        // 3. Search Orders
        const matchedOrders = await db.select()
            .from(procurementOrders)
            .where(ilike(procurementOrders.id, `%${trimmedQuery}%`))
            .limit(5);

        matchedOrders.forEach((o: any) => {
            const path = role === 'supplier' ? `/portal/orders/${o.id}` : `/sourcing/orders/${o.id}`;
            results.push({
                id: o.id,
                type: 'order',
                title: `Order ${o.id.slice(0, 8)}`,
                subtitle: `Procurement Order • ${o.status}`,
                href: path
            });
        });

        // 4. Search Parts
        const matchedParts = await db.select()
            .from(parts)
            .where(or(
                ilike(parts.name, `%${trimmedQuery}%`),
                ilike(parts.sku || '', `%${trimmedQuery}%`)
            ))
            .limit(5);

        matchedParts.forEach((p: any) => {
            results.push({
                id: p.id,
                type: 'part',
                title: p.name,
                subtitle: `Part • SKU: ${p.sku || 'N/A'} • ${p.category}`,
                href: `/sourcing/parts` // Update this if a specific part page exists
            });
        });

        return results;
    } catch (error) {
        console.error("Global search error:", error);
        return [];
    }
}
