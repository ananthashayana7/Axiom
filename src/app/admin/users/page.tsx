import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUsers } from "@/app/actions/users";
import { getSuppliers } from "@/app/actions/suppliers";
import UsersClient from "./users-client";
import { canManageUsers } from "@/lib/rbac";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const userRole = session.user.role;
    if (!canManageUsers(session.user)) {
        redirect("/access-denied");
    }

    const [users, suppliers] = await Promise.all([
        getUsers(),
        getSuppliers(),
    ]);

    return (
        <UsersClient
            users={users}
            suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
            currentUserRole={userRole}
        />
    );
}
