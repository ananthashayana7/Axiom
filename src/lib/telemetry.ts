import { db } from "@/db";
import { systemTelemetry } from "@/db/schema";

export type TelemetryType = 'event' | 'metric' | 'error' | 'security';

export class TelemetryService {
    /**
     * Tracks a general event or action
     */
    static async trackEvent(scope: string, key: string, metadata?: any) {
        return this.log('event', scope, key, null, metadata);
    }

    /**
     * Tracks a numerical metric (latency, count, etc.)
     */
    static async trackMetric(scope: string, key: string, value: number, metadata?: any) {
        return this.log('metric', scope, key, value, metadata);
    }

    /**
     * Tracks a technical error
     */
    static async trackError(scope: string, key: string, error: any, metadata?: any) {
        const errorMetadata = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            ...metadata
        };
        return this.log('error', scope, key, null, errorMetadata);
    }

    /**
     * Internal logging method
     */
    private static async log(
        type: TelemetryType,
        scope: string,
        key: string,
        value: number | null,
        metadata?: any
    ) {
        // Run DB insert in background (fire-and-forget) to not block/delay HTTP responses or database transactions
        const logPromise = (async () => {
            try {
                const userId = metadata?.userId;

                await db.insert(systemTelemetry).values({
                    type,
                    scope,
                    key,
                    value: value !== null ? value.toString() : null,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    userId: userId || null,
                });

                if (type === 'error') {
                    console.error(`[Telemetry Error] [${scope}] ${key}:`, metadata);
                }
            } catch (err) {
                console.error("Telemetry failed to log in background:", err);
            }
        })();

        // Keep it safe by catching any unhandled rejection
        logPromise.catch(() => {});
    }

    /**
     * Helper to time a function execution
     */
    static async time<T>(scope: string, key: string, fn: () => Promise<T>, metadata?: any): Promise<T> {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            await this.trackMetric(scope, `${key}_latency_ms`, duration, metadata);
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            await this.trackMetric(scope, `${key}_failure_latency_ms`, duration, metadata);
            await this.trackError(scope, `${key}_failure`, error, metadata);
            throw error;
        }
    }
}
