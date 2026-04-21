import { cn } from "@/lib/utils";

export function AxiomLogo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={cn("text-primary", className)}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Background diamond */}
            <path d="M12 2L22 12L12 22L2 12Z" opacity="0.15" />
            {/* Bold A letterform */}
            <path d="M12 5.5L5.5 19H8.2L9.8 15H14.2L15.8 19H18.5L12 5.5Z" opacity="0.3" />
            {/* Left leg */}
            <path d="M12 5.5L7 19H9.2L12 11.5L12 5.5Z" />
            {/* Right leg */}
            <path d="M12 5.5L17 19H14.8L12 11.5L12 5.5Z" />
            {/* Crossbar */}
            <path d="M10.2 14H13.8L12 10L10.2 14Z" />
        </svg>
    );
}
