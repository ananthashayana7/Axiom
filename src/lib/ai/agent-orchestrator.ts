/**
 * AI Agent Orchestrator
 * Central orchestration layer for all Axiom AI agents
 * Handles execution, retries, fallbacks, and agent chaining
 */

'use server'

import { auth } from "@/auth";
import { TelemetryService } from "@/lib/telemetry";
import type {
    AgentMetadata,
    AgentResult,
    AgentContext,
    AgentExecutionOptions,
    AgentChain,
    AgentCategory
} from "./agent-types";

// Agent Registry - Central storage for all registered agents
const agentRegistry = new Map<string, RegisteredAgent>();

interface RegisteredAgent {
    metadata: AgentMetadata;
    executor: (context: AgentContext, input: unknown) => Promise<AgentResult>;
}

function validateAgentInput(agentName: string, input: unknown, schema?: unknown): {
    ok: boolean;
    data?: unknown;
    error?: string;
} {
    const maybeZod = schema as {
        safeParse?: (data: unknown) => { success: boolean; data?: unknown; error?: { issues?: Array<{ path: (string | number)[]; message: string }> } };
    } | undefined;

    if (maybeZod?.safeParse) {
        const parsed = maybeZod.safeParse(input);
        if (!parsed.success) {
            const details = parsed.error?.issues?.slice(0, 2)?.map(issue => `${issue.path.join('.') || 'input'}: ${issue.message}`)?.join('; ');
            return {
                ok: false,
                error: `Invalid input for ${agentName}${details ? ` (${details})` : ''}`
            };
        }
        return { ok: true, data: parsed.data };
    }

    return { ok: true, data: input };
}

/**
 * Register an agent with the orchestrator
 */
export function registerAgent(
    metadata: AgentMetadata,
    executor: (context: AgentContext, input: unknown) => Promise<AgentResult>
): void {
    if (agentRegistry.has(metadata.name)) {
        console.warn(`Agent ${metadata.name} is already registered. Overwriting.`);
    }
    agentRegistry.set(metadata.name, { metadata, executor });
    console.log(`✅ Agent registered: ${metadata.name} (v${metadata.version})`);
}

/**
 * Get all registered agents
 */
export async function getRegisteredAgents(): Promise<AgentMetadata[]> {
    return Array.from(agentRegistry.values()).map(a => a.metadata);
}

/**
 * Get agents by category
 */
export async function getAgentsByCategory(category: AgentCategory): Promise<AgentMetadata[]> {
    return Array.from(agentRegistry.values())
        .filter(a => a.metadata.category === category)
        .map(a => a.metadata);
}

/**
 * Execute an agent with full orchestration
 */
export async function executeAgent<T = unknown>(
    agentName: string,
    input: unknown,
    options: AgentExecutionOptions = {}
): Promise<AgentResult<T>> {
    const session = await auth();
    const startTime = Date.now();

    // Create execution context
    const context: AgentContext = {
        userId: session?.user ? (session.user as { id: string }).id : undefined,
        sessionId: crypto.randomUUID(),
        triggeredBy: 'manual',
        metadata: {}
    };

    const agent = agentRegistry.get(agentName);

    if (!agent) {
        return {
            success: false,
            error: `Agent "${agentName}" not found in registry`,
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName,
            timestamp: new Date()
        };
    }

    if (!agent.metadata.isEnabled) {
        return {
            success: false,
            error: `Agent "${agentName}" is currently disabled`,
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName,
            timestamp: new Date()
        };
    }

    const validation = validateAgentInput(agentName, input, agent.metadata.inputSchema);
    if (!validation.ok) {
        const failedResult: AgentResult<T> = {
            success: false,
            error: validation.error ?? 'Input validation failed',
            confidence: 0,
            executionTimeMs: Date.now() - startTime,
            agentName,
            timestamp: new Date()
        };

        await TelemetryService.trackError('AgentOrchestrator', `${agentName}_validation_failed`, new Error(failedResult.error), {
            userId: context.userId
        });

        await logAgentExecution({
            agentName,
            status: 'failed',
            inputContext: JSON.stringify(input),
            errorMessage: failedResult.error,
            executionTimeMs: failedResult.executionTimeMs,
            triggeredBy: context.triggeredBy,
            userId: context.userId
        });

        return failedResult;
    }

    const sanitizedInput = validation.data;
    const maxRetries = options.maxRetries ?? agent.metadata.maxRetries ?? 2;
    const timeoutMs = options.timeoutMs ?? agent.metadata.timeoutMs ?? 30000;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
        attempt++;

        try {
            // Execute with timeout
            const result = await Promise.race([
                agent.executor(context, sanitizedInput),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Agent execution timed out')), timeoutMs)
                )
            ]);

            // Log successful execution
            await logAgentExecution({
                agentName,
                status: 'success',
                inputContext: JSON.stringify(sanitizedInput),
                outputData: JSON.stringify(result.data),
                confidenceScore: result.confidence,
                tokenUsage: result.tokenUsage,
                executionTimeMs: result.executionTimeMs,
                triggeredBy: context.triggeredBy,
                userId: context.userId
            });

            // Track telemetry
            await TelemetryService.trackMetric(
                'AgentOrchestrator',
                `${agentName}_success`,
                result.executionTimeMs
            );

            return result as AgentResult<T>;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            console.warn(`Agent ${agentName} attempt ${attempt}/${maxRetries + 1} failed:`, lastError.message);

            if (attempt <= maxRetries) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
            }
        }
    }

    // All retries exhausted
    const errorResult: AgentResult<T> = {
        success: false,
        error: lastError?.message ?? 'Unknown error occurred',
        confidence: 0,
        executionTimeMs: Date.now() - startTime,
        agentName,
        timestamp: new Date()
    };

    // Log failed execution
    await logAgentExecution({
        agentName,
        status: 'failed',
        inputContext: JSON.stringify(sanitizedInput),
        errorMessage: errorResult.error,
        executionTimeMs: errorResult.executionTimeMs,
        triggeredBy: context.triggeredBy,
        userId: context.userId
    });

    await TelemetryService.trackError(
        'AgentOrchestrator',
        `${agentName}_failed`,
        lastError ?? new Error('Unknown'),
        { attempts: attempt }
    );

    return errorResult;
}

/**
 * Execute a chain of agents
 */
export async function executeAgentChain<T = unknown>(
    chain: AgentChain,
    initialInput: unknown
): Promise<AgentResult<T>> {
    const startTime = Date.now();
    let currentInput = initialInput;
    let previousResult: AgentResult | null = null;

    for (const step of chain.steps) {
        // Check condition if specified
        if (step.condition && previousResult) {
            try {
                // Safe evaluation of simple conditions
                const conditionMet = evaluateCondition(step.condition, previousResult);
                if (!conditionMet) {
                    console.log(`Skipping agent ${step.agentName} - condition not met`);
                    continue;
                }
            } catch (e) {
                console.warn(`Failed to evaluate condition for ${step.agentName}:`, e);
            }
        }

        // Map input if specified
        if (step.inputMapping && previousResult?.data) {
            currentInput = mapAgentInput(step.inputMapping, previousResult.data as Record<string, unknown>);
        }

        // Execute the agent
        const result = await executeAgent(step.agentName, currentInput);

        if (!result.success) {
            if (step.onFailure === 'abort') {
                return {
                    ...result,
                    error: `Chain aborted at ${step.agentName}: ${result.error}`,
                    executionTimeMs: Date.now() - startTime
                } as AgentResult<T>;
            } else if (step.onFailure === 'continue') {
                console.warn(`Agent ${step.agentName} failed but continuing chain`);
            } else if (step.onFailure) {
                // Execute fallback agent
                const fallbackResult = await executeAgent(step.onFailure, currentInput);
                if (fallbackResult.success) {
                    previousResult = fallbackResult;
                    currentInput = fallbackResult.data;
                    continue;
                }
            }
        }

        previousResult = result;
        currentInput = result.data;
    }

    return {
        success: true,
        data: currentInput as T,
        confidence: previousResult?.confidence ?? 0,
        executionTimeMs: Date.now() - startTime,
        agentName: chain.name,
        timestamp: new Date(),
        reasoning: `Chain "${chain.name}" completed with ${chain.steps.length} steps`
    };
}

/**
 * Get agent execution statistics
 */
export async function getAgentStats(agentName?: string, _days: number = 7): Promise<{
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    avgConfidence: number;
    topErrors: { error: string; count: number }[];
}> {
    // This would query the agent_executions table
    // For now, returning mock stats
    return {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        avgConfidence: 0,
        topErrors: []
    };
}

// Helper: Log agent execution to database
async function logAgentExecution(log: {
    agentName: string;
    status: string;
    inputContext: string;
    outputData?: string;
    confidenceScore?: number;
    tokenUsage?: number;
    executionTimeMs: number;
    errorMessage?: string;
    triggeredBy: string;
    userId?: string;
}): Promise<void> {
    try {
        // We'll add the actual DB insert once schema is updated
        await TelemetryService.trackEvent('AgentExecution', log.agentName, {
            status: log.status,
            executionTimeMs: log.executionTimeMs,
            confidence: log.confidenceScore
        });
    } catch (error) {
        console.error('Failed to log agent execution:', error);
    }
}

// Helper: Evaluate simple conditions
function evaluateCondition(condition: string, result: AgentResult): boolean {
    // Safe evaluation of simple conditions like "result.confidence > 70"
    if (condition.includes('confidence')) {
        const match = condition.match(/>(\d+)/);
        if (match) {
            return result.confidence > parseInt(match[1]);
        }
    }
    if (condition.includes('success')) {
        return result.success;
    }
    return true;
}

// Helper: Map input from previous agent output
function mapAgentInput(
    mapping: Record<string, string>,
    previousOutput: Record<string, unknown>
): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    for (const [targetKey, sourceKey] of Object.entries(mapping)) {
        if (Object.prototype.hasOwnProperty.call(previousOutput, sourceKey)) {
            mapped[targetKey] = previousOutput[sourceKey];
        } else {
            console.warn(`Input mapping warning: "${sourceKey}" not found on previous output for target "${targetKey}"`);
        }
    }
    return mapped;
}

/**
 * Create a recommendation for user review
 */
export async function createAgentRecommendation(recommendation: {
    agentName: string;
    recommendationType: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    estimatedSavings?: number;
    actionPayload?: unknown;
    expiresInDays?: number;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        // We'll add the actual DB insert once schema is updated
        await TelemetryService.trackEvent('AgentRecommendation', recommendation.agentName, {
            type: recommendation.recommendationType,
            impact: recommendation.impact,
            savings: recommendation.estimatedSavings
        });

        return { success: true, id: crypto.randomUUID() };
    } catch (error) {
        console.error('Failed to create recommendation:', error);
        return { success: false, error: 'Failed to create recommendation' };
    }
}

/**
 * Get pending recommendations for the current user
 */
export async function getPendingRecommendations(): Promise<{
    id: string;
    agentName: string;
    title: string;
    description: string;
    impact: string;
    estimatedSavings?: number;
    createdAt: Date;
}[]> {
    // Will be implemented with schema update
    return [];
}

/**
 * Approve or dismiss a recommendation
 */
export async function reviewRecommendation(
    recommendationId: string,
    action: 'approve' | 'dismiss'
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // Will be implemented with schema update
        await TelemetryService.trackEvent('RecommendationReview', action, {
            recommendationId
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to review recommendation:', error);
        return { success: false, error: 'Failed to process review' };
    }
}
