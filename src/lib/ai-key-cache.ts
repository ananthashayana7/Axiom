/**
 * AI Key Cache
 *
 * Gemini API keys are stored in the platform_settings table (primary + up to
 * 2 fallbacks) alongside environment-variable keys.  Querying the DB on every
 * single AI call is wasteful and adds latency.  This module provides a simple
 * TTL-based in-process cache so the DB is only hit once per TTL window.
 *
 * The cache is deliberately process-local (not Redis) because:
 *   1. Keys are small and read-only — no consistency concern across instances.
 *   2. Avoiding a Redis round-trip keeps the cache fast even during Redis
 *      outages.
 *   3. Each process re-fetches independently, which is fine for infrequent
 *      key rotation.
 */

import { db } from '@/db';
import { platformSettings } from '@/db/schema';

/** How long to trust the cached key list before re-fetching from the DB. */
const KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type KeyCache = {
    keys: string[];
    fetchedAt: number;
};

const globalForKeyCache = globalThis as typeof globalThis & {
    __axiomAiKeyCache?: KeyCache;
};

/**
 * Collect all configured API keys in priority order:
 * 1. Database (primary, fallback1, fallback2) — highest priority so operators
 *    can rotate keys without a redeploy.
 * 2. Environment variables — fallback when DB keys are absent.
 *
 * Results are cached in-process for KEY_CACHE_TTL_MS to avoid a DB round-trip
 * on every AI request.
 */
export async function getCachedApiKeys(): Promise<string[]> {
    const now = Date.now();
    const cached = globalForKeyCache.__axiomAiKeyCache;

    if (cached && now - cached.fetchedAt < KEY_CACHE_TTL_MS) {
        return cached.keys;
    }

    const keys = await fetchFreshApiKeys();
    globalForKeyCache.__axiomAiKeyCache = { keys, fetchedAt: now };
    return keys;
}

/**
 * Force-invalidate the cache (e.g. after a circuit opens or admin saves new keys).
 */
export function invalidateApiKeyCache() {
    delete globalForKeyCache.__axiomAiKeyCache;
}

async function fetchFreshApiKeys(): Promise<string[]> {
    const keys: string[] = [];

    try {
        const [settings] = await db.select().from(platformSettings).limit(1);
        if (settings) {
            const dbKeys = [
                settings.geminiApiKey,
                settings.geminiApiKeyFallback1,
                settings.geminiApiKeyFallback2,
            ]
                .filter((key): key is string => Boolean(key?.trim()))
                .map((key) => key.trim());

            keys.push(...dbKeys);
        }
    } catch (error) {
        console.error('AI Key Cache: Failed to fetch API keys from DB, using environment fallback.', error);
    }

    const envKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
    ];

    for (const key of envKeys) {
        if (key?.trim()) {
            keys.push(key.trim());
        }
    }

    // Deduplicate while preserving priority order
    return [...new Set(keys)];
}
