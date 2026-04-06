import { getRFQs } from "@/app/actions/rfqs";
import { getParts } from "@/app/actions/parts";
import { CreateRFQModal } from "@/components/sourcing/create-rfq-modal";
import { RFQsListClient } from "@/components/sourcing/rfqs-list-client";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export default async function RFQsPage() {
    const rfqs = await getRFQs();
    const parts = await getParts();
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <RFQsListClient
                rfqs={rfqs as any}
                isAdmin={isAdmin}
                createAction={isAdmin ? <CreateRFQModal parts={parts} /> : null}
            />
        </div>
    );
}
