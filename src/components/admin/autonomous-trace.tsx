'use client'

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Activity, Database, Network } from "lucide-react";

interface TraceLog {
    id: string;
    timestamp: string;
    agent: string;
    action: string;
    status: 'INIT' | 'PROC' | 'EVAL' | 'EXEC' | 'COMP';
    details: string;
}

const AGENTS = [
    'DemandForecaster',
    'FraudDetector',
    'PaymentOptimizer',
    'AutoRemediator',
    'ContractAuditor',
    'EcoSystemMapper'
];

const ACTIONS = [
    'Syncing ledger data',
    'Cross-referencing vendor IDs',
    'Evaluating discount capture',
    'Detecting workflow stalls',
    'Semantic clause comparison',
    'Graphing supplier clusters'
];

const LIVE_STATUSES: TraceLog['status'][] = ['INIT', 'PROC', 'EVAL', 'EXEC'];
const PLACEHOLDER_TRACE_ROWS = Array.from({ length: 5 }, (_, index) => ({
    id: `placeholder-${index + 1}`,
    timestamp: '--:--:--',
    agent: AGENTS[index % AGENTS.length],
    action: ACTIONS[index % ACTIONS.length],
    status: 'INIT' as const,
    details: 'Awaiting live trace sync.',
}));

function formatTraceTimestamp(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date);
}

function createSeedLogs(): TraceLog[] {
    const now = Date.now();

    return Array.from({ length: 5 }).map((_, index) => ({
        id: `trace-seed-${index + 1}`,
        timestamp: formatTraceTimestamp(new Date(now - (5 - index) * 60000)),
        agent: AGENTS[index % AGENTS.length],
        action: ACTIONS[index % ACTIONS.length],
        status: 'COMP',
        details: 'Execution verified. No drift detected.',
    }));
}

function createLiveTraceLog(sequence: number): TraceLog {
    return {
        id: `trace-live-${sequence}`,
        timestamp: formatTraceTimestamp(new Date()),
        agent: AGENTS[Math.floor(Math.random() * AGENTS.length)],
        action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
        status: LIVE_STATUSES[Math.floor(Math.random() * LIVE_STATUSES.length)],
        details: 'Background optimization cycle active.',
    };
}

export function AutonomousTrace() {
    const [logs, setLogs] = useState<TraceLog[]>(PLACEHOLDER_TRACE_ROWS);

    useEffect(() => {
        let sequence = 0;
        const bootstrapTimeout = window.setTimeout(() => {
            setLogs(createSeedLogs());
        }, 0);

        // Add periodic new logs
        const interval = setInterval(() => {
            sequence += 1;
            const newLog = createLiveTraceLog(sequence);
            setLogs(prev => [newLog, ...prev].slice(0, 10));
        }, 5000);

        return () => {
            window.clearTimeout(bootstrapTimeout);
            clearInterval(interval);
        };
    }, []);

    return (
        <Card className="bg-stone-950 border-stone-800 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-stone-800 bg-stone-900/50 py-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-emerald-500" />
                        Live Autonomous Trace
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-mono text-emerald-500/70 font-bold">SYSTEM_STABLE</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-stone-700 text-stone-500 px-1.5 py-0 h-5">
                            TPS: 2.4k
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="font-mono text-[11px] leading-relaxed">
                    <div className="grid grid-cols-12 bg-stone-900/30 border-b border-stone-800 py-2 px-4 text-stone-500 font-bold">
                        <div className="col-span-2">TIMESTAMP</div>
                        <div className="col-span-3">AGENT_ID</div>
                        <div className="col-span-2">STATUS</div>
                        <div className="col-span-5">TRACE_OUTPUT</div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-800">
                        {logs.map((log) => (
                            <div key={log.id} className="grid grid-cols-12 py-2 px-4 border-b border-stone-900/50 hover:bg-stone-900/20 transition-colors group">
                                <div className="col-span-2 text-stone-600 group-hover:text-stone-400">{log.timestamp}</div>
                                <div className="col-span-3 text-indigo-400 font-bold">{log.agent}</div>
                                <div className="col-span-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${log.status === 'COMP' ? 'bg-emerald-500/10 text-emerald-500' :
                                            log.status === 'INIT' ? 'bg-blue-500/10 text-blue-500' :
                                                'bg-amber-500/10 text-amber-500'
                                        }`}>
                                        {log.status}
                                    </span>
                                </div>
                                <div className="col-span-5 text-stone-400 italic">
                                    {log.action} <span className="text-stone-700 opacity-50 ml-2">... {log.details}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-stone-900/80 p-3 border-t border-stone-800 flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Activity className="h-3 w-3" /> CPU: 12%
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Database className="h-3 w-3" /> IO: 0.4ms
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500">
                            <Network className="h-3 w-3" /> NET: 1.2GB/s
                        </div>
                    </div>
                    <p className="text-[9px] font-mono text-stone-600">AXIOM_KERNEL_V4.2_STABLE</p>
                </div>
            </CardContent>
        </Card>
    );
}
