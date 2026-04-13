import { getRFQs } from "@/app/actions/rfqs";
import { getParts } from "@/app/actions/parts";
import { RFQsListClient } from "@/components/sourcing/rfqs-list-client";
import { auth } from "@/auth";
import { formatDateLabel } from "@/lib/utils/date";

export const dynamic = 'force-dynamic';

type RFQListRow = {
    id: string;
    title: string;
    description?: string | null;
    status?: string | null;
    createdAt?: Date | string | null;
    createdAtLabel?: string;
    items?: Array<{ id: string; [key: string]: unknown }>;
    suppliers?: Array<{ id: string; supplier?: { name?: string | null; [key: string]: unknown } | null; [key: string]: unknown }>;
};

type PartOption = {
    id: string;
    sku: string;
    name: string;
    category: string;
};

export default async function RFQsPage({ searchParams }: { searchParams?: Promise<{ action?: string }> }) {
    const rfqs = await getRFQs();
    const parts = await getParts();
    const session = await auth();
    const isAdmin = session?.user?.role === 'admin';
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const rfqsWithDisplayDates: RFQListRow[] = rfqs.map((rfq) => {
        const row = rfq as RFQListRow;

        return {
            ...row,
            createdAtLabel: formatDateLabel(row.createdAt),
        };
    });
    const partOptions: PartOption[] = isAdmin
        ? parts.map((part) => ({
            id: part.id,
            sku: part.sku,
            name: part.name,
            category: part.category,
        }))
        : [];

    return (
        <div className="flex min-h-full min-w-0 flex-col bg-muted/40 p-4 lg:p-8">
            <RFQsListClient
                rfqs={rfqsWithDisplayDates}
                isAdmin={isAdmin}
                parts={partOptions}
                defaultCreateOpen={resolvedSearchParams?.action === 'new'}
            />
        </div>
    );
}
