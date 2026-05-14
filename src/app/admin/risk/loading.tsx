import { RouteLoadingSkeleton } from "@/components/shared/route-loading-skeleton";

export default function Loading() {
    return <RouteLoadingSkeleton cards={4} rows={6} />;
}
