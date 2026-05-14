import { consumeRateLimit, type RateLimitName } from "@/lib/rate-limit";

type ServerActionRateLimitOptions = {
    mode?: RateLimitName;
    cost?: number;
};

export async function enforceServerActionRateLimit(
    actionName: string,
    userId: string | null | undefined,
    options: ServerActionRateLimitOptions = {},
) {
    const scope = userId ? `user:${userId}` : "user:anonymous";
    const result = await consumeRateLimit(
        options.mode ?? "write",
        `server-action:${actionName}:${scope}`,
        options.cost ?? 1,
    );

    if (result.allowed) {
        return null;
    }

    const retryAfterMs = result.retryAfterMs ?? 60_000;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return {
        retryAfterMs,
        message: `Too many requests. Please retry in ${retryAfterSeconds} seconds.`,
    };
}
