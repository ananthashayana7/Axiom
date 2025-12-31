import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUsers } from "@/app/actions/users";
import UsersClient from "./users-client";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'admin') {
        redirect("/");
    }

    const users = await getUsers();

    return <UsersClient users={users} currentUserRole={userRole} />;
}
