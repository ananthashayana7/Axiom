import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    trustHost: true,
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnLoginPage = nextUrl.pathname.startsWith('/login');
            const isOnAdminPage = nextUrl.pathname.startsWith('/admin');
            const isOnPortalPage = nextUrl.pathname.startsWith('/portal');
            const isOnSuppliersPage = nextUrl.pathname.startsWith('/suppliers');
            const isOnSourcingPage = nextUrl.pathname.startsWith('/sourcing');

            if (isOnLoginPage) {
                if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
                return true;
            }

            if (!isLoggedIn) {
                return Response.redirect(new URL('/login', nextUrl))
            };

            const userRole = (auth.user as any)?.role;

            // Redirect suppliers to portal if they land on admin or procurement pages
            if (userRole === 'supplier') {
                if (isOnAdminPage || isOnSuppliersPage || isOnSourcingPage || nextUrl.pathname === '/') {
                    return Response.redirect(new URL('/portal', nextUrl));
                }
            }

            // Prevent portal access for non-suppliers
            if (isOnPortalPage && userRole !== 'supplier') {
                return Response.redirect(new URL('/', nextUrl));
            }

            if (isOnAdminPage) {
                if (userRole === 'admin') return true;

                // Allow regular users to access specific intelligence and audit pages
                if (userRole === 'user') {
                    const isAllowedAdminPage =
                        nextUrl.pathname.startsWith('/admin/audit') ||
                        nextUrl.pathname.startsWith('/admin/analytics') ||
                        nextUrl.pathname.startsWith('/admin/risk');

                    if (isAllowedAdminPage) return true;
                }

                return Response.redirect(new URL('/', nextUrl));
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).role = token.role;
            }
            return session;
        },
    },
    providers: [], // Providers added in auth.ts
    secret: "2f8b4c9d3e7a1f6c5b8a2d9e4f7a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
} satisfies NextAuthConfig;