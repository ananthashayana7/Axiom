'use client'

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, Mail, ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle, XCircle, Plus, MessageSquare, BookOpen, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitSupportTicket, getUserTickets } from "@/app/actions/support";
import { useSession } from "next-auth/react";

const CATEGORIES = ['Technical Issue', 'Billing', 'Data Import', 'Access & Permissions', 'Feature Request', 'General Enquiry'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const FAQS = [
    { q: 'How do I reset my password?', a: 'Contact your admin or use the password reset link on the login page. An email will be sent to your registered address from pma.axiom.support@gmail.com.' },
    { q: 'How do I import SAP data into Axiom?', a: 'Go to Admin → Import Data, upload your SAP-exported CSV file, preview the mapping, and confirm the import.' },
    { q: 'How are currencies displayed?', a: 'Axiom automatically detects your country from your browser locale/timezone and displays amounts in your local currency (e.g. ₹ for India, € for Germany, $ for USA). You can also manually switch currencies using the toggle on analytics pages.' },
    { q: 'How do I add a new supplier?', a: 'Navigate to Suppliers → New Supplier. Fill in business details, currency, region and save. Invite the supplier via Supplier Portal.' },
    { q: 'Who can access the Analytics dashboard?', a: 'The Analytics section is visible to all users, but certain export and configuration features are restricted to admin roles.' },
    { q: 'What is the support contact email?', a: 'All support emails are handled through pma.axiom.support@gmail.com. Ticket replies will be sent to your registered email.' },
];

const priorityColor: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600 border-slate-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
};
const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    closed: 'bg-stone-100 text-stone-600 border-stone-200',
};
const statusIcon: Record<string, ReactNode> = {
    open: <Clock className="h-3.5 w-3.5" />,
    in_progress: <AlertTriangle className="h-3.5 w-3.5" />,
    resolved: <CheckCircle className="h-3.5 w-3.5" />,
    closed: <XCircle className="h-3.5 w-3.5" />,
};

export default function SupportPage() {
    const { data: session } = useSession();
    const [showForm, setShowForm] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ subject: '', category: '', priority: 'medium' as typeof PRIORITIES[number], description: '' });

    useEffect(() => {
        getUserTickets().then(setTickets).catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.subject || !form.description || !form.category) { toast.error("Please fill all required fields"); return; }
        setSubmitting(true);
        try {
            const result = await submitSupportTicket({ subject: form.subject, category: form.category, priority: form.priority, description: form.description });
            if (result.emailSent) {
                toast.success("Ticket submitted and support email sent.");
            } else {
                toast.warning("Ticket submitted, but support email was not sent. Please check SMTP configuration.");
            }
            setForm({ subject: '', category: '', priority: 'medium', description: '' });
            setShowForm(false);
            getUserTickets().then(setTickets);
        } catch {
            toast.error("Failed to submit ticket. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <LifeBuoy className="h-8 w-8 text-primary" /> Help & Support
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">Get help, submit tickets, or browse common questions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="mailto:pma.axiom.support@gmail.com" className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card hover:bg-muted text-sm font-semibold transition">
                        <Mail className="h-4 w-4 text-primary" /> pma.axiom.support@gmail.com
                    </a>
                    <Button onClick={() => setShowForm(v => !v)} className="gap-2">
                        <Plus className="h-4 w-4" /> New Ticket
                    </Button>
                </div>
            </div>

            {/* Submit Ticket Form */}
            {showForm && (
                <Card className="border-primary/30 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Submit a Support Ticket</CardTitle>
                        <CardDescription>We&apos;ll respond to your registered email from <strong>pma.axiom.support@gmail.com</strong>.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
                                    <Input id="subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief description of issue" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
                                    <select id="category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring">
                                        <option value="">Select category</option>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Priority</Label>
                                    <div className="flex gap-2 flex-wrap">
                                        {PRIORITIES.map(p => (
                                            <button type="button" key={p} onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                                                className={cn("px-3 py-1.5 rounded-md border text-xs font-bold capitalize transition-all", form.priority === p ? "ring-2 ring-primary " + priorityColor[p] : "bg-card hover:bg-muted border-border")}>
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                                <Textarea id="description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe your issue in detail (steps to reproduce, screenshots if relevant)..." rows={5} />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                                <Button type="submit" disabled={submitting} className="gap-2">
                                    <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit Ticket'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* My Tickets */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> My Tickets</CardTitle>
                    <CardDescription>Track the status of your support requests.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {tickets.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground italic">No tickets yet. Submit a ticket above when you need help.</div>
                    ) : (
                        <div className="rounded-md overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        {['Ticket #', 'Subject', 'Category', 'Priority', 'Status', 'Submitted'].map(h => (
                                            <th key={h} className="h-11 px-4 text-left align-middle font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((t: any) => (
                                        <tr key={t.id} className="border-b hover:bg-muted/50 transition-colors">
                                            <td className="p-4 align-middle font-mono text-xs font-bold text-primary">{t.ticketNumber}</td>
                                            <td className="p-4 align-middle font-medium max-w-xs truncate">{t.subject}</td>
                                            <td className="p-4 align-middle text-muted-foreground text-xs">{t.category}</td>
                                            <td className="p-4 align-middle">
                                                <Badge className={cn("text-[10px] font-bold border capitalize", priorityColor[t.priority] || '')}>{t.priority}</Badge>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge className={cn("text-[10px] font-bold border flex items-center gap-1 w-fit", statusColor[t.status] || '')}>
                                                    {statusIcon[t.status]} {t.status?.replace('_', ' ')}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-muted-foreground text-xs">
                                                {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* FAQ */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Frequently Asked Questions</CardTitle>
                    <CardDescription>Quick answers to the most common questions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {FAQS.map((faq, i) => (
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
