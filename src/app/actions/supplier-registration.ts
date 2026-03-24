'use server'

import { db } from "@/db";
import { suppliers, users } from "@/db/schema";
import { createNotification } from "@/app/actions/notifications";
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
            city: data.city,
            countryCode: data.countryCode,
            isoCertifications: data.certifications || [],
            tierLevel: 'tier_3', // Default tier for new suppliers
        }).returning();

        // Notify all admins about the new registration
        try {
            const admins = await db.select({ id: users.id })
                .from(users)
                .where(eq(users.role, 'admin'));

            await Promise.allSettled(
                admins.map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: '🆕 New Supplier Registration',
                        message: `${data.companyName} (${data.contactEmail}) has registered and is pending approval.`,
                        type: 'info',
                        link: `/suppliers/${newSupplier.id}`,
                    })
                )
            );
        } catch { /* notification failure should not block registration */ }

        return {
            success: true,
            message: "Registration submitted! An admin will review your application shortly.",
            supplierId: newSupplier.id,
        };
    } catch (error) {
        console.error("Supplier registration failed:", error);
        return { success: false, error: "Registration failed. Please try again." };
    }
}
