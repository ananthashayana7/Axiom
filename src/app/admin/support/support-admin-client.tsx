'use client'

import { useState, useTransition } from "react";
import { updateTicketStatus } from "@/app/actions/support";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

type Ticket = {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    category: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical' | null;
    status: TicketStatus | null;
    resolution: string | null;
    createdAt: Date | null;
};

const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    closed: 'bg-stone-100 text-stone-600 border-stone-200',
};

const priorityColors: Record<string, string> = {
    low: 'bg-slate-100 text-slate-600 border-slate-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
};

export default function SupportAdminClient({ tickets }: { tickets: Ticket[] }) {
    const [isPending, startTransition] = useTransition();
    const [edits, setEdits] = useState<Record<string, { status: TicketStatus; resolution: string }>>(() => {
        const seed: Record<string, { status: TicketStatus; resolution: string }> = {};
        for (const ticket of tickets) {
            seed[ticket.id] = {
                status: (ticket.status || 'open') as TicketStatus,
                resolution: ticket.resolution || '',
            };
        }
        return seed;
    });

    const handleSave = (ticket: Ticket) => {
        const edit = edits[ticket.id];
        if (!edit) return;

        startTransition(async () => {
            try {
                await updateTicketStatus(ticket.id, edit.status, edit.resolution || undefined);
                toast.success(`Ticket ${ticket.ticketNumber} updated to ${edit.status}.`);
            } catch {
                toast.error(`Failed to update ${ticket.ticketNumber}.`);
            }
        });
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <LifeBuoy className="h-8 w-8 text-primary" /> Support Ticket Console
                </h1>
                <p className="text-muted-foreground mt-1 font-medium">
                    Admin discretion: users can submit tickets, admins can move them to In Progress, Resolved, or Closed.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" /> Admin Queue
                    </CardTitle>
                    <CardDescription>Update status and add a resolution note. Ticket owner is notified by email on update.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Ticket</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Subject</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Priority</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Status</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Resolution</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((ticket) => {
                                    const edit = edits[ticket.id] || { status: 'open' as TicketStatus, resolution: '' };
                                    return (
                                        <tr key={ticket.id} className="border-b align-top hover:bg-muted/40 transition-colors">
                                            <td className="p-4 font-mono text-xs">
                                                <div className="font-bold text-primary">{ticket.ticketNumber}</div>
                                                <div className="text-muted-foreground mt-1">
                                                    {ticket.createdAt
                                                        ? new Date(ticket.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                                                        : 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-4 min-w-[260px]">
                                                <div className="font-medium">{ticket.subject}</div>
                                                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ticket.description}</div>
                                            </td>
                                            <td className="p-4">
                                                <Badge className={cn("text-[10px] font-bold border", priorityColors[ticket.priority || 'medium'])}>
                                                    {ticket.priority || 'medium'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 min-w-[170px]">
                                                <div className="space-y-2">
                                                    <Badge className={cn("text-[10px] font-bold border", statusColors[edit.status])}>
                                                        {edit.status.replace('_', ' ')}
                                                    </Badge>
                                                    <select
                                                        value={edit.status}
                                                        onChange={(e) => setEdits(prev => ({
                                                            ...prev,
                                                            [ticket.id]: {
                                                                ...edit,
                                                                status: e.target.value as TicketStatus,
                                                            }
                                                        }))}
                                                        className="h-9 w-full rounded-md border bg-background px-3 text-xs"
                                                        disabled={isPending}
                                                    >
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="resolved">Resolved</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="p-4 min-w-[260px]">
                                                <Textarea
                                                    value={edit.resolution}
                                                    onChange={(e) => setEdits(prev => ({
                                                        ...prev,
                                                        [ticket.id]: {
                                                            ...edit,
                                                            resolution: e.target.value,
                                                        }
                                                    }))}
                                                    placeholder="Add closure note / resolution details"
                                                    className="min-h-[92px]"
                                                    disabled={isPending}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <Button
                                                    onClick={() => handleSave(ticket)}
                                                    disabled={isPending}
                                                    className="text-xs font-bold"
                                                >
                                                    {isPending ? 'Saving...' : 'Save Update'}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {tickets.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                                            No support tickets available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
