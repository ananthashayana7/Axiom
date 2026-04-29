'use client'

import { useTransition } from "react";
import { Globe, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { enrichSupplierFromPublicProfile } from "@/app/actions/suppliers";
import { Button } from "@/components/ui/button";

export function EnrichSupplierButton({ supplierId }: { supplierId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleEnrich = () => {
        startTransition(async () => {
            const result = await enrichSupplierFromPublicProfile(supplierId);

            if (!result.success) {
                toast.error(result.error || "Public-web enrichment failed");
                return;
            }

            toast.success("Supplier enriched from the public web profile.", {
                description: result.summary || `Updated the Axiom record using ${result.domain}.`,
            });
            router.refresh();
        });
    };

    return (
        <Button variant="outline" className="gap-2" onClick={handleEnrich} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {isPending ? "Researching..." : "Enrich from Public Web"}
        </Button>
    );
}
