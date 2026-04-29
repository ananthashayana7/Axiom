import { Activity, Mail, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TimelineEntry = {
    id: string;
    action: string;
    details: string;
    createdAt: Date | null;
    userName: string | null;
};

function getTimelineIcon(action: string) {
    if (action === 'MESSAGE') {
        return Mail;
    }

    if (action === 'UPDATE' || action === 'DELETE' || action === 'CREATE') {
        return ShieldCheck;
    }

    return Activity;
}

function getBadgeVariant(action: string) {
    if (action === 'DELETE') return 'destructive' as const;
    if (action === 'CREATE') return 'default' as const;
    if (action === 'MESSAGE') return 'secondary' as const;
    return 'outline' as const;
}

export function TimelineList({
    entries,
    title = "Operational Timeline",
    description = "Every major system event tied to this record is stamped with who changed it and when.",
}: {
    entries: TimelineEntry[];
    title?: string;
    description?: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {entries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No timeline events logged yet.
                    </p>
                ) : (
                    entries.map((entry) => {
                        const Icon = getTimelineIcon(entry.action);

                        return (
                            <div key={entry.id} className="flex gap-4 rounded-2xl border bg-background/60 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={getBadgeVariant(entry.action)}>{entry.action}</Badge>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Just now'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{entry.userName || 'Axiom'}</p>
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.details}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
