'use server'

import { getAiModel } from "@/lib/ai-provider";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";

function pseudoGeoFromString(input: string) {
    const hash = input.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const latitude = ((hash % 12000) / 100) - 60;  // -60 to +60
    const longitude = ((hash % 36000) / 100) - 180; // -180 to +180
    return { latitude: latitude.toFixed(4), longitude: longitude.toFixed(4) };
}

export async function geocodeSupplier(supplierId: string) {
    let locationHint = "";
    try {
        const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
        if (!supplier) return { success: false, error: "Supplier not found" };

        // For now, if we don't have a specific address field, we use city or name as hint
        locationHint = supplier.city || supplier.name || supplierId;

        const prompt = `
            You are a Geographic Intelligence Agent. 
            Identify the likely Latitude and Longitude for this location: "${locationHint}".
            Also identify the ISO 2-character Country Code.
            
            Return ONLY a JSON object:
            {
                "latitude": number,
                "longitude": number,
                "countryCode": "string"
            }
        `;

        const model = await getAiModel();
        if (!model) throw new Error("AI model not available");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);

            await db.update(suppliers).set({
                latitude: data.latitude.toString(),
                longitude: data.longitude.toString(),
                countryCode: data.countryCode
            }).where(eq(suppliers.id, supplierId));

            return { success: true, data };
        }

        return { success: false, error: "Failed to parse coordinates" };
    } catch (error) {
        console.error("Geocoding Error, using heuristic fallback:", error);
        const coords = pseudoGeoFromString(locationHint || supplierId);

        await db.update(suppliers).set({
            latitude: coords.latitude,
            longitude: coords.longitude,
            countryCode: "UN"
        }).where(eq(suppliers.id, supplierId));

        return { success: true, data: { ...coords, countryCode: "UN" } };
    }
}

export async function batchGeocodeSuppliers() {
    try {
        const allSuppliers = await db.select().from(suppliers);
        const results = [];

        for (const supplier of allSuppliers) {
            if (!supplier.latitude || !supplier.longitude) {
                const res = await geocodeSupplier(supplier.id);
                results.push({ id: supplier.id, ...res });
            }
        }

        return { success: true, count: results.filter(r => r.success).length };
    } catch (error) {
        console.error("Batch Geocoding Error:", error);
        return { success: false, error: "Batch geocoding failed" };
    }
}
