import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Activity } from "lucide-react";

interface AuditLog {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    createdAt: Date | null;
    userName: string;
}

interface AuditLogListProps {
    logs: AuditLog[];
}

export function AuditLogList({ logs }: AuditLogListProps) {
    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Activity History & Audit Trail
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {logs.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No activity logged yet.
                        </p>
                    )}
                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-4 border-l-2 border-accent pl-4 pb-4 last:pb-0">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge variant={
                                        log.action === 'CREATE' ? 'default' :
                                            log.action === 'UPDATE' ? 'secondary' :
                                                log.action === 'DELETE' ? 'destructive' :
                                                    'outline'
                                    }>
                                        {log.action}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground">
                                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now'}
                                    </p>
                                </div>
                                <p className="text-sm">
                                    <span className="font-semibold">{log.userName}</span> {log.details}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
