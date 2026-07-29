'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getSupplierDashboardSnapshot } from "@/app/actions/portal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bell,
    ChevronRight,
    ClipboardList,
    Clock,
    FileCheck,
    FileText,
    MessageSquare,
    ShoppingCart,
    Sparkles,
    TriangleAlert,
    ShieldAlert,
} from "lucide-react";
import { openOrDownloadFile } from "@/lib/client/download";

type SupplierDashboardSnapshot = NonNullable<Awaited<ReturnType<typeof getSupplierDashboardSnapshot>>>;

export default function SupplierDashboard() {
    const { data: session } = useSession();
    const [snapshot, setSnapshot] = useState<SupplierDashboardSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            const data = await getSupplierDashboardSnapshot();
            if (!cancelled) {
                setSnapshot(data as SupplierDashboardSnapshot | null);
                setLoading(false);
            }
        }

        void loadData();

        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="font-medium text-muted-foreground">Loading supplier workspace...</p>
                </div>
            </div>
        );
    }

    if (!snapshot) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="max-w-md space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Workspace unavailable</h1>
                    <p className="text-muted-foreground">
                        The supplier workspace could not be loaded for this account. Refresh the page or contact the Axiom team if the issue persists.
                    </p>
                </div>
            </div>
        );
    }

    const counts = snapshot.counts;
    const notificationCount = counts.invitedRFQs + counts.openRequests;
    const healthStatus = snapshot?.healthStatus ?? 'healthy';
    const healthTone = healthStatus === 'attention'
        ? 'border-red-200 bg-red-50 text-red-800'
        : healthStatus === 'watch'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800';
    const healthTitle = healthStatus === 'attention'
        ? 'Attention required'
        : healthStatus === 'watch'
            ? 'Monitor live workflows'
            : 'Operating clean';
    const healthDescription = healthStatus === 'attention'
        ? `${counts.overdueRequests} overdue supplier request(s) are blocking the queue.`
        : healthStatus === 'watch'
            ? `${counts.openRequests} open request(s) and ${counts.dueThisWeekOrders} order(s) land in the next seven days.`
            : 'No overdue requests and no immediate delivery pressure in the current workspace snapshot.';

    return (
        <div className="flex min-h-full flex-col bg-background p-4 lg:p-8 space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Supplier Command Center</h1>
                    <p className="mt-1 text-muted-foreground">Manage live bids, active orders, compliance tasks, and the shared thread with Axiom.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2 relative" asChild>
                        <Link href="/portal/requests">
                            <Bell className="h-4 w-4" />
                            Action Queue
                            {notificationCount > 0 ? (
                                <span className="absolute -top-2 -right-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                    {notificationCount}
                                </span>
                            ) : null}
                        </Link>
                    </Button>
                </div>
            </div>

            {session?.user && !session.user.isTwoFactorEnabled && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex gap-3 items-start">
                    <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-amber-900">Secure your account with two-factor authentication</p>
                        <p className="text-xs text-amber-800">Two-factor authentication (2FA) adds an extra security layer to your account. You'll be prompted to set it up on your next login.</p>
                        <Link href="/portal/security">
                            <Button size="sm" variant="outline" className="h-7 mt-1">Learn more</Button>
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-none bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">New Invitations</CardTitle>
                        <Sparkles className="h-4 w-4 opacity-80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black">{counts.invitedRFQs}</div>
                        <p className="mt-2 text-xs opacity-80">Live RFQs currently waiting for your quote.</p>
                        <Button variant="secondary" size="sm" className="mt-4 w-full font-bold border-none transition-colors" asChild>
                            <Link href="/portal/rfqs">
                                View Invitations <ChevronRight className="ml-1 h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Active Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{counts.activeOrders}</div>
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {counts.dueThisWeekOrders > 0
                                ? `${counts.dueThisWeekOrders} order(s) due in the next 7 days`
                                : 'No deliveries due in the next 7 days'}
                        </p>
                        <Button variant="outline" size="sm" className="mt-4 w-full font-bold" asChild>
                            <Link href="/portal/orders">Track Orders</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Action Queue</CardTitle>
                        <ClipboardList className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{counts.openRequests}</div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {counts.overdueRequests > 0
                                ? `${counts.overdueRequests} overdue request(s) need a response`
                                : counts.openRequests > 0
                                    ? 'Outstanding buyer requests are ready for response'
                                    : 'No open buyer tasks at the moment'}
                        </p>
                        <Button variant="outline" size="sm" className="mt-4 w-full font-bold" asChild>
                            <Link href="/portal/requests">Open Requests</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Active Sourcing Requests
                        </CardTitle>
                        <CardDescription>Recent RFQ invitations that are open in your supplier workspace.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {snapshot.recentRfqs.length === 0 ? (
                                <div className="rounded-xl border-2 border-dashed py-12 text-center italic text-muted-foreground">
                                    No active invitations at this time.
                                </div>
                            ) : (
                                snapshot.recentRfqs.map((rfq) => (
                                    <div key={rfq.id} className="group flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted/50">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground transition-colors group-hover:text-primary">{rfq.title}</span>
                                            <span className="text-xs text-muted-foreground">Received {new Date(rfq.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant={rfq.status === 'invited' ? 'default' : 'secondary'} className="text-[10px] font-bold uppercase">
                                                {rfq.status}
                                            </Badge>
                                            <Link href={`/portal/rfqs/${rfq.id}`}>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 border border-muted-foreground/20 p-0">
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className={`border shadow-sm ${healthTone}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TriangleAlert className="h-5 w-5" />
                                Workspace Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p className="font-semibold">{healthTitle}</p>
                            <p>{healthDescription}</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-muted/20 shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <MessageSquare className="h-5 w-5 text-primary" />
                                Support Desk
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                                Need technical help, clarification on an RFQ, or coordination around an order? Open an auditable support thread with the Axiom team.
                            </p>
                            <Button className="w-full font-bold shadow-md" asChild>
                                <Link href="/support">Open Support Workspace</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                                <FileCheck className="h-4 w-4 text-primary" />
                                Recent Documents
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {snapshot.recentDocuments.length === 0 ? (
                                <>
                                    <p className="text-sm text-muted-foreground">No documents have been uploaded to your vault yet.</p>
                                    <Button variant="outline" className="w-full font-bold" asChild>
                                        <Link href="/portal/documents">Open Document Vault</Link>
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {snapshot.recentDocuments.map((document) => (
                                        <button
                                            key={document.id}
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-muted"
                                            onClick={() => {
                                                if (document.url) {
                                                    openOrDownloadFile(document.url, document.name);
                                                }
                                            }}
                                        >
                                            <div>
                                                <span className="text-sm font-medium">{document.name}</span>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {String(document.type || 'other').replace(/_/g, ' ')} · {new Date(document.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    ))}
                                    <Button variant="outline" className="w-full font-bold" asChild>
                                        <Link href="/portal/documents">View All Documents</Link>
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Latest Buyer Requests</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {snapshot.recentRequests.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No outstanding buyer requests at the moment.</p>
                            ) : (
                                snapshot.recentRequests.map((request) => (
                                    <div key={request.id} className="rounded-lg border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold">{request.title}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {String(request.requestType || 'request').replace(/_/g, ' ')}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                {String(request.status || 'unknown').replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                        {request.dueDate ? (
                                            <p className="mt-2 text-[11px] text-muted-foreground">
                                                Due {new Date(request.dueDate).toLocaleDateString()}
                                            </p>
                                        ) : null}
                                    </div>
                                ))
                            )}
                            <Button variant="outline" className="w-full font-bold" asChild>
                                <Link href="/portal/requests">Open Request Queue</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
