import { cn } from "@/lib/utils";

export function AxiomLogo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={cn("text-primary", className)}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M12 4L3 20H7L12 11L17 20H21L12 4Z" opacity="0.3" />
            <path d="M12 11L8 18H16L12 11Z" />
            <path d="M2.5 20L10 6L12 10L5 21H2.5Z" />
            <path d="M21.5 20L14 6L12 10L19 21H21.5Z" />
        </svg>
    );
}
