import { db } from "./index";
import { suppliers, parts, procurementOrders, orderItems, users } from "./schema";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from "bcryptjs";

async function seed() {
    console.log("Seeding database...");

    try {
        // Clear existing data (order matters due to FKs)
        await db.delete(orderItems);
        await db.delete(procurementOrders);
        await db.delete(parts);
        await db.delete(suppliers);
        await db.delete(users);

        // 0. Create Default Admin
        const hashedPassword = await bcrypt.hash("password", 10);
        await db.insert(users).values({
            id: uuidv4(),
            name: "Admin User",
            email: "admin@example.com",
            password: hashedPassword,
            role: "admin",
        });
        console.log("Created default admin: admin@example.com / password");

        // 1. Create Suppliers
        const supplierIds: string[] = [];
        const supplierData = [
            { name: "Acme Corp", email: "contact@acme.com", status: "active", riskScore: 12 },
            { name: "Globex Inc", email: "sales@globex.com", status: "active", riskScore: 45 },
            { name: "Soylent Corp", email: "info@soylent.com", status: "inactive", riskScore: 78 },
            { name: "Umbrella Corp", email: "risk@umbrella.com", status: "blacklisted", riskScore: 99 },
        ];

        for (const sup of supplierData) {
            const id = uuidv4();
            await db.insert(suppliers).values({
                id,
                name: sup.name,
                contactEmail: sup.email,
                status: sup.status as any,
                riskScore: sup.riskScore
            });
            supplierIds.push(id);
            console.log(`Created supplier: ${sup.name}`);
        }

        // 2. Create Parts
        const partIds: string[] = [];
        const partData = [
            { sku: "ELEC-001", name: "Microcontroller X1", category: "Electronics", stock: 1500, price: 12.50 },
            { sku: "ELEC-002", name: "Resistor 10k", category: "Electronics", stock: 50000, price: 0.05 },
            { sku: "MECH-055", name: "Steel Bolt M6", category: "Fasteners", stock: 2000, price: 0.25 },
            { sku: "MECH-089", name: "Aluminum Sheet 2mm", category: "Raw Materials", stock: 150, price: 45.00 },
        ];

        for (const part of partData) {
            const id = uuidv4();
            await db.insert(parts).values({ id, sku: part.sku, name: part.name, category: part.category, stockLevel: part.stock });
            partIds.push(id);
        }

        // 3. Create Orders (distributed over last 6 months)
        const orderStatuses = ["fulfilled", "sent", "sent", "draft"];

        for (let i = 0; i < 20; i++) {
            const id = uuidv4();
            const supplierIdx = Math.floor(Math.random() * supplierIds.length);
            // Random date within last 6 months
            const date = new Date();
            date.setMonth(date.getMonth() - Math.floor(Math.random() * 6));

            // Random items
            let totalAmount = 0;
            const items = [];

            const numItems = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < numItems; j++) {
                const partIdx = Math.floor(Math.random() * partIds.length);
                const quantity = Math.floor(Math.random() * 100) + 1;
                const price = partData[partIdx].price;
                totalAmount += quantity * price;
                items.push({ partId: partIds[partIdx], quantity, unitPrice: price.toString() });
            }

            await db.insert(procurementOrders).values({
                id,
                supplierId: supplierIds[supplierIdx],
                status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)] as any,
                totalAmount: totalAmount.toFixed(2),
                createdAt: date,
            });

            for (const item of items) {
                await db.insert(orderItems).values({
                    orderId: id,
                    partId: item.partId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                });
            }
        }

        console.log("Seeding complete!");
    } catch (error) {
        console.error("Seeding failed:", error);
    }
    process.exit(0);
}

seed();
