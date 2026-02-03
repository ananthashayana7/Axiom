import { cn } from "@/lib/utils";

export function AxiomLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={cn("text-primary", className)} fill="currentColor">
            <path d="M12 4L3 20H7L12 11L17 20H21L12 4Z" opacity="0.3" />
            <path d="M12 11L8 18H16L12 11Z" />
        </svg>
    );
}
