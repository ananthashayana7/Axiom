import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isVerificationTokenValid } from '@/lib/email-verification';
import { createRegistrationOnboardingPack, notifyAdminsAboutRegistration } from '@/app/actions/enterprise-readiness';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { error: 'Verification token is required' },
                { status: 400 }
            );
        }

        // Find supplier by verification token
        const [supplier] = await db.select()
            .from(suppliers)
            .where(eq(suppliers.emailVerificationToken, token))
            .limit(1);

        if (!supplier) {
            return NextResponse.json(
                { error: 'Invalid or expired verification token' },
                { status: 400 }
            );
        }

        // Check if token is still valid
        if (!isVerificationTokenValid(supplier.emailVerificationExpiresAt)) {
            return NextResponse.json(
                { error: 'Verification token has expired. Please register again.' },
                { status: 400 }
            );
        }

        // Check if already verified
        if (supplier.emailVerified) {
            return NextResponse.json(
                { error: 'Email is already verified' },
                { status: 400 }
            );
        }

        // Mark email as verified and clear token
        await db.update(suppliers)
            .set({
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpiresAt: null,
            })
            .where(eq(suppliers.id, supplier.id));

        // Now create the onboarding pack
        try {
            const onboardingPack = await createRegistrationOnboardingPack({
                supplierId: supplier.id,
                supplierName: supplier.name,
                submissionContext: {
                    contactEmail: supplier.contactEmail,
                    countryCode: supplier.countryCode,
                    categories: supplier.categories || [],
                    certifications: supplier.isoCertifications || [],
                },
            });

            // Notify admins about the new registration
            try {
                await notifyAdminsAboutRegistration({
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    contactEmail: supplier.contactEmail,
                });
            } catch (notifyError) {
                console.error('Failed to notify admins:', notifyError);
                // Non-critical, continue
            }
        } catch (onboardingError) {
            console.error('Failed to create onboarding pack:', onboardingError);
            // Non-critical, email is already verified
        }

        // Redirect to success page
        const successUrl = new URL('/portal/register/verified', request.nextUrl);
        return NextResponse.redirect(successUrl);
    } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.json(
            { error: 'Failed to verify email' },
            { status: 500 }
        );
    }
}
