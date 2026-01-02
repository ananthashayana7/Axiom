import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserProfile } from "@/app/actions/auth";
import ProfileClient from "./profile-client";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const user = await getUserProfile();

    if (!user) {
        redirect("/login");
    }

    // Ensure role is not null
    const userWithRole = {
        ...user,
        role: user.role || 'user' as const
    };

    return <ProfileClient user={userWithRole} />;
}
