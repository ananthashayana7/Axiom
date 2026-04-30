'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { sendSupplierMessage } from "@/app/actions/mail";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MessageSupplierButtonProps = {
    supplierId: string;
    supplierName: string;
    supplierEmail: string;
    triggerLabel?: string;
    iconOnly?: boolean;
    variant?: "default" | "outline" | "ghost";
    className?: string;
    contextType?: 'part' | 'rfq' | 'order';
    contextId?: string;
    contextLabel?: string;
    defaultSubject?: string;
    onSent?: () => void;
};

export function MessageSupplierButton({
    supplierId,
    supplierName,
    supplierEmail,
    triggerLabel = "Message Supplier",
    iconOnly = false,
    variant = "outline",
    className,
    contextType,
    contextId,
    contextLabel,
    defaultSubject,
    onSent,
}: MessageSupplierButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const buildInitialSubject = () => defaultSubject || (contextLabel ? `Axiom update: ${contextLabel}` : `Axiom update for ${supplierName}`);
    const [subject, setSubject] = useState(buildInitialSubject);
    const [body, setBody] = useState("");
    const [isPending, startTransition] = useTransition();

    const resetComposer = () => {
        setSubject(buildInitialSubject());
        setBody("");
    };

    const handleSend = () => {
        startTransition(async () => {
            const result = await sendSupplierMessage({
                supplierId,
                subject,
                body,
                contextType,
                contextId,
                contextLabel,
            });

            if (!result.success) {
                toast.error(result.error || "Message could not be sent.");
                return;
            }

            toast.success(`Message logged for ${supplierName}`, {
                description: result.warning
                    ? "Thread saved in Axiom and supplier portal notified. SMTP still needs configuration for outbound email."
                    : "Supplier portal thread updated and outbound email dispatched.",
            });

            setOpen(false);
            resetComposer();
            onSent?.();
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
                resetComposer();
            }
        }}>
            <DialogTrigger asChild>
                <Button variant={variant} size={iconOnly ? "icon" : "sm"} className={className}>
                    <Mail className="h-4 w-4" />
                    {!iconOnly ? triggerLabel : <span className="sr-only">{triggerLabel}</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Message {supplierName}</DialogTitle>
                    <DialogDescription>
                        This sends a supplier-facing message from Axiom, logs it in the shared thread, and delivers an email copy to {supplierEmail} when SMTP is configured.
                        {contextLabel ? ` It will also be attached to ${contextLabel} for audit-safe retrieval.` : null}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <label htmlFor={`subject-${supplierId}`} className="text-sm font-medium">
                            Subject
                        </label>
                        <Input
                            id={`subject-${supplierId}`}
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            placeholder="Delivery update, compliance request, quote clarification..."
                        />
                    </div>

                    <div className="grid gap-2">
                        <label htmlFor={`body-${supplierId}`} className="text-sm font-medium">
                            Message
                        </label>
                        <Textarea
                            id={`body-${supplierId}`}
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            className="min-h-[180px]"
                            placeholder="Write the supplier-facing update that should become part of the auditable record."
                        />
                    </div>

                    <div className="rounded-2xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                        Outbound messages create a searchable supplier thread in Axiom, notify linked supplier users in the portal, and keep the communication trail attached to this record.
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSend}
                        disabled={isPending || !subject.trim() || !body.trim()}
                        className="gap-2"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {isPending ? "Sending..." : "Send Message"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
