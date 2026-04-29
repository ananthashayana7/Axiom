'use server'

import { auth } from "@/auth";
import { db } from "@/db";
import { platformSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "./activity";
import { mergeFinanceSettings, parseFinanceSettings } from "@/lib/finance";

type SessionUser = {
    role?: string | null;
    email?: string | null;
};

const AI_ENV_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
];

type SettingsUpdateInput = {
    platformName: string;
    defaultCurrency: string;
    isSettingsLocked: string;
    exchangeRates: string;
    updatedAt: Date;
};

function readBookRate(formData: FormData, currency: string) {
    const rawValue = formData.get(`bookRate_${currency.toUpperCase()}`);
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function countConfiguredKeys(values: Array<string | null | undefined>) {
    return values.filter((value) => Boolean(value?.trim())).length;
}

function getAiCredentialState(settings?: {
    geminiApiKey?: string | null;
    geminiApiKeyFallback1?: string | null;
    geminiApiKeyFallback2?: string | null;
}) {
    const databaseKeyCount = countConfiguredKeys([
        settings?.geminiApiKey,
        settings?.geminiApiKeyFallback1,
        settings?.geminiApiKeyFallback2,
    ]);
    const environmentKeyCount = countConfiguredKeys(AI_ENV_KEYS);
    const totalKeyCount = databaseKeyCount + environmentKeyCount;

    let source = "Not configured";
    if (databaseKeyCount > 0 && environmentKeyCount > 0) {
        source = "Secure database store + server environment";
    } else if (databaseKeyCount > 0) {
        source = "Secure database store";
    } else if (environmentKeyCount > 0) {
        source = "Server environment";
    }

    return {
        hasCredentials: totalKeyCount > 0,
        databaseKeyCount,
        environmentKeyCount,
        totalKeyCount,
        source,
    };
}

function sanitizeSettingsRecord(settings: typeof platformSettings.$inferSelect) {
    const {
        geminiApiKey: _geminiApiKey,
        geminiApiKeyFallback1: _geminiApiKeyFallback1,
        geminiApiKeyFallback2: _geminiApiKeyFallback2,
        ...safeSettings
    } = settings;

    return safeSettings;
}

export async function getSettings() {
    const session = await auth();
    const role = (session?.user as SessionUser | undefined)?.role;

    try {
        if (!session?.user || role !== 'admin') {
            return {
                platformName: 'Axiom',
                defaultCurrency: 'INR',
                isSettingsLocked: 'no',
                role: role || 'user',
                isTwoFactorEnabled: false,
                finance: parseFinanceSettings(null, 'INR'),
                aiCredentialState: getAiCredentialState(),
            };
        }

        const [settings] = await db.select().from(platformSettings).limit(1);
        let isTwoFactorEnabled = false;

        if (session.user.id) {
            const [user] = await db.select({
                isTwoFactorEnabled: users.isTwoFactorEnabled,
            }).from(users).where(eq(users.id, session.user.id));
            isTwoFactorEnabled = !!user?.isTwoFactorEnabled;
        }

        if (!settings) {
            const [newSettings] = await db.insert(platformSettings).values({
                platformName: 'Axiom Procurement Intelligence',
                defaultCurrency: 'INR',
                isSettingsLocked: 'no',
                geminiApiKey: null,
                exchangeRates: mergeFinanceSettings(null, 'INR', {
                    reportingCurrency: 'USD',
                    bookRatePeriod: 'monthly',
                }),
            }).returning();

            return {
                ...sanitizeSettingsRecord(newSettings),
                role,
                isTwoFactorEnabled,
                finance: parseFinanceSettings(newSettings.exchangeRates, newSettings.defaultCurrency),
                aiCredentialState: getAiCredentialState(newSettings),
            };
        }

        return {
            ...sanitizeSettingsRecord(settings),
            role,
            isTwoFactorEnabled,
            finance: parseFinanceSettings(settings.exchangeRates, settings.defaultCurrency),
            aiCredentialState: getAiCredentialState(settings),
        };
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return {
            platformName: 'Axiom',
            defaultCurrency: 'INR',
            isSettingsLocked: 'no',
            role: role || 'user',
            isTwoFactorEnabled: false,
            finance: parseFinanceSettings(null, 'INR'),
            aiCredentialState: getAiCredentialState(),
        };
    }
}

export async function updateSettings(formData: FormData) {
    try {
        const session = await auth();
        if ((session?.user as SessionUser | undefined)?.role !== 'admin') {
            return { success: false, error: "Unauthorized" };
        }

        const currentSettings = await getSettings();
        const platformName =
            (formData.get("platformName") as string) ||
            currentSettings.platformName ||
            'Axiom Procurement Intelligence';
        const defaultCurrency = ((formData.get("defaultCurrency") as string) || currentSettings.defaultCurrency || 'INR').toUpperCase();
        const reportingCurrency = ((formData.get("reportingCurrency") as string) || currentSettings.finance?.reportingCurrency || defaultCurrency).toUpperCase();
        const bookRatePeriod = formData.get("bookRatePeriod") === "quarterly" ? "quarterly" : "monthly";
        const bookRateEffectiveDate =
            (formData.get("bookRateEffectiveDate") as string) ||
            currentSettings.finance?.bookRateEffectiveDate ||
            new Date().toISOString().slice(0, 10);
        const isSettingsLocked = formData.get("isSettingsLocked") as string || 'no';
        const bookRateCurrencies = Array.from(new Set([
            defaultCurrency,
            reportingCurrency,
            'USD',
            'EUR',
            'GBP',
            'HUF',
            'CNY',
            'JPY',
            'MXN',
        ]));

        if (currentSettings.isSettingsLocked === 'yes' && isSettingsLocked !== 'no') {
            return { success: false, error: "Settings are locked. Please unlock them before making changes." };
        }

        const bookRates = bookRateCurrencies.reduce<Record<string, number>>((accumulator, currency) => {
            const submittedRate = readBookRate(formData, currency);
            if (submittedRate) {
                accumulator[currency] = submittedRate;
                return accumulator;
            }

            const existingRate = currentSettings.finance?.bookRates?.[currency];
            if (existingRate) {
                accumulator[currency] = existingRate;
            }

            return accumulator;
        }, {});
        bookRates[reportingCurrency] = 1;

        const updateData: SettingsUpdateInput = {
            platformName,
            defaultCurrency,
            isSettingsLocked: isSettingsLocked === 'on' || isSettingsLocked === 'yes' ? 'yes' : 'no',
            exchangeRates: mergeFinanceSettings(currentSettings.exchangeRates, defaultCurrency, {
                reportingCurrency,
                bookRatePeriod,
                bookRateEffectiveDate,
                bookRates,
            }),
            updatedAt: new Date(),
        };

        const [existing] = await db.select().from(platformSettings).limit(1);
        if (!existing) {
            await db.insert(platformSettings).values(updateData);
        } else {
            await db.update(platformSettings).set(updateData);
        }

        await logActivity(
            'UPDATE',
            'system',
            'global',
            `Admin updated system settings: ${platformName}. Finance book rates now report in ${reportingCurrency} using ${bookRatePeriod} book rates.`,
        );

        revalidatePath("/admin/settings");
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error) {
        console.error("Failed to update settings:", error);
        return { success: false, error: "Database communication failed" };
    }
}

export async function flushAuthCache() {
    try {
        const session = await auth();
        const role = (session?.user as SessionUser | undefined)?.role;
        if (!session || role !== 'admin') {
            return { success: false, error: "Unauthorized" };
        }

        revalidatePath("/", "layout");

        await logActivity('DELETE', 'system', 'cache', `Admin flushed authorization cache: ${session.user?.email}`);

        return { success: true };
    } catch (error) {
        console.error("Flush Cache Error:", error);
        return { success: false, error: "Failed to flush cache" };
    }
}
