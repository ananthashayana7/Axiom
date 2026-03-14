import { auth } from "@/auth";
import { redirect } from "next/navigation";

type SessionUser = {
    role?: string | null;
};

// Paths that regular users (non-admin) are allowed to access
const USER_ALLOWED_PATHS = ['/admin/audit', '/admin/analytics', '/admin/risk'];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    const role = (session.user as SessionUser).role;

    // Admin gets full access
    if (role === 'admin') {
        return <>{children}</>;
    }

    // Regular users can only access specific intelligence/audit pages.
    // This is a defense-in-depth check — the middleware already blocks
    // disallowed paths, but we enforce it server-side too.
    // NOTE: We cannot read the current pathname in a layout server component,
    // so the per-page guards below + middleware handle route-specific blocking.
    // This layout ensures at minimum that only admin and user roles reach /admin/*.
    if (role === 'user') {
        return <>{children}</>;
    }

    // Suppliers and any other roles are never allowed in /admin
    redirect('/');
}
