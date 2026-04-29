'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LifeBuoy, Mail, ChevronDown, ChevronUp, ShieldCheck, BookOpen } from "lucide-react";
import { useSession } from "next-auth/react";
import { canManageSupportTickets, SUPPORT_FAQS } from "@/lib/support";

export default function SupportPage() {
    const { data: session } = useSession();
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const canManageTickets = canManageSupportTickets((session?.user as { role?: string | null } | undefined)?.role);

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <LifeBuoy className="h-8 w-8 text-primary" /> Help & Support
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">Browse common guidance and support contacts in one shared help center.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-semibold">
                        <Mail className="h-4 w-4 text-primary" /> pma.axiom.support@gmail.com
                    </div>
                    {canManageTickets && (
                        <Button asChild className="gap-2">
                            <Link href="/admin/support">
                                <ShieldCheck className="h-4 w-4" /> Support Ticket Console
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Support Guide</CardTitle>
                    <CardDescription>
                        Frequently asked questions stay available to everyone, while ticket management is restricted to admins.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border bg-card p-4">
                        <h2 className="font-semibold text-sm">Need additional help?</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Use this page to find product guidance first. If your question is still open, contact your administrator or use the support inbox shown above for follow-up.
                        </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                        <h2 className="font-semibold text-sm">Ticket access</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Support tickets and ticket overview data are only visible in the admin support console.
                            {canManageTickets ? " You can open it directly from the button above." : " Non-admin users can continue using this page as the shared knowledge guide."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* FAQ */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Frequently Asked Questions</CardTitle>
                    <CardDescription>Quick answers to the most common questions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {SUPPORT_FAQS.map((faq, i) => (
                        <div key={i} className="border rounded-lg overflow-hidden">
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="flex items-center justify-between w-full p-4 text-left font-semibold text-sm hover:bg-muted/50 transition-colors">
                                <span>{faq.q}</span>
                                {openFaq === i ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            </button>
                            {openFaq === i && (
                                <div className="px-4 pb-4 text-sm text-muted-foreground border-t bg-muted/30 pt-3">{faq.a}</div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
