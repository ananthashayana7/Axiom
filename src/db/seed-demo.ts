import { eq } from "drizzle-orm";

import { db } from "./index";
import { seedDemoWorkspace } from "./demo-workspace";
import type { PreservedAdminUser } from "./demo-workspace";
import { users } from "./schema";

async function run() {
    try {
        const preservedAdmins = await db
            .select()
            .from(users)
            .where(eq(users.role, "admin"));

        if (preservedAdmins.length === 0) {
            throw new Error("No admin users found. Create an admin account before seeding demo data.");
        }

        const result = await seedDemoWorkspace(preservedAdmins as PreservedAdminUser[]);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Demo seed failed:", error);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
}

run();
