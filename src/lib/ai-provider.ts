import { GoogleGenerativeAI } from "@google/generative-ai";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

const AI_CIRCUIT_COOLDOWN_MS = 60_000;

type AiCircuitState = {
    openedAt: number;
    openedUntil: number;
    lastError: string;
};

const aiCircuits = new Map<string, AiCircuitState>();

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

function getActiveCircuit(modelName: string) {
    const circuit = aiCircuits.get(modelName);
    if (!circuit) {
        return null;
    }

    if (Date.now() >= circuit.openedUntil) {
        aiCircuits.delete(modelName);
        return null;
    }

    return circuit;
}

function openCircuit(modelName: string, error: unknown) {
    const openedAt = Date.now();
    const circuit: AiCircuitState = {
        openedAt,
        openedUntil: openedAt + AI_CIRCUIT_COOLDOWN_MS,
        lastError: error instanceof Error ? error.message : String(error),
    };

    aiCircuits.set(modelName, circuit);
    return circuit;
}

function clearCircuit(modelName: string) {
    aiCircuits.delete(modelName);
}

export async function getAiProviderHealth(modelName: string = "gemini-2.5-flash") {
    const apiKeys = await collectApiKeys();
    const circuit = getActiveCircuit(modelName);

    if (apiKeys.length === 0) {
        return {
            status: "manual" as const,
            title: "AI fallback mode",
            detail: "No live AI provider key is configured, so document and copilot routes will stay in manual or deterministic mode.",
        };
    }

    if (circuit) {
        const secondsLeft = Math.max(1, Math.ceil((circuit.openedUntil - Date.now()) / 1000));
        return {
            status: "manual" as const,
            title: "AI circuit open",
            detail: `The live provider is cooling down after recent failures. Guided/manual flows stay available while retries pause for about ${secondsLeft}s.`,
        };
    }

    return {
        status: "live" as const,
        title: "AI provider available",
        detail: `${apiKeys.length} provider key${apiKeys.length === 1 ? "" : "s"} configured. If live inference fails, the app can fall back to guided review paths.`,
    };
}

export async function getAiModel(modelName: string = "gemini-2.5-flash", config?: Record<string, unknown>) {
    const apiKeys = await collectApiKeys();
    const activeCircuit = getActiveCircuit(modelName);

    if (apiKeys.length === 0) {
        console.warn("AI Provider: No Gemini API key configured; agents will use fallback logic.");
        return null;
    }

    if (activeCircuit) {
        console.warn(
            `AI Provider: Circuit open for ${modelName} until ${new Date(activeCircuit.openedUntil).toISOString()}; using fallback logic.`
        );
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
                    const response = await model.generateContent(request as Parameters<typeof model.generateContent>[0]);
                    clearCircuit(modelName);
                    return response;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `AI Provider: Key ${maskKey(apiKey)} failed during generation for model ${modelName}; trying next key...`,
                        error
                    );
                }
            }

            const circuit = openCircuit(modelName, lastError);
            console.error("AI Provider: All API keys exhausted during generation.");
            console.warn(
                `AI Provider: Circuit opened for ${modelName} until ${new Date(circuit.openedUntil).toISOString()}.`
            );
            throw lastError instanceof Error
                ? lastError
                : new Error("All configured AI keys failed during generation.");
        },
    };

    return modelProxy as unknown as ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
}
