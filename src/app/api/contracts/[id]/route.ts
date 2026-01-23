// src/app/api/contracts/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { contracts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { updateContractStatus } from '@/app/actions/contracts';

// GET a single contract by ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { id } = await params;
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    return NextResponse.json(contract);
}

// PATCH to update contract status (admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    const { status } = await req.json(); // expected: { status: 'active' | 'expired' | 'terminated' }
    if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });

    const result = await updateContractStatus(id, status);
    if (result.success) return NextResponse.json({ success: true });
    return NextResponse.json({ error: result.error }, { status: 400 });
}

// DELETE a contract (admin only)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { id } = await params;
    await db.delete(contracts).where(eq(contracts.id, id));
    return NextResponse.json({ success: true });
}
