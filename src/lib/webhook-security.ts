import dns from "node:dns/promises";
import net from "node:net";

type ValidationOptions = {
    allowHttp?: boolean;
    allowPrivateNetwork?: boolean;
    resolveDns?: boolean;
};

type WebhookUrlValidation =
    | { ok: true; url: string }
    | { ok: false; error: string };

function flagEnabled(name: string) {
    return process.env[name]?.toLowerCase() === "true";
}

function allowHttp(options?: ValidationOptions) {
    return options?.allowHttp ?? (process.env.NODE_ENV !== "production" || flagEnabled("ALLOW_INSECURE_WEBHOOK_URLS"));
}

function allowPrivateNetwork(options?: ValidationOptions) {
    return options?.allowPrivateNetwork ?? flagEnabled("ALLOW_PRIVATE_WEBHOOK_URLS");
}

function ipv4Parts(address: string) {
    const parts = address.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return null;
    }
    return parts;
}

export function isPrivateIpAddress(address: string) {
    const ipVersion = net.isIP(address);

    if (ipVersion === 4) {
        const parts = ipv4Parts(address);
        if (!parts) return false;
        const [a, b] = parts;

        return a === 0
            || a === 10
            || a === 127
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 198 && (b === 18 || b === 19))
            || a >= 224;
    }

    if (ipVersion === 6) {
        const normalized = address.toLowerCase();
        if (normalized.startsWith("::ffff:")) {
            return isPrivateIpAddress(normalized.slice("::ffff:".length));
        }

        return normalized === "::"
            || normalized === "::1"
            || normalized.startsWith("fc")
            || normalized.startsWith("fd")
            || normalized.startsWith("fe8")
            || normalized.startsWith("fe9")
            || normalized.startsWith("fea")
            || normalized.startsWith("feb");
    }

    return false;
}

export function validateWebhookUrlFormat(input: string, options?: ValidationOptions): WebhookUrlValidation {
    const rawUrl = input.trim();
    if (!rawUrl) {
        return { ok: false, error: "Webhook URL is required" };
    }

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { ok: false, error: "Webhook URL must be absolute" };
    }

    if (parsed.username || parsed.password) {
        return { ok: false, error: "Webhook URL must not include embedded credentials" };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, error: "Webhook URL must use HTTP or HTTPS" };
    }

    if (parsed.protocol === "http:" && !allowHttp(options)) {
        return { ok: false, error: "Webhook URL must use HTTPS in production" };
    }

    if (!parsed.hostname) {
        return { ok: false, error: "Webhook URL must include a hostname" };
    }

    if (!allowPrivateNetwork(options)) {
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIpAddress(hostname)) {
            return { ok: false, error: "Webhook URL cannot target localhost or private network addresses" };
        }
    }

    parsed.hash = "";
    return { ok: true, url: parsed.toString() };
}

export async function validateWebhookUrl(input: string, options?: ValidationOptions): Promise<WebhookUrlValidation> {
    const format = validateWebhookUrlFormat(input, options);
    if (!format.ok) return format;

    if (options?.resolveDns === false || allowPrivateNetwork(options)) {
        return format;
    }

    const hostname = new URL(format.url).hostname;
    if (net.isIP(hostname)) {
        return isPrivateIpAddress(hostname)
            ? { ok: false, error: "Webhook URL cannot target private network addresses" }
            : format;
    }

    let addresses: dns.LookupAddress[];
    try {
        addresses = await dns.lookup(hostname, { all: true, verbatim: false });
    } catch {
        return { ok: false, error: "Webhook hostname could not be resolved" };
    }

    if (addresses.length === 0) {
        return { ok: false, error: "Webhook hostname could not be resolved" };
    }

    if (addresses.some((address) => isPrivateIpAddress(address.address))) {
        return { ok: false, error: "Webhook hostname resolves to a private network address" };
    }

    return format;
}
