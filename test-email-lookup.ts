import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq, or } from "drizzle-orm";

async function test() {
    const email = "anantha.shayana@prettl.com";
    console.log(`Testing lookup for: ${email}`);
    try {
        const result = await db.select().from(users).where(
            or(
                eq(users.email, email),
                eq(users.employeeId, email)
            )
        );
        console.log("Result length:", result.length);
        if (result.length > 0) {
            console.log("User ID:", result[0].id);
            console.log("User Role:", result[0].role);
        }
    } catch (e) {
        console.error("Lookup failed:", e);
    }
    process.exit(0);
}

test();
