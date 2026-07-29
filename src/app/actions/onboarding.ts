'use server'

import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type OnboardingTask = {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    action?: {
        label: string;
        href: string;
    };
};

/**
 * Get onboarding checklist for current user
 */
export async function getOnboardingChecklist(): Promise<OnboardingTask[]> {
    const session = await auth();
    if (!session?.user) {
        return [];
    }

    // Find user with full details
    const [user] = await db.select()
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

    if (!user) {
        return [];
    }

    const tasks: OnboardingTask[] = [];

    // Profile setup task
    tasks.push({
        id: 'profile-setup',
        title: 'Complete Your Profile',
        description: 'Add your full name, contact information, and preferences',
        completed: !!user.name && user.name.trim().length > 0,
        action: { label: 'Edit Profile', href: '/profile' },
    });

    // 2FA setup task
    tasks.push({
        id: 'two-factor-setup',
        title: 'Enable Two-Factor Authentication',
        description: 'Secure your account with 2FA using an authenticator app',
        completed: user.isTwoFactorEnabled,
        action: user.isTwoFactorEnabled ? undefined : { label: 'Set Up 2FA', href: '/profile' },
    });

    // Welcome email acknowledgment
    tasks.push({
        id: 'welcome-email',
        title: 'Review Welcome Email',
        description: 'Check your inbox for the welcome email with important resources',
        completed: true, // Automatically marked as user received it
    });

    // Security audit
    tasks.push({
        id: 'review-permissions',
        title: 'Review Account Permissions',
        description: 'Verify your role and access permissions are correct',
        completed: !!user.role,
    });

    // Platform tour (optional for suppliers)
    if (user.role === 'supplier') {
        tasks.push({
            id: 'portal-tour',
            title: 'Explore Supplier Portal',
            description: 'Take a guided tour of the supplier portal features',
            completed: false,
            action: { label: 'Start Tour', href: '/portal' },
        });
    }

    return tasks;
}

/**
 * Mark onboarding as complete
 */
export async function completeOnboarding() {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        const now = new Date();
        await db.update(users)
            .set({
                onboardingCompleted: true,
                onboardingCompletedAt: now,
            })
            .where(eq(users.id, session.user.id));

        return { success: true };
    } catch (error) {
        console.error('Failed to complete onboarding:', error);
        return { success: false, error: 'Failed to complete onboarding' };
    }
}

/**
 * Check if onboarding is complete for current user
 */
export async function isOnboardingComplete(): Promise<boolean> {
    const session = await auth();
    if (!session?.user) {
        return false;
    }

    const [user] = await db.select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

    return user?.onboardingCompleted ?? false;
}
