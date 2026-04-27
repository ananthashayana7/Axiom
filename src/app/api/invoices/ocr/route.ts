import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAiModel } from '@/lib/ai-provider';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall } from '@/lib/api-security';
import { normalizeInvoiceExtraction } from '@/lib/invoices/normalization';
import { extractInvoiceFromPdfBuffer } from '@/lib/invoices/pdf-fallback';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
};

function inferSupportedMimeType(file: File): string | null {
    const declaredType = file.type?.toLowerCase();
    if (declaredType && (declaredType === 'application/pdf' || declaredType.startsWith('image/'))) {
        return declaredType;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
}

function extractBalancedJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
        const char = text[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, index + 1);
        }
    }

    return null;
}

function parseModelJson(responseText: string): unknown {
    const trimmed = responseText.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
    const balanced = extractBalancedJsonObject(trimmed);
    const candidates = [trimmed, fenced, balanced].filter((value): value is string => Boolean(value));

    for (const candidate of [...new Set(candidates)]) {
        try {
            return JSON.parse(candidate);
        } catch {
            // Try the next extraction strategy.
        }
    }

    throw new Error('Model did not return valid JSON');
}

function buildManualReviewDraft(file: File) {
    const fileStem = file.name.replace(/\.[^.]+$/, '').trim();
    const suggestedInvoiceNumber = /^[A-Za-z0-9._-]{4,120}$/.test(fileStem) ? fileStem : null;

    return normalizeInvoiceExtraction({
        invoiceNumber: suggestedInvoiceNumber,
        currency: 'INR',
        lineItems: [],
    });
}

function manualReviewResponse(file: File, warning: string, source = 'Axiom OCR Manual Review') {
    return NextResponse.json({
        success: true,
        data: buildManualReviewDraft(file),
        source,
        requiresReview: true,
        warnings: [
            warning,
            'The document is loaded in review mode so you can complete or correct the invoice fields manually.',
        ],
    });
}

async function tryPdfFallback(file: File, buffer: Buffer | null) {
    if (!buffer) return null;

    const fallback = await extractInvoiceFromPdfBuffer(file.name, buffer);
    if (!fallback) return null;

    return NextResponse.json({
        success: true,
        data: fallback.data,
        source: 'Axiom PDF Text Extraction',
        requiresReview: true,
        warnings: fallback.warnings,
    });
}

export async function POST(req: NextRequest) {
    let uploadedFile: File | null = null;
    let uploadedBuffer: Buffer | null = null;

    try {
        const blocked = enforceMutationFirewall(req);
        if (blocked) return blocked;

        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limited = await enforceRateLimit(req, 'write', (session.user as { id?: string }).id);
        if (limited) return limited;

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        uploadedFile = file;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const mimeType = inferSupportedMimeType(file);
        if (!mimeType) {
            return NextResponse.json(
                { error: 'Only PDF and image files are supported for OCR' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds the 10 MB limit' },
                { status: 413 }
            );
        }

        uploadedBuffer = Buffer.from(await file.arrayBuffer());

        const model = await getAiModel('gemini-2.5-flash', {
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
            },
        });
        if (!model) {
            if (mimeType === 'application/pdf') {
                const pdfFallbackResponse = await tryPdfFallback(file, uploadedBuffer);
                if (pdfFallbackResponse) return pdfFallbackResponse;
            }
            return manualReviewResponse(
                file,
                'Automatic extraction is currently unavailable, but you can continue by reviewing the invoice fields manually.'
            );
        }

        const base64 = uploadedBuffer.toString('base64');

        const prompt = `You are an expert invoice data extraction system for Axiom Procurement Platform.
Analyze this uploaded invoice document and extract the following fields.
Return ONLY a valid JSON object with these fields (use null for any field you cannot find):

{
    "invoiceNumber": "string - the invoice number/ID",
    "amount": number - the total amount (numeric, no currency symbols),
    "currency": "string - 3-letter ISO currency code (e.g. USD, EUR, INR, GBP)",
    "supplierName": "string - the vendor/supplier company name",
    "invoiceDate": "string - date in YYYY-MM-DD format",
    "dueDate": "string - due date in YYYY-MM-DD format",
    "taxAmount": number - tax amount if present,
    "subtotal": number - subtotal before tax,
    "lineItems": [
        {
            "description": "string",
            "quantity": number,
            "unitPrice": number,
            "totalPrice": number
        }
    ],
    "paymentTerms": "string - e.g. Net 30, Due on Receipt",
    "purchaseOrderRef": "string - referenced PO number if any"
}`;

        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType,
                    data: base64,
                }
            },
            { text: prompt }
        ]);

        const responseText = result.response.text();
        let parsed: unknown;
        try {
            parsed = parseModelJson(responseText);
        } catch {
            if (mimeType === 'application/pdf') {
                const pdfFallbackResponse = await tryPdfFallback(file, uploadedBuffer);
                if (pdfFallbackResponse) return pdfFallbackResponse;
            }
            return manualReviewResponse(
                file,
                'The invoice was uploaded, but the OCR response was incomplete. Please review the fields before saving.',
                'Axiom OCR Recovery Mode'
            );
        }

        const extracted = normalizeInvoiceExtraction(parsed);
        const warnings: string[] = [];

        if (!extracted.invoiceNumber || extracted.amount === null || !extracted.supplierName) {
            warnings.push('Some core invoice fields need review before saving.');
        }
        if (!extracted.lineItems.length) {
            warnings.push('No line items were confidently extracted from the document.');
        }

        return NextResponse.json({
            success: true,
            data: extracted,
            source: 'Axiom OCR Engine (Gemini Multimodal)',
            requiresReview: warnings.length > 0,
            warnings,
        });
    } catch (error) {
        console.error('[OCR] Invoice extraction failed:', error);
        if (uploadedFile) {
            if (inferSupportedMimeType(uploadedFile) === 'application/pdf') {
                const pdfFallbackResponse = await tryPdfFallback(uploadedFile, uploadedBuffer);
                if (pdfFallbackResponse) return pdfFallbackResponse;
            }
            return manualReviewResponse(
                uploadedFile,
                'The document could not be auto-extracted this time, but manual review mode is ready for the demo.',
                'Axiom OCR Recovery Mode'
            );
        }
        return NextResponse.json(
            {
                success: false,
                error: 'Invoice upload could not be prepared. Please try the file again.',
            },
            { status: 502 }
        );
    }
}
