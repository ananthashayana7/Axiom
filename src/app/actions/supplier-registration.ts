'use server'

import { createRegistrationOnboardingPack, notifyAdminsAboutRegistration } from "@/app/actions/enterprise-readiness";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

interface SupplierRegistrationData {
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    categories?: string[];
    city?: string;
    country?: string;
    countryCode?: string;
    certifications?: string[];
    website?: string;
    description?: string;
}

export async function registerSupplier(data: SupplierRegistrationData) {
    try {
        // Validate required fields
        if (!data.companyName?.trim()) return { success: false, error: "Company name is required" };
        if (!data.contactEmail?.trim()) return { success: false, error: "Contact email is required" };
        const normalizedCountryCode = data.countryCode?.trim().toUpperCase();
        if (normalizedCountryCode && !/^[A-Z]{2}$/.test(normalizedCountryCode)) {
            return { success: false, error: "Country code must be a valid 2-letter ISO code" };
        }

        // Check for duplicate email
        const [existing] = await db.select({ id: suppliers.id })
            .from(suppliers)
            .where(eq(suppliers.contactEmail, data.contactEmail.trim()))
            .limit(1);

        if (existing) {
            return { success: false, error: "A supplier with this email already exists" };
        }

        // Insert supplier with pending status
        const [newSupplier] = await db.insert(suppliers).values({
            name: data.companyName.trim(),
            contactEmail: data.contactEmail.trim(),
            status: 'inactive', // Pending admin approval
            lifecycleStatus: 'onboarding',
            categories: data.categories || [],
            city: data.city?.trim(),
            countryCode: normalizedCountryCode,
            isoCertifications: data.certifications || [],
            tierLevel: 'tier_3', // Default tier for new suppliers
        }).returning();

        const onboardingPack = await createRegistrationOnboardingPack({
            supplierId: newSupplier.id,
            supplierName: data.companyName.trim(),
            submissionContext: {
                contactEmail: data.contactEmail.trim(),
                contactPhone: data.contactPhone?.trim(),
                website: data.website?.trim(),
                description: data.description?.trim(),
                city: data.city?.trim(),
                country: data.country?.trim(),
                countryCode: normalizedCountryCode,
                categories: data.categories || [],
                certifications: data.certifications || [],
            },
        });

        // Notify admins about the new registration
        try {
            await notifyAdminsAboutRegistration({
                supplierId: newSupplier.id,
                supplierName: data.companyName.trim(),
                contactEmail: data.contactEmail.trim(),
            });

            /*
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: '🆕 New Supplier Registration',
                        message: `${data.companyName} (${data.contactEmail}) has registered and is pending approval.`,
                        type: 'info',
                        link: `/suppliers/${newSupplier.id}`,
                    })
                )
            */
        } catch {
            // Notification failure should not block registration.
        }

        return {
            success: true,
            message: onboardingPack.ownerId
                ? "Registration submitted. Your onboarding pack is now open for review."
                : "Registration submitted! An admin will review your application shortly.",
            supplierId: newSupplier.id,
        };
    } catch (error) {
        console.error("Supplier registration failed:", error);
        return { success: false, error: "Registration failed. Please try again." };
    }
}
