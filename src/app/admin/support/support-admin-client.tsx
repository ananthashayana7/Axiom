'use client'

import { useState, useTransition, useMemo } from "react";
import { updateTicketStatus } from "@/app/actions/support";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ShieldCheck, LifeBuoy, Filter, RefreshCw, CheckCircle2, Clock, AlertTriangle, X } from "lucide-react";
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

export default function SupportAdminClient({ tickets: initialTickets }: { tickets: Ticket[] }) {
    const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
    const [isPending, startTransition] = useTransition();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);

    const [edits, setEdits] = useState<Record<string, { status: TicketStatus; resolution: string }>>(() => {
        const seed: Record<string, { status: TicketStatus; resolution: string }> = {};
        for (const ticket of initialTickets) {
            seed[ticket.id] = {
                status: (ticket.status || 'open') as TicketStatus,
                resolution: ticket.resolution || '',
            };
        }
        return seed;
    });

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!t.ticketNumber?.toLowerCase().includes(q) &&
                    !t.subject?.toLowerCase().includes(q) &&
                    !t.description?.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [tickets, statusFilter, priorityFilter, searchQuery]);

    const handleSave = (ticket: Ticket) => {
        const edit = edits[ticket.id];
        if (!edit) return;

        setSavingId(ticket.id);
        startTransition(async () => {
            try {
                const updated = await updateTicketStatus(ticket.id, edit.status, edit.resolution || undefined);
                // Update local state
                setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: edit.status, resolution: edit.resolution } : t));
                toast.success(`Ticket ${ticket.ticketNumber} updated to "${edit.status.replace('_', ' ')}".`);
                if (edit.status === 'closed') {
                    toast.info(`Ticket ${ticket.ticketNumber} is now closed — it will be archived from user view.`);
                }
            } catch {
                toast.error(`Failed to update ${ticket.ticketNumber}.`);
            } finally {
                setSavingId(null);
            }
        });
    };

    // Stats
    const openCount = tickets.filter(t => t.status === 'open').length;
    const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
    const closedCount = tickets.filter(t => t.status === 'closed').length;
    const criticalCount = tickets.filter(t => t.priority === 'critical' && t.status !== 'closed').length;

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <LifeBuoy className="h-8 w-8 text-primary" /> Support Ticket Console
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium">
                        Multi-admin queue — changes by any admin are reflected in real-time. Closed tickets are archived from user view.
                    </p>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()} className="gap-2 shrink-0">
                    <RefreshCw className="h-4 w-4" /> Refresh Queue
                </Button>
            </div>

            {/* KPI Summary */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Open</p>
                        <p className="text-2xl font-black text-blue-600">{openCount}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">In Progress</p>
                        <p className="text-2xl font-black text-amber-600">{inProgressCount}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Resolved</p>
                        <p className="text-2xl font-black text-emerald-600">{resolvedCount}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-stone-400">
                    <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Closed</p>
                        <p className="text-2xl font-black text-stone-500">{closedCount}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide">Critical Open</p>
                        <p className="text-2xl font-black text-red-600">{criticalCount}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" /> Admin Queue
                            </CardTitle>
                            <CardDescription>Update status and add a resolution note. Ticket owner is notified by email on update. Closing a ticket removes it from user active view.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Search */}
                            <div className="relative">
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="Search tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-xs w-[160px]" />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                            </div>
                            {/* Status filter */}
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                className="h-8 rounded-md border bg-background px-2 text-xs">
                                <option value="all">All Statuses</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                            {/* Priority filter */}
                            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                                className="h-8 rounded-md border bg-background px-2 text-xs">
                                <option value="all">All Priorities</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Ticket</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Subject / Description</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Priority</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Status</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Resolution</th>
                                    <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground font-bold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTickets.map((ticket) => {
                                    const edit = edits[ticket.id] || { status: 'open' as TicketStatus, resolution: '' };
                                    const isClosed = edit.status === 'closed';
                                    return (
                                        <tr key={ticket.id} className={cn("border-b align-top hover:bg-muted/40 transition-colors",
                                            isClosed && "opacity-60 bg-muted/20",
                                            ticket.priority === 'critical' && edit.status !== 'closed' && "bg-red-50/30",
                                        )}>
                                            <td className="p-4 font-mono text-xs">
                                                <div className="font-bold text-primary">{ticket.ticketNumber}</div>
                                                <div className="text-muted-foreground text-[10px] mt-0.5">
                                                    {ticket.createdAt
                                                        ? new Date(ticket.createdAt).toLocaleString('en-GB', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit', hour12: false
                                                        })
                                                        : 'N/A'}
                                                </div>
                                                {ticket.category && (
                                                    <div className="text-[10px] text-muted-foreground mt-0.5 italic">{ticket.category}</div>
                                                )}
                                            </td>
                                            <td className="p-4 min-w-[260px]">
                                                <div className="font-medium text-sm">{ticket.subject}</div>
                                                <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{ticket.description}</div>
                                            </td>
                                            <td className="p-4">
                                                <Badge className={cn("text-[10px] font-bold border", priorityColors[ticket.priority || 'medium'])}>
                                                    {ticket.priority || 'medium'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 min-w-[160px]">
                                                <div className="space-y-2">
                                                    <Badge className={cn("text-[10px] font-bold border", statusColors[edit.status])}>
                                                        {edit.status.replace('_', ' ')}
                                                    </Badge>
                                                    <select
                                                        value={edit.status}
                                                        onChange={(e) => setEdits(prev => ({
                                                            ...prev,
                                                            [ticket.id]: { ...edit, status: e.target.value as TicketStatus }
                                                        }))}
                                                        className="h-9 w-full rounded-md border bg-background px-3 text-xs"
                                                        disabled={isPending && savingId === ticket.id}
                                                    >
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="resolved">Resolved</option>
                                                        <option value="closed">Close & Archive</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="p-4 min-w-[240px]">
                                                <Textarea
                                                    value={edit.resolution}
                                                    onChange={(e) => setEdits(prev => ({
                                                        ...prev,
                                                        [ticket.id]: { ...edit, resolution: e.target.value }
                                                    }))}
                                                    placeholder="Add resolution notes (sent to user by email)"
                                                    className="min-h-[80px] text-xs"
                                                    disabled={isPending && savingId === ticket.id}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <Button
                                                    onClick={() => handleSave(ticket)}
                                                    disabled={isPending && savingId === ticket.id}
                                                    size="sm"
                                                    className={cn("text-xs font-bold w-full",
                                                        edit.status === 'closed' && "bg-stone-600 hover:bg-stone-700"
                                                    )}
                                                >
                                                    {isPending && savingId === ticket.id ? (
                                                        <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Saving</span>
                                                    ) : edit.status === 'closed' ? (
                                                        <span className="flex items-center gap-1"><X className="h-3 w-3" /> Close</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Update</span>
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTickets.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-10 text-center text-muted-foreground italic">
                                            {tickets.length === 0 ? "No support tickets in the system." : "No tickets match the current filters."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                        Showing {filteredTickets.length} of {tickets.length} ticket(s)
                        {statusFilter !== 'all' && ` · Status: ${statusFilter}`}
                        {priorityFilter !== 'all' && ` · Priority: ${priorityFilter}`}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
