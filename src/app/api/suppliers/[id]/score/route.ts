// src/app/api/suppliers/[id]/score/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueSupplierScore } from '@/lib/queue';
import { auth } from '@/auth';
import { enforceRateLimit } from '@/lib/api-rate-limit';

async function requireSession() {
    const session = await auth();
    if (!session?.user) return null;
    return session.user as any;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await requireSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limited = enforceRateLimit(req, 'read', user.id);
    if (limited) return limited;

    const { id } = await params;

    if (user.role === 'supplier' && user.supplierId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    return NextResponse.json({ riskScore: supplier.riskScore, esgScore: supplier.esgScore });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await requireSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limited = enforceRateLimit(req, 'write', user.id);
    if (limited) return limited;

    const { id } = await params;

    await enqueueSupplierScore(id);
    return NextResponse.json({ message: 'Scoring job queued' }, { status: 202 });
}
