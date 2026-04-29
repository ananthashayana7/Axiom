import { GoogleGenerativeAI } from "@google/generative-ai";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

/**
 * Collect all configured API keys in priority order:
 * 1. Database (primary, fallback1, fallback2)
 * 2. Environment variables
 */
async function collectApiKeys(): Promise<string[]> {
    const keys: string[] = [];

    const envKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5,
    ];

    for (const key of envKeys) {
        if (key && key.trim().length > 0) {
            keys.push(key.trim());
        }
    }

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

            keys.unshift(...dbKeys);
        }
    } catch (error) {
        console.error("AI Provider: Failed to fetch API keys from DB, using environment fallback.", error);
    }

    return [...new Set(keys)];
}

function maskKey(apiKey: string) {
    return apiKey.length > 10
        ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
        : "***";
}

export async function getAiModel(modelName: string = "gemini-2.5-flash", config?: Record<string, unknown>) {
    const apiKeys = await collectApiKeys();

    if (apiKeys.length === 0) {
        console.warn("AI Provider: No Gemini API key configured; agents will use fallback logic.");
        return null;
    }

    const modelProxy = {
        async generateContent(request: unknown) {
            let lastError: unknown;

            for (const apiKey of apiKeys) {
                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        ...config,
                        generationConfig: {
                            temperature: 0.1,
                            topP: 0.1,
                            topK: 1,
                            ...((config?.generationConfig as Record<string, unknown> | undefined) ?? {}),
                        },
                    });
                    return await model.generateContent(request as Parameters<typeof model.generateContent>[0]);
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `AI Provider: Key ${maskKey(apiKey)} failed during generation for model ${modelName}; trying next key...`,
                        error
                    );
                }
            }

            console.error("AI Provider: All API keys exhausted during generation.");
            throw lastError instanceof Error
                ? lastError
                : new Error("All configured AI keys failed during generation.");
        },
    };

    return modelProxy as unknown as ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
}
