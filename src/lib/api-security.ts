import crypto from "node:crypto";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;

type AllowedRole = "admin" | "user" | "supplier";

export type ApiSessionUser = {
    id: string;
    role?: string | null;
    supplierId?: string | null;
    email?: string | null;
    name?: string | null;
};

export function jsonError(error: string, status: number = 400) {
    return NextResponse.json({ error }, { status });
}

export class RequestBodyError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "RequestBodyError";
        this.status = status;
    }
}

export async function requireApiUser(roles?: AllowedRole[]) {
    const session = await auth();
    const user = session?.user as ApiSessionUser | undefined;

    if (!user?.id) {
        return { user: null, response: jsonError("Unauthorized", 401) };
    }

    if (roles?.length && !roles.includes(user.role as AllowedRole)) {
        return { user: null, response: jsonError("Forbidden", 403) };
    }

    return { user, response: null };
}

function hash(value: string) {
    return crypto.createHash("sha256").update(value).digest();
}

function secureCompare(candidate: string | null | undefined, expected: string | null | undefined) {
    if (!candidate || !expected) return false;
    return crypto.timingSafeEqual(hash(candidate), hash(expected));
}

export function isCronAuthorized(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;

    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const header = req.headers.get("x-cron-token");

    return secureCompare(bearer, secret) || secureCompare(header, secret);
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
    if (!value) return;

    try {
        origins.add(new URL(value).origin);
    } catch {
        // Ignore malformed operator-provided values.
    }
}

function allowedOrigins(req: Request) {
    const origins = new Set<string>();
    const requestUrl = new URL(req.url);
    origins.add(requestUrl.origin);

    const forwardedHost = req.headers.get("x-forwarded-host");
    if (forwardedHost) {
        const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
        addOrigin(origins, `${forwardedProto}://${forwardedHost}`);
    }

    addOrigin(origins, process.env.NEXTAUTH_URL);
    addOrigin(origins, process.env.APP_BASE_URL);

    for (const origin of (process.env.AXIOM_ALLOWED_ORIGINS || "").split(",")) {
        addOrigin(origins, origin.trim());
    }

    return origins;
}

export function enforceMutationFirewall(req: Request): NextResponse | null {
    if (SAFE_METHODS.has(req.method)) return null;

    const origin = req.headers.get("origin");
    if (!origin) return null;

    let normalizedOrigin: string;
    try {
        normalizedOrigin = new URL(origin).origin;
    } catch {
        return jsonError("Invalid request origin", 403);
    }

    if (!allowedOrigins(req).has(normalizedOrigin)) {
        return jsonError("Cross-origin request blocked", 403);
    }

    return null;
}

function formatBytes(bytes: number) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
    const kb = bytes / 1024;
    if (kb >= 1) return `${Number.isInteger(kb) ? kb : kb.toFixed(1)}KB`;
    return `${bytes} bytes`;
}

export function getRequestContentLength(req: Request): number | null {
    const raw = req.headers.get("content-length");
    if (!raw) return null;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new RequestBodyError("Invalid content length", 400);
    }

    return parsed;
}

export function enforceRequestSizeLimit(req: Request, maxBytes: number): NextResponse | null {
    try {
        const contentLength = getRequestContentLength(req);
        if (contentLength !== null && contentLength > maxBytes) {
            return jsonError(`Request body is too large. Maximum size is ${formatBytes(maxBytes)}.`, 413);
        }
    } catch (error) {
        if (error instanceof RequestBodyError) {
            return jsonError(error.message, error.status);
        }
        throw error;
    }

    return null;
}

async function readRequestTextWithLimit(req: Request, maxBytes: number) {
    const sizeBlocked = enforceRequestSizeLimit(req, maxBytes);
    if (sizeBlocked) {
        throw new RequestBodyError("Request body is too large", 413);
    }

    if (!req.body) {
        const text = await req.text();
        if (Buffer.byteLength(text, "utf8") > maxBytes) {
            throw new RequestBodyError("Request body is too large", 413);
        }
        return text;
    }

    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new RequestBodyError("Request body is too large", 413);
        }

        chunks.push(decoder.decode(value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return chunks.join("");
}

export async function readJsonBody<T>(req: Request, maxBytes = DEFAULT_MAX_JSON_BYTES): Promise<T> {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
        throw new RequestBodyError("Expected application/json request body", 400);
    }

    const text = await readRequestTextWithLimit(req, maxBytes);

    if (!text.trim()) {
        throw new RequestBodyError("Request body is required", 400);
    }

    return JSON.parse(text) as T;
}
