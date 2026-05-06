import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDefaultAdminLandingPath } from "@/lib/rbac";

export default async function AdminIndexPage() {
    const session = await auth();
    redirect(getDefaultAdminLandingPath(session?.user));
}
