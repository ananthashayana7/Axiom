import { NextResponse } from 'next/server';
import { db } from '@/db';
import { contracts, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateContractStatus } from '@/app/actions/contracts';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall, readJsonBody, requireApiUser } from '@/lib/api-security';
import { z } from 'zod';

const statusSchema = z.object({
    status: z.enum(['active', 'expired', 'terminated']),
});

// GET a single contract by ID
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const limited = await enforceRateLimit(req, 'read', user.id);
    if (limited) return limited;

    const { id } = await params;
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    if (user.role === 'supplier' && contract.supplierId !== user.supplierId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(contract);
}

// PATCH to update contract status (admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const blocked = enforceMutationFirewall(req);
        if (blocked) return blocked;

        const { user, response } = await requireApiUser(['admin']);
        if (response) return response;

        const limited = await enforceRateLimit(req, 'write', user.id);
        if (limited) return limited;

        const { id } = await params;
        const { status } = statusSchema.parse(await readJsonBody<unknown>(req));

        const result = await updateContractStatus(id, status);
        if (result.success) return NextResponse.json({ success: true });
        return NextResponse.json({ error: result.error }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid contract status payload';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

// DELETE a contract (admin only)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const blocked = enforceMutationFirewall(req);
    if (blocked) return blocked;

    const { user, response } = await requireApiUser(['admin']);
    if (response) return response;

    const limited = await enforceRateLimit(req, 'write', user.id);
    if (limited) return limited;

    const { id } = await params;

    // BUG-04 FIX: Fetch before delete so we can audit and guard active contracts.
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

    // Block hard-deletion of active contracts — they may be linked to live orders.
    if (contract.status === 'active') {
        return NextResponse.json(
            { error: 'Cannot delete an active contract. Terminate it first.' },
            { status: 409 },
        );
    }

    await db.delete(contracts).where(eq(contracts.id, id));

    // Write compliance audit trail
    await db.insert(auditLogs).values({
        userId: user.id,
        action: 'DELETE',
        entityType: 'contract',
        entityId: id,
        details: `Contract "${contract.title}" (status: ${contract.status}) permanently deleted by admin ${user.email || user.id}.`,
    });

    return NextResponse.json({ success: true });
}
