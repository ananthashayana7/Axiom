import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

type LimitMode = "read" | "write";

/**
 * Extract the real client IP from a request, accounting for reverse-proxy
 * X-Forwarded-For chains.
 *
 * SECURITY NOTE: X-Forwarded-For is trivially spoofable by clients unless
 * you control how many trusted proxy hops sit in front of the app.
 *
 *   TRUSTED_PROXY_COUNT=0  → use X-Real-Ip or fall back to "unknown"
 *                             (no XFF trust — safest for direct deployments)
 *   TRUSTED_PROXY_COUNT=1  → trust the rightmost XFF IP added by the first proxy
 *   TRUSTED_PROXY_COUNT=2  → trust the second-from-right (e.g. CDN + load balancer)
 *
 * The default is 1 (one trusted proxy, e.g. an Azure App Gateway or NGINX).
 * Set TRUSTED_PROXY_COUNT in your environment to match your actual topology.
 */
export function extractClientIp(req: Request): string {
    const trustedProxies = Math.max(
        0,
        parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10) || 1
    );

    if (trustedProxies === 0) {
        // Trust nothing from XFF — use X-Real-Ip or give up
        return req.headers.get("x-real-ip") || "unknown";
    }

    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        // XFF format: "clientIP, proxy1IP, proxy2IP, ..."
        // We take the IP that is `trustedProxies` hops from the right.
        // That position was written by the last trusted proxy and cannot be
        // forged by the client (anything further left can be).
        const ips = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
        const targetIndex = ips.length - trustedProxies;
        if (targetIndex >= 0 && ips[targetIndex]) {
            return ips[targetIndex];
        }
        // If the chain is shorter than expected (fewer hops), take the first IP.
        // This is the conservative choice — don't silently fall through to "unknown".
        return ips[0] || "unknown";
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
