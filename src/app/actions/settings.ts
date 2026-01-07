'use server'

import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";

export async function updateSettings(formData: FormData) {
    try {
        // In a real app, you would save this to a 'settings' table or a config file
        // For now, we simulate the save and log the activity
        const siteName = formData.get("siteName");

        console.log("Updating system settings:", Object.fromEntries(formData));

        // Log the administrative change
        await logActivity('UPDATE', 'system', 'global', `Admin updated system settings: ${siteName}`);

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, error: "Database communication failed" };
    }
}
