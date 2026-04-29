import { cn } from "@/lib/utils";
import { getEnvironmentStatus } from "@/lib/environment";

const TONE_CLASSES = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300",
} as const;

export function EnvironmentPill({ className }: { className?: string }) {
    const environment = getEnvironmentStatus();

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
                TONE_CLASSES[environment.tone],
                className,
            )}
            title={environment.description}
        >
            {environment.label}
        </span>
    );
}
