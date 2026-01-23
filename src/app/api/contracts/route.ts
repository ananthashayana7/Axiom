// src/app/api/contracts/route.ts
import { NextResponse } from 'next/server';
import { getContracts, createContract } from '@/app/actions/contracts';
import { auth } from '@/auth';

// GET all contracts (optional supplier filter via query param)
export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const url = new URL(req.url);
    const supplierId = url.searchParams.get('supplierId') ?? undefined;
    const contracts = await getContracts(supplierId);
    return NextResponse.json(contracts);
}

// POST create a new contract (admin only)
export async function POST(req: Request) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const data = await req.json();
    const result = await createContract(data);
    if (result.success) return NextResponse.json(result, { status: 201 });
    return NextResponse.json({ error: result.error }, { status: 400 });
}
