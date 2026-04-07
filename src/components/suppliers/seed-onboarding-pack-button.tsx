'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

import { ensureSupplierOnboardingPack } from '@/app/actions/enterprise-readiness';
import { Button } from '@/components/ui/button';

export function SeedOnboardingPackButton({ supplierId }: { supplierId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRefresh = () => {
        startTransition(async () => {
            try {
                const result = await ensureSupplierOnboardingPack(supplierId);
                if (!result.success) {
                    toast.error(result.error || 'Failed to refresh onboarding pack');
                    return;
                }

                const totalCreated = result.created.obligations + result.created.requests + result.created.tasks + result.created.actionPlans;
                toast.success(result.message, {
                    description: totalCreated > 0
                        ? `Added ${result.created.requests} request(s), ${result.created.obligations} obligation(s), ${result.created.tasks} task(s), and ${result.created.actionPlans} action plan(s).`
                        : 'No missing onboarding controls were found.',
                });
                router.refresh();
            } catch {
                toast.error('Failed to refresh onboarding pack');
            }
        });
    };

    return (
        <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isPending ? 'Refreshing...' : 'Refresh Onboarding Pack'}
        </Button>
    );
}
