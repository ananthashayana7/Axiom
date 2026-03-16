import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export async function getAiModel(modelName: string = "gemini-2.5-flash") {
    let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    try {
        // Priority: Database setting > Env Var > Fallback (from Settings seed)
        const [settings] = await db.select().from(platformSettings).limit(1);
        if (settings?.geminiApiKey && settings.geminiApiKey.trim().length > 0) {
            apiKey = settings.geminiApiKey.trim();
        }
    } catch (error) {
        console.error("AI Provider: Failed to fetch API key from DB, using environment fallback.", error);
    }

    if (!apiKey || apiKey.trim().length === 0) {
        console.warn("AI Provider: No Gemini API key configured — agents will use statistical fallback logic.");
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: modelName });
    } catch (error) {
        console.error("AI Provider: Failed to initialize Gemini model.", error);
        return null;
    }
}
