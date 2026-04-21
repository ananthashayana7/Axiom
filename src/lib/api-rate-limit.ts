import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type LimitMode = "read" | "write";

export function extractClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp;

    return "unknown";
}

export async function enforceRateLimit(req: Request, mode: LimitMode, userKey?: string): Promise<NextResponse | null> {
    const ip = extractClientIp(req);
    const scope = userKey ? `user:${userKey}` : `ip:${ip}`;
    const result = await consumeRateLimit(mode, scope);

    if (!result.allowed) {
        return rateLimitResponse(result.retryAfterMs ?? 60_000);
    }

    return null;
}
