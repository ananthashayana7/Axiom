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

            if (isOnAdminPage && userRole !== 'admin') {
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
} satisfies NextAuthConfig;