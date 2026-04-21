// src/app/api/contracts/route.ts
import { NextResponse } from 'next/server';
import { getContracts, createContract } from '@/app/actions/contracts';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall, readJsonBody, requireApiUser } from '@/lib/api-security';
import { z } from 'zod';

const createContractSchema = z.object({
    supplierId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    type: z.enum(['framework_agreement', 'nda', 'service_agreement', 'one_off']),
    value: z.coerce.number().positive(),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),
    noticePeriod: z.coerce.number().int().min(0).max(3650).optional(),
    renewalStatus: z.enum(['auto_renew', 'manual', 'none']).optional(),
    incoterms: z.enum(['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']).optional(),
    slaKpis: z.string().max(20_000).optional(),
    liabilityCap: z.coerce.number().nonnegative().optional(),
    priceLockExpiry: z.coerce.date().optional(),
    autoRenewalAlert: z.enum(['true', 'false']).optional(),
    aiExtractedData: z.string().max(50_000).optional(),
});

// GET all contracts (optional supplier filter via query param)
export async function GET(req: Request) {
    const { user, response } = await requireApiUser();
    if (response) return response;

    const limited = await enforceRateLimit(req, 'read', user.id);
    if (limited) return limited;

    const url = new URL(req.url);
    const supplierId = url.searchParams.get('supplierId') ?? undefined;
    const contracts = await getContracts(supplierId);
    return NextResponse.json(contracts);
}

// POST create a new contract (admin only)
export async function POST(req: Request) {
    try {
        const blocked = enforceMutationFirewall(req);
        if (blocked) return blocked;

        const { user, response } = await requireApiUser(['admin']);
        if (response) return response;

        const limited = await enforceRateLimit(req, 'write', user.id);
        if (limited) return limited;

        const data = createContractSchema.parse(await readJsonBody<unknown>(req));
        const result = await createContract(data);
        if (result.success) return NextResponse.json(result, { status: 201 });
        return NextResponse.json({ error: result.error }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid contract payload';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
