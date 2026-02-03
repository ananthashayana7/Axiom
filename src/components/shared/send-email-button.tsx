"use client"

import { Mail } from "lucide-react";
import { sendUserEmail } from "@/app/actions/mail";
import { toast } from "sonner";

interface SendEmailButtonProps {
    email: string;
    name: string;
    className?: string;
}

export function SendEmailButton({ email, name, className }: SendEmailButtonProps) {
    return (
        <button
            onClick={async () => {
                const res = await sendUserEmail(email, name);
                if (res.success) toast.success(`Email sent to ${name}`);
                else toast.error(res.error);
            }}
            className={className || "flex items-center gap-1.5 text-sm hover:text-primary transition-colors"}
        >
            <Mail className="h-4 w-4" />
            {email}
        </button>
    );
}
