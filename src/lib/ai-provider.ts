import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";

/**
 * Collects all configured API keys in priority order:
 *   1. Database (primary, fallback1, fallback2)
 *   2. Environment variables (GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3)
 * Duplicates and empty strings are removed.
 */
async function collectApiKeys(): Promise<string[]> {
    const keys: string[] = [];

    // Environment variables
    const envKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
    ];
    for (const k of envKeys) {
        if (k && k.trim().length > 0) keys.push(k.trim());
    }

    try {
        // Database keys take highest priority — prepend them
        const [settings] = await db.select().from(platformSettings).limit(1);
        if (settings) {
            const dbKeys = [
                settings.geminiApiKey,
                settings.geminiApiKeyFallback1,
                settings.geminiApiKeyFallback2,
            ];
            const validDbKeys = dbKeys.filter((k): k is string => !!k && k.trim().length > 0).map(k => k.trim());
            // DB keys go first (higher priority), followed by env-only keys
            keys.unshift(...validDbKeys);
        }
    } catch (error) {
        console.error("AI Provider: Failed to fetch API keys from DB, using environment fallback.", error);
    }

    // Deduplicate while preserving order
    return [...new Set(keys)];
}

export async function getAiModel(modelName: string = "gemini-2.5-flash") {
    const apiKeys = await collectApiKeys();

    if (apiKeys.length === 0) {
        console.warn("AI Provider: No Gemini API key configured — agents will use statistical fallback logic.");
        return null;
    }

    // Try each key in order until one succeeds
    for (const apiKey of apiKeys) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            // Lightweight validation: if construction succeeds, return immediately.
            // Actual API errors (quota, invalid key) surface at generation time and
            // are handled by the caller's retry / fallback logic.
            return model;
        } catch (error) {
            const masked = apiKey.length > 10 ? apiKey.slice(0, 6) + "…" + apiKey.slice(-4) : "***";
            console.warn(`AI Provider: Key ${masked} failed for model ${modelName}, trying next key…`, error);
        }
    }

    console.error("AI Provider: All API keys exhausted — agents will use statistical fallback logic.");
    return null;
}
