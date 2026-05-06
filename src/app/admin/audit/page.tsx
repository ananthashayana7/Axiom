import { auth } from "@/auth";
import { getAuditLogs, getAuditStoragePosture } from "@/app/actions/activity";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    History,
    User,
    Clock,
    Database,
    ShieldCheck
} from "lucide-react";
import { AuditLogView } from "@/components/admin/audit-log-view";
import { canAccessAuditTrail } from "@/lib/rbac";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

type AuditLogRecord = {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    createdAt: string | Date;
    userName: string;
};

function formatRelativeTime(date: Date | null | undefined) {
    if (!date) {
        return "No events captured yet";
    }

    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 48) {
        return `${hours}h ago`;
    }

    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

export default async function AuditDashboard() {
    const session = await auth();
    const isAllowed = canAccessAuditTrail(session?.user);

    if (!isAllowed) {
        return (
            <div className="flex min-h-full items-center justify-center p-8">
                <Card className="w-full max-w-xl border-amber-200">
                    <CardHeader>
                        <CardTitle className="text-2xl font-black tracking-tight">Access Denied</CardTitle>
                        <CardDescription>
                            The audit trail is limited to finance and super-admin access profiles. If you need an export or investigation snapshot, contact your platform administrator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-3">
                        <Link href="/">
                            <Button>Return to workspace</Button>
                        </Link>
                        <Link href="/support">
                            <Button variant="outline">Contact administrator</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const [logs, storagePosture] = await Promise.all([
        getAuditLogs(),
        getAuditStoragePosture(),
    ]);
    const latestEventAt = logs[0]?.createdAt ? new Date(logs[0].createdAt) : null;
    const normalizedLogs: AuditLogRecord[] = logs.map((log) => ({
        ...log,
        createdAt: log.createdAt ?? new Date(0),
    }));
    const immutableEnforced = Boolean(storagePosture?.immutableEnforced);

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <History className="h-8 w-8 text-amber-600" />
                        Global Audit Trail
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Immutable record of all system-wide actions for compliance and forensics.
                    </p>
                </div>
                <Badge
                    variant="outline"
                    className={immutableEnforced
                        ? "h-10 px-4 gap-2 border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "h-10 px-4 gap-2 border-amber-200 bg-amber-50 text-amber-700"}
                >
                    <ShieldCheck className="h-4 w-4" />
                    {immutableEnforced ? "WORM Enforced" : "Storage Hardening Pending"}
                </Badge>
            </div>

            <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                <Card className="bg-gradient-to-br from-amber-600/5 to-transparent border-amber-100/50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Total Actions Captured</CardDescription>
                        <CardTitle className="text-2xl">{logs.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Last event logged {formatRelativeTime(latestEventAt)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Active Auditors</CardDescription>
                        <CardTitle className="text-2xl">
                            {new Set(logs.map((l) => l.userName)).size}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Authorized system administrators
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Entity Coverage</CardDescription>
                        <CardTitle className="text-2xl">
                            {new Set(logs.map((l) => l.entityType)).size}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Database className="h-3 w-3" /> Types of objects tracked
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-bold uppercase tracking-wider">Tamper Surface</CardDescription>
                        <CardTitle className="text-2xl">{immutableEnforced ? "Locked" : "App-only"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {immutableEnforced
                                ? "Update, delete, and truncate are blocked at the database layer for audit logs."
                                : "The app is read and export only, but the database hard lock is not yet verified."}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AuditLogView initialLogs={normalizedLogs} />
        </div>
    );
}
