import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export async function getAiModel(modelName: string = "gemini-1.5-flash") {
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    try {
        // Priority: Database setting > Env Var > Fallback (from Settings seed)
        const [settings] = await db.select().from(platformSettings).limit(1);
        if (settings?.geminiApiKey) {
            apiKey = settings.geminiApiKey;
        }
    } catch (error) {
        console.error("AI Provider: Failed to fetch API key from DB, using environment fallback.", error);
    }

    if (!apiKey) {
        throw new Error("AI Provider: Missing valid Gemini API Key. Please configure it in Settings or Environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
}
