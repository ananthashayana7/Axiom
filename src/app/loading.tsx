import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="p-4 lg:p-10 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-72" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                        </div>
                        <Skeleton className="h-8 w-36" />
                        <Skeleton className="h-3 w-24" />
                        <div className="flex gap-2 pt-3 border-t border-border">
                            <Skeleton className="h-7 flex-1 rounded-md" />
                            <Skeleton className="h-7 w-16 rounded-md" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts + Sidebar */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4">
                    <div className="rounded-xl border bg-card p-6 space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-[300px] w-full rounded-lg" />
                    </div>
                </div>
                <div className="col-span-3 space-y-6">
                    <div className="rounded-xl border bg-card p-6 space-y-4">
                        <Skeleton className="h-6 w-36" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-xl border bg-card p-6 space-y-4">
                        <Skeleton className="h-6 w-40" />
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-full" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                                <Skeleton className="h-5 w-16" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
