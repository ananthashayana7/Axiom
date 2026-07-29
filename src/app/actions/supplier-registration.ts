'use server'

import { createRegistrationOnboardingPack, notifyAdminsAboutRegistration } from "@/app/actions/enterprise-readiness";
import { generateVerificationToken, getVerificationTokenExpiresAt, getVerificationLink } from "@/lib/email-verification";
import { generateSupplierEmailVerificationEmail } from "@/lib/services/email";
import { sendEmail } from "@/lib/services/email";
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

        // Generate verification token and expiration
        const verificationToken = generateVerificationToken();
        const verificationExpiresAt = getVerificationTokenExpiresAt();

        // Insert supplier with UNVERIFIED email status
        const [newSupplier] = await db.insert(suppliers).values({
            name: data.companyName.trim(),
            contactEmail: data.contactEmail.trim(),
            status: 'inactive', // Pending admin approval (after email verification)
            lifecycleStatus: 'onboarding',
            categories: data.categories || [],
            city: data.city?.trim(),
            countryCode: normalizedCountryCode,
            isoCertifications: data.certifications || [],
            tierLevel: 'tier_3', // Default tier for new suppliers
            emailVerified: false, // Email not yet verified
            emailVerificationToken: verificationToken,
            emailVerificationExpiresAt: verificationExpiresAt,
        }).returning();

        // Generate verification link
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
        const verificationLink = getVerificationLink(verificationToken, baseUrl);

        // Send verification email
        try {
            const emailData = generateSupplierEmailVerificationEmail(data.companyName.trim(), verificationLink);
            await sendEmail({
                to: data.contactEmail.trim(),
                subject: emailData.subject,
                body: emailData.body,
            });
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Delete the supplier record if email fails
            await db.delete(suppliers).where(eq(suppliers.id, newSupplier.id));
            return { success: false, error: "Failed to send verification email. Please try again." };
        }

        return {
            success: true,
            message: "Registration submitted! Please check your email to verify your address. This link will expire in 24 hours.",
            supplierId: newSupplier.id,
        };
    } catch (error) {
        console.error("Supplier registration failed:", error);
        return { success: false, error: "Registration failed. Please try again." };
    }
}
