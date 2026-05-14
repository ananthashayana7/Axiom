import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoadingSkeleton({
    cards = 4,
    rows = 6,
}: {
    cards?: number;
    rows?: number;
}) {
    return (
        <div className="space-y-6 p-4 lg:p-10">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-44" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: cards }).map((_, index) => (
                    <div key={index} className="space-y-3 rounded-xl border bg-card p-5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            <div className="rounded-xl border bg-card">
                <div className="border-b border-border p-4">
                    <Skeleton className="h-5 w-36" />
                </div>
                <div className="space-y-3 p-4">
                    {Array.from({ length: rows }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-8 w-20 rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
