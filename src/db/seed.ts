import { db } from "./index";
import { users } from "./schema";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from "bcryptjs";

async function seed() {
    console.log("Seeding database...");

    try {
        // Check if we already have users. If so, don't re-seed
        const existingUsers = await db.select().from(users).limit(1);
        if (existingUsers.length > 0) {
            console.log("Database already contains data. Skipping seeding...");
            process.exit(0);
            return;
        }

        console.log("Empty database detected. Creating default admin account...");

        // Create Default Admin only — all business data should be imported via the
        // Admin → Import Data page using real CSV dumps.
        const hashedPassword = await bcrypt.hash("password", 10);
        await db.insert(users).values({
            id: uuidv4(),
            name: "Admin User",
            email: "admin@example.com",
            password: hashedPassword,
            role: "admin",
        });
        console.log("Created default admin: admin@example.com / password");
        console.log("Seeding complete! Import real data via Admin → Import Data.");
    } catch (error) {
        console.error("Seeding failed:", error);
    }
    process.exit(0);
}

seed();
