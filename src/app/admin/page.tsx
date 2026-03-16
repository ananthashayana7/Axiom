import { redirect } from 'next/navigation';

// Redirect admins landing on /admin to the main analytics dashboard.
// This page exists so the post-login redirect to /admin does not 404.
export default function AdminIndexPage() {
    redirect('/admin/analytics');
}
