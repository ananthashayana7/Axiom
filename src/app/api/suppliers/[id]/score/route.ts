// src/app/api/suppliers/[id]/score/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueSupplierScore } from '@/lib/queue';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    // Return current riskScore and ESG score placeholders
    return NextResponse.json({ riskScore: supplier.riskScore, esgScore: supplier.esgScore });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Enqueue a scoring job for this supplier
    await enqueueSupplierScore(id);
    return NextResponse.json({ message: 'Scoring job queued' }, { status: 202 });
}
