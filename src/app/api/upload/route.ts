import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall } from '@/lib/api-security';

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EXT_MAP: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'text/csv': 'csv',
    'text/plain': 'txt',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
};

export async function POST(req: NextRequest) {
    try {
        const blocked = enforceMutationFirewall(req);
        if (blocked) return blocked;

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limited = await enforceRateLimit(req, 'write', (session.user as any).id);
        if (limited) return limited;

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPEG, CSV, XLSX, TXT, ZIP` },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const ext = EXT_MAP[file.type] || 'bin';
        const filename = `${uuidv4()}.${ext}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', year, month);
        await mkdir(uploadDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());

        let url = `/uploads/${year}/${month}/${filename}`;

        const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const azureContainer = process.env.AZURE_STORAGE_CONTAINER || 'axiom-docs';
        const shouldUseAzure = process.env.NODE_ENV === 'production' || !!azureConnectionString;

        if (shouldUseAzure) {
            if (!azureConnectionString) {
                return NextResponse.json(
                    { error: 'File storage is not configured. Missing AZURE_STORAGE_CONNECTION_STRING.' },
                    { status: 503 }
                );
            }

            const { BlobServiceClient } = await import('@azure/storage-blob');
            const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
            const containerClient = blobServiceClient.getContainerClient(azureContainer);
            await containerClient.createIfNotExists();

            const blobPath = `${year}/${month}/${filename}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
            await blockBlobClient.uploadData(buffer, {
                blobHTTPHeaders: {
                    blobContentType: file.type || 'application/octet-stream',
                },
            });

            url = blockBlobClient.url;
        } else {
            const filePath = path.join(uploadDir, filename);
            await writeFile(filePath, buffer);
        }

        return NextResponse.json({
            success: true,
            url,
            filename: file.name,
            size: file.size,
            type: file.type,
        });
    } catch (error) {
        console.error('[Upload] Failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
