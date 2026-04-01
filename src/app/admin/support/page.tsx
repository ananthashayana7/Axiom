import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAllTickets } from "@/app/actions/support";
import SupportAdminClient from "./support-admin-client";

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const userRole = session.user.role;
    if (userRole !== 'admin') {
        redirect("/");
    }

    const tickets = await getAllTickets();

    return <SupportAdminClient tickets={tickets as any} />;
}
