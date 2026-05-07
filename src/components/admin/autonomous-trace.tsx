import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Network, Terminal } from "lucide-react";
import { getAgentExecutionTraceSnapshot } from "@/lib/agent-executions";

function formatTraceTimestamp(value: string | null) {
    if (!value) {
        return "--:--:--";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "--:--:--";
    }

    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

function statusClasses(status: string) {
    switch (status) {
        case "success":
            return "bg-emerald-500/10 text-emerald-500";
        case "failed":
            return "bg-rose-500/10 text-rose-500";
        case "running":
            return "bg-blue-500/10 text-blue-500";
        case "cancelled":
            return "bg-stone-500/10 text-stone-400";
        default:
            return "bg-amber-500/10 text-amber-500";
    }
}

export async function AutonomousTrace() {
    const snapshot = await getAgentExecutionTraceSnapshot();

    return (
        <Card className="overflow-hidden border-stone-800 bg-stone-950 shadow-2xl">
            <CardHeader className="border-b border-stone-800 bg-stone-900/50 py-3">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-stone-400">
                        <Terminal className="h-4 w-4 text-emerald-500" />
                        Agent Execution Trace
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className={`h-1.5 w-1.5 rounded-full ${snapshot.summary.runningNow > 0 ? "animate-pulse bg-blue-500" : "bg-emerald-500"}`} />
                            <span className="text-[10px] font-bold text-stone-500">
                                {snapshot.summary.runningNow > 0 ? `${snapshot.summary.runningNow} RUNNING_NOW` : "WORKSPACE_IDLE"}
                            </span>
                        </div>
                        <Badge variant="outline" className="h-5 border-stone-700 px-1.5 py-0 text-[10px] font-mono text-stone-500">
                            RUNS_24H: {snapshot.summary.totalRuns}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="font-mono text-[11px] leading-relaxed">
                    <div className="grid grid-cols-12 border-b border-stone-800 bg-stone-900/30 px-4 py-2 font-bold text-stone-500">
                        <div className="col-span-2">TIMESTAMP</div>
                        <div className="col-span-3">AGENT_ID</div>
                        <div className="col-span-2">STATUS</div>
                        <div className="col-span-5">TRACE_OUTPUT</div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800">
                        {snapshot.rows.length === 0 ? (
                            <div className="px-4 py-8 text-center text-stone-500">
                                No agent executions have been recorded yet. Run an agent from the catalog and this trace will populate from the live database.
                            </div>
                        ) : (
                            snapshot.rows.map((row) => (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-12 border-b border-stone-900/50 px-4 py-2 transition-colors hover:bg-stone-900/20 group"
                                >
                                    <div className="col-span-2 text-stone-600 group-hover:text-stone-400">
                                        {formatTraceTimestamp(row.createdAt)}
                                    </div>
                                    <div className="col-span-3">
                                        <div className="font-bold text-indigo-400">{row.agentName}</div>
                                        <div className="text-[10px] text-stone-600">
                                            {row.triggeredBy || "manual"}
                                            {row.actorName ? ` · ${row.actorName}` : ""}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${statusClasses(row.status)}`}>
                                            {row.status}
                                        </span>
                                    </div>
                                    <div className="col-span-5 text-stone-400">
                                        <div className="font-semibold not-italic text-stone-300">{row.summary.headline}</div>
                                        <div className="mt-1 text-stone-500">
                                            {row.summary.details}
                                            {row.executionTimeMs ? ` · ${row.executionTimeMs}ms` : ""}
                                            {row.confidenceScore !== null ? ` · confidence ${row.confidenceScore}` : ""}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/80 p-3">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Activity className="h-3 w-3" /> SUCCESS: {snapshot.summary.successfulRuns}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Database className="h-3 w-3" /> AVG: {snapshot.summary.avgLatencyMs}ms
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Network className="h-3 w-3" /> ERRORS: {snapshot.summary.telemetryErrors}
                        </div>
                    </div>
                    <p className="text-[9px] font-mono text-stone-600">
                        FAILURES_24H: {snapshot.summary.failedRuns}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
