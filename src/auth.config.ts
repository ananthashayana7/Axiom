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

            if (isOnLoginPage) {
                if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
                return true;
            }

            if (!isLoggedIn) {
                return Response.redirect(new URL('/login', nextUrl))
            };

            const userRole = (auth.user as any)?.role;
            if (isOnAdminPage && userRole !== 'admin') {
                // Redirect non-admins to dashboard
                // return Response.redirect(new URL('/', nextUrl));
                // Or maybe just let them stay but show 403? 
                // Let's redirect to dashboard for now.
                return Response.redirect(new URL('/', nextUrl));
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
            }
            return session;
        },
    },
    providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig;