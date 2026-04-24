import type { NextAuthConfig } from 'next-auth';

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

            const userRole = auth.user?.role;

            // Redirect suppliers to portal — only /portal/* and public resources are allowed
            if (userRole === 'supplier') {
                const isSupplierAllowed =
                    isOnPortalPage ||
                    nextUrl.pathname === '/copilot' ||
                    nextUrl.pathname === '/support' ||
                    nextUrl.pathname === '/profile' ||
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
                if (userRole === 'admin') return true;
                return Response.redirect(new URL('/', nextUrl));
            }

            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.supplierId = user.supplierId;
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
                session.user.supplierId = token.supplierId as string | undefined;
            }
            return session;
        },
    },
    providers: [], // Providers added in auth.ts
    secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
