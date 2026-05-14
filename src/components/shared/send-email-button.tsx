"use client"

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { sendUserEmail } from "@/app/actions/mail";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SendEmailButtonProps {
    email: string;
    name: string;
    className?: string;
}

export function SendEmailButton({ email, name, className }: SendEmailButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error("Subject is required");
            return;
        }
        if (!body.trim()) {
            toast.error("Message body is required");
            return;
        }

        setIsSending(true);
        try {
            const res = await sendUserEmail(email, name, subject, body);
            if (res.success) {
                toast.success(`Email sent to ${name}`);
                setIsOpen(false);
                setSubject("");
                setBody("");
            } else {
                toast.error(res.error || "Failed to send email");
            }
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={className || "flex items-center gap-1.5 text-sm hover:text-primary transition-colors"}
            >
                <Mail className="h-4 w-4" />
                {email}
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Send Email</DialogTitle>
                        <DialogDescription>
                            Compose an email to <strong>{name}</strong> ({email}).
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="subject" className="text-sm font-medium leading-none">Subject</label>
                            <Input 
                                id="subject" 
                                placeholder="Email subject..." 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                disabled={isSending}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="body" className="text-sm font-medium leading-none">Message</label>
                            <Textarea 
                                id="body" 
                                placeholder="Type your message here..." 
                                className="min-h-[150px] resize-y"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                disabled={isSending}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
                            Cancel
                        </Button>
                        <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
                            {isSending ? "Sending..." : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Email
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
