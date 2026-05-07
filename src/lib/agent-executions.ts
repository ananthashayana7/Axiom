import { db } from "@/db";
import { agentExecutions, systemTelemetry, users } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { AgentResult } from "@/lib/ai/agent-types";

type ExecutionStatus = "queued" | "running" | "success" | "failed" | "cancelled";

type ExecutionSummary = {
    headline: string;
    details: string;
};

export interface AgentExecutionTraceRow {
    id: string;
    agentName: string;
    status: ExecutionStatus;
    triggeredBy: string | null;
    actorName: string | null;
    createdAt: string | null;
    completedAt: string | null;
    executionTimeMs: number | null;
    confidenceScore: number | null;
    summary: ExecutionSummary;
}

export interface AgentExecutionTraceSnapshot {
    generatedAt: string;
    rows: AgentExecutionTraceRow[];
    summary: {
        totalRuns: number;
        successfulRuns: number;
        failedRuns: number;
        runningNow: number;
        avgLatencyMs: number;
        telemetryErrors: number;
    };
}

function titleCaseAgentName(agentName: string) {
    return agentName
        .split("-")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
    if (!value?.trim()) {
        return null;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function buildResultPreview(data: unknown) {
    if (Array.isArray(data)) {
        return {
            kind: "array",
            count: data.length,
        };
    }

    if (data && typeof data === "object") {
        const keys = Object.keys(data as Record<string, unknown>);
        return {
            kind: "object",
            keys: keys.slice(0, 8),
            keyCount: keys.length,
        };
    }

    return data ?? null;
}

function summarizeLegacyPayload(agentName: string, parsed: Record<string, unknown>) {
    if (typeof parsed.alerts === "number") {
        return {
            headline: `${parsed.alerts} alert${parsed.alerts === 1 ? "" : "s"} surfaced`,
            details: `The latest ${titleCaseAgentName(agentName)} run returned ${parsed.alerts} alert-level records.`,
        } satisfies ExecutionSummary;
    }

    if (typeof parsed.recommendations === "number") {
        return {
            headline: `${parsed.recommendations} recommendation${parsed.recommendations === 1 ? "" : "s"} generated`,
            details: `The latest ${titleCaseAgentName(agentName)} run generated ${parsed.recommendations} actionable recommendations.`,
        } satisfies ExecutionSummary;
    }

    if (typeof parsed.opportunities === "number") {
        return {
            headline: `${parsed.opportunities} opportunity${parsed.opportunities === 1 ? "" : "ies"} detected`,
            details: `The latest ${titleCaseAgentName(agentName)} run returned ${parsed.opportunities} optimization opportunities.`,
        } satisfies ExecutionSummary;
    }

    if (typeof parsed.outcomes === "number") {
        return {
            headline: `${parsed.outcomes} projected outcome lines`,
            details: `The latest ${titleCaseAgentName(agentName)} run produced ${parsed.outcomes} scenario outcome lines.`,
        } satisfies ExecutionSummary;
    }

    return null;
}

function summarizeExecutionOutput(
    agentName: string,
    status: ExecutionStatus,
    outputData: string | null | undefined,
    errorMessage: string | null | undefined,
): ExecutionSummary {
    if (status === "running") {
        return {
            headline: "Execution in progress",
            details: `${titleCaseAgentName(agentName)} is currently running against the active workspace context.`,
        };
    }

    if (status === "failed") {
        return {
            headline: "Execution failed",
            details: errorMessage || `${titleCaseAgentName(agentName)} did not complete successfully.`,
        };
    }

    const parsed = safeJsonParse<Record<string, unknown>>(outputData);

    if (parsed) {
        const parsedSummary = parsed.summary as Partial<ExecutionSummary> | undefined;
        if (parsedSummary?.headline && parsedSummary.details) {
            return {
                headline: parsedSummary.headline,
                details: parsedSummary.details,
            };
        }

        if (typeof parsed.reasoning === "string" && parsed.reasoning.trim()) {
            return {
                headline: status === "success" ? "Execution completed" : "Execution updated",
                details: parsed.reasoning.trim(),
            };
        }

        const legacySummary = summarizeLegacyPayload(agentName, parsed);
        if (legacySummary) {
            return legacySummary;
        }
    }

    if (status === "success") {
        return {
            headline: "Execution completed",
            details: `${titleCaseAgentName(agentName)} finished successfully and persisted a stable result.`,
        };
    }

    return {
        headline: "Execution updated",
        details: `${titleCaseAgentName(agentName)} changed state to ${status}.`,
    };
}

export async function createAgentExecutionRun(options: {
    agentName: string;
    userId?: string | null;
    triggeredBy?: string | null;
    inputContext?: Record<string, unknown>;
}) {
    try {
        const [record] = await db.insert(agentExecutions).values({
            agentName: options.agentName,
            status: "running",
            inputContext: options.inputContext ? JSON.stringify(options.inputContext) : null,
            triggeredBy: options.triggeredBy || "manual",
            userId: options.userId || null,
        }).returning({ id: agentExecutions.id });

        return record?.id ?? null;
    } catch (error) {
        console.warn("[AgentExecutions] Failed to create execution row", error);
        return null;
    }
}

export async function completeAgentExecutionRun(options: {
    executionId: string | null;
    status: "success" | "failed" | "cancelled";
    result?: AgentResult<unknown>;
    summary?: ExecutionSummary;
    errorMessage?: string;
    attempts?: number;
}) {
    if (!options.executionId) {
        return;
    }

    const payload = options.result ? {
        summary: options.summary,
        reasoning: options.result.reasoning || null,
        sources: options.result.sources || [],
        attempts: options.attempts ?? 1,
        dataPreview: buildResultPreview(options.result.data),
    } : {
        summary: options.summary,
        attempts: options.attempts ?? 1,
    };

    try {
        await db.update(agentExecutions)
            .set({
                status: options.status,
                outputData: JSON.stringify(payload),
                confidenceScore: options.result?.confidence ?? null,
                tokenUsage: options.result?.tokenUsage ?? null,
                executionTimeMs: options.result?.executionTimeMs ?? null,
                errorMessage: options.errorMessage || options.result?.error || null,
                completedAt: new Date(),
            })
            .where(eq(agentExecutions.id, options.executionId));
    } catch (error) {
        console.warn("[AgentExecutions] Failed to complete execution row", error);
    }
}

export async function getAgentExecutionTraceSnapshot(): Promise<AgentExecutionTraceSnapshot> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [executionRows, summaryRows, telemetryRows] = await Promise.all([
        db.select({
            id: agentExecutions.id,
            agentName: agentExecutions.agentName,
            status: agentExecutions.status,
            triggeredBy: agentExecutions.triggeredBy,
            actorName: users.name,
            createdAt: agentExecutions.createdAt,
            completedAt: agentExecutions.completedAt,
            executionTimeMs: agentExecutions.executionTimeMs,
            confidenceScore: agentExecutions.confidenceScore,
            outputData: agentExecutions.outputData,
            errorMessage: agentExecutions.errorMessage,
        })
            .from(agentExecutions)
            .leftJoin(users, eq(agentExecutions.userId, users.id))
            .orderBy(desc(agentExecutions.createdAt))
            .limit(12),
        db.select({
            totalRuns: sql<number>`count(*)::int`,
            successfulRuns: sql<number>`coalesce(sum(case when ${agentExecutions.status} = 'success' then 1 else 0 end), 0)::int`,
            failedRuns: sql<number>`coalesce(sum(case when ${agentExecutions.status} = 'failed' then 1 else 0 end), 0)::int`,
            runningNow: sql<number>`coalesce(sum(case when ${agentExecutions.status} = 'running' then 1 else 0 end), 0)::int`,
            avgLatencyMs: sql<number>`coalesce(avg(${agentExecutions.executionTimeMs}), 0)`,
        })
            .from(agentExecutions)
            .where(gte(agentExecutions.createdAt, last24Hours)),
        db.select({
            telemetryErrors: sql<number>`count(*)::int`,
        })
            .from(systemTelemetry)
            .where(and(
                eq(systemTelemetry.type, "error"),
                gte(systemTelemetry.createdAt, last24Hours),
                sql`(
                    lower(${systemTelemetry.scope}) like '%agent%'
                    or ${systemTelemetry.scope} = 'AgentDispatch'
                    or ${systemTelemetry.scope} = 'SmartApprovalRouting'
                )`,
            )),
    ]);

    const summary = summaryRows[0] ?? {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        runningNow: 0,
        avgLatencyMs: 0,
    };
    const telemetry = telemetryRows[0] ?? { telemetryErrors: 0 };

    return {
        generatedAt: new Date().toISOString(),
        rows: executionRows.map((row) => ({
            id: row.id,
            agentName: row.agentName,
            status: row.status,
            triggeredBy: row.triggeredBy,
            actorName: row.actorName || null,
            createdAt: row.createdAt ? row.createdAt.toISOString() : null,
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
            executionTimeMs: row.executionTimeMs ?? null,
            confidenceScore: row.confidenceScore ?? null,
            summary: summarizeExecutionOutput(
                row.agentName,
                row.status,
                row.outputData,
                row.errorMessage,
            ),
        })),
        summary: {
            totalRuns: Number(summary.totalRuns || 0),
            successfulRuns: Number(summary.successfulRuns || 0),
            failedRuns: Number(summary.failedRuns || 0),
            runningNow: Number(summary.runningNow || 0),
            avgLatencyMs: Math.round(Number(summary.avgLatencyMs || 0)),
            telemetryErrors: Number(telemetry.telemetryErrors || 0),
        },
    };
}
