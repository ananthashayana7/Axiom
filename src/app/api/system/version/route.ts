import { NextResponse } from "next/server";

import { getRuntimeVersionSnapshot } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json(getRuntimeVersionSnapshot(), {
        headers: {
            "Cache-Control": "no-store, max-age=0",
        },
    });
}
