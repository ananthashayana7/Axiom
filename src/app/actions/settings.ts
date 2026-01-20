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
        };
    }
}

export async function updateSettings(formData: FormData) {
    try {
        const platformName = formData.get("siteName") as string;
        const defaultCurrency = formData.get("currency") as string;
        const isSettingsLocked = formData.get("isSettingsLocked") as string || 'no';

        const currentSettings = await getSettings();

        // If settings are locked and we're not unlocking, block update
        if (currentSettings.isSettingsLocked === 'yes' && isSettingsLocked !== 'no') {
            return { success: false, error: "Settings are locked. Please unlock them before making changes." };
        }

        await db.update(platformSettings)
            .set({
                platformName,
                defaultCurrency,
                isSettingsLocked: isSettingsLocked === 'on' || isSettingsLocked === 'yes' ? 'yes' : 'no',
                updatedAt: new Date()
            });

        // Log the administrative change
        await logActivity('UPDATE', 'system', 'global', `Admin updated system settings: ${platformName}`);

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, error: "Database communication failed" };
    }
}
