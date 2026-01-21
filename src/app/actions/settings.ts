'use server'

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { logActivity } from "./activity";
import { revalidatePath } from "next/cache";

export async function getSettings() {
    try {
        const [settings] = await db.select().from(platformSettings).limit(1);
        if (!settings) {
            // Seed default settings if empty
            const [newSettings] = await db.insert(platformSettings).values({
                platformName: 'Axiom Procurement Intelligence',
                defaultCurrency: 'INR',
                isSettingsLocked: 'no',
                // Pre-seed with the user's known key if initializing for the first time
                geminiApiKey: "AIzaSyApARgWwswo5nb2TVGrj6Wn4BULeLIBOM0",
            }).returning();
            return newSettings;
        }
        return settings;
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return {
            platformName: 'Axiom',
            defaultCurrency: 'INR',
            isSettingsLocked: 'no',
            geminiApiKey: null,
        };
    }
}

export async function updateSettings(formData: FormData) {
    try {
        const platformName = formData.get("siteName") as string;
        const defaultCurrency = formData.get("currency") as string;
        const isSettingsLocked = formData.get("isSettingsLocked") as string || 'no';
        const geminiApiKey = formData.get("geminiApiKey") as string;

        const currentSettings = await getSettings();

        // If settings are locked and we're not unlocking, block update
        if (currentSettings.isSettingsLocked === 'yes' && isSettingsLocked !== 'no') {
            return { success: false, error: "Settings are locked. Please unlock them before making changes." };
        }

        const updateData: any = {
            platformName,
            defaultCurrency,
            isSettingsLocked: isSettingsLocked === 'on' || isSettingsLocked === 'yes' ? 'yes' : 'no',
            updatedAt: new Date()
        };

        // Only update API key if provided (allow empty to mean "no change" if we wanted, but here we treat empty as "cleared" or "updated value")
        // Better UX: If input is empty, don't overwrite with empty string unless specific action?
        // For now, let's say if they send a value (even empty), we update.
        if (geminiApiKey !== undefined && geminiApiKey !== null) {
            updateData.geminiApiKey = geminiApiKey;
        }

        await db.update(platformSettings).set(updateData);

        // Log the administrative change
        await logActivity('UPDATE', 'system', 'global', `Admin updated system settings: ${platformName}`);

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, error: "Database communication failed" };
    }
}
