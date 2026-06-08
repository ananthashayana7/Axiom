import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall, enforceRequestSizeLimit } from '@/lib/api-security';
import {
    DEFAULT_STORABLE_MIME_TYPES,
    FileValidationError,
    MAX_STORED_FILE_SIZE,
    resolveAllowedMimeType,
    storeUploadedFile,
} from '@/lib/file-storage';

const MAX_MULTIPART_REQUEST_SIZE = MAX_STORED_FILE_SIZE + 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        const blocked = enforceMutationFirewall(req);
        if (blocked) return blocked;

        const tooLarge = enforceRequestSizeLimit(req, MAX_MULTIPART_REQUEST_SIZE);
        if (tooLarge) return tooLarge;

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id);
        if (limited) return limited;

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const mimeType = resolveAllowedMimeType(file, DEFAULT_STORABLE_MIME_TYPES);
        if (!mimeType) {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type || file.name}. Allowed: PDF, PNG, JPEG, WEBP, CSV, XLSX, TXT, ZIP` },
                { status: 400 }
            );
        }

        if (file.size <= 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 });
        }

        if (file.size > MAX_STORED_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_STORED_FILE_SIZE / 1024 / 1024}MB` },
                { status: 413 }
            );
        }

        const stored = await storeUploadedFile(file, { allowedMimeTypes: DEFAULT_STORABLE_MIME_TYPES });

        return NextResponse.json({
            success: true,
            url: stored.url,
            filename: stored.filename,
            size: stored.size,
            type: stored.type,
        });
    } catch (error) {
        if (error instanceof FileValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error('[Upload] Failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
