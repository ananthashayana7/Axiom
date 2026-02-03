import { db } from "./src/db";
import { users } from "./src/db/schema";

async function dumpUsers() {
    try {
        const allUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            employeeId: users.employeeId,
            phoneNumber: users.phoneNumber,
            role: users.role
        }).from(users);
        console.log("Users in DB:", JSON.stringify(allUsers, null, 2));
    } catch (e) {
        console.error("Error dumping users:", e);
    }
    process.exit(0);
}

dumpUsers();
