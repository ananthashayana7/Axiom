import type { NextAuthConfig } from 'next-auth';
import { canAccessAdminPath } from "@/lib/rbac";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export const authConfig = {
    trustHost: true,
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt' as const,
        maxAge: 30 * 60,      // 30 minutes — hard server-side ceiling
        updateAge: 5 * 60,    // refresh token every 5 minutes of activity
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const allowBypass = process.env.ALLOW_DEMO_BYPASS === 'true';
            if (allowBypass && process.env.NODE_ENV !== 'production') return true;

            const isLoggedIn = !!auth?.user;
            const isOnLoginPage = nextUrl.pathname.startsWith('/login');
            const isOnRegisterPage = nextUrl.pathname === '/portal/register';
            const isOnAdminPage = nextUrl.pathname.startsWith('/admin');
            const isOnPortalPage = nextUrl.pathname.startsWith('/portal');
            const isOnOnboardingPage = nextUrl.pathname === '/onboarding';

            // Allow public access to supplier registration
            if (isOnRegisterPage) return true;

            if (isOnLoginPage) {
                if (isLoggedIn) {
                    const role = auth?.user?.role;
                    if (role === 'admin') return Response.redirect(new URL('/admin', nextUrl));
                    if (role === 'supplier') return Response.redirect(new URL('/portal', nextUrl));
                    return Response.redirect(new URL('/', nextUrl));
                }
                return true;
            }

            if (!isLoggedIn) {
                return Response.redirect(new URL('/login', nextUrl))
            };

            // First-login onboarding redirect: send users who haven't completed
            // onboarding to the checklist page (skip if already there)
            const isApiRoute = nextUrl.pathname.startsWith('/api/');
            if (!isOnOnboardingPage && !isApiRoute && !auth.user?.onboardingCompleted) {
                // Only redirect internal users (non-suppliers) — suppliers have
                // their own portal onboarding handled separately
                const userRole = auth.user?.role;
                if (userRole !== 'supplier' && userRole !== 'admin') {
                    return Response.redirect(new URL('/onboarding', nextUrl));
                }
            }

            const userRole = auth.user?.role;

            // Redirect suppliers to portal — only /portal/* and public resources are allowed
            if (userRole === 'supplier') {
                if (nextUrl.pathname === '/profile') {
                    return Response.redirect(new URL('/portal/profile', nextUrl));
                }

                const isSupplierAllowed =
                    isOnPortalPage ||
                    nextUrl.pathname === '/support' ||
                    nextUrl.pathname.startsWith('/api/');
                if (!isSupplierAllowed) {
                    return Response.redirect(new URL('/portal', nextUrl));
                }
            }

            // Prevent portal access for non-suppliers
            if (isOnPortalPage && userRole !== 'supplier') {
                return Response.redirect(new URL('/', nextUrl));
            }

            if (isOnAdminPage) {
                if (userRole === 'admin') {
                    if (canAccessAdminPath(auth.user, nextUrl.pathname)) {
                        return true;
                    }
                    return Response.redirect(new URL('/access-denied', nextUrl));
                }
                return Response.redirect(new URL('/', nextUrl));
            }

            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.accessProfile = user.accessProfile;
                token.department = user.department;
                token.countryScope = user.countryScope;
                token.regionScope = user.regionScope;
                token.supplierId = user.supplierId;
                token.onboardingCompleted = user.onboardingCompleted;
                token.isTwoFactorEnabled = user.isTwoFactorEnabled;
            }

            if (trigger === "update" && session) {
                token = { ...token, ...session };
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.accessProfile = token.accessProfile as string | undefined;
                session.user.department = token.department as string | undefined;
                session.user.countryScope = token.countryScope as string | undefined;
                session.user.regionScope = token.regionScope as string | undefined;
                session.user.supplierId = token.supplierId as string | undefined;
                session.user.onboardingCompleted = token.onboardingCompleted as boolean | undefined;
                session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean | undefined;
            }
            return session;
        },
    },
    providers: [], // Providers added in auth.ts
    secret: authSecret,
} satisfies NextAuthConfig;
