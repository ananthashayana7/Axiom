import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAiModel } from '@/lib/ai-provider';
import { enforceRateLimit } from '@/lib/api-rate-limit';
import { enforceMutationFirewall } from '@/lib/api-security';
import { normalizeInvoiceExtraction } from '@/lib/invoices/normalization';

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

export async function POST(req: NextRequest) {
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

        const model = await getAiModel('gemini-2.5-flash', {
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
            },
        });
        if (!model) {
            return NextResponse.json(
                { success: false, error: 'AI model is not configured. Add a Gemini API key before OCR.' },
                { status: 503 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');

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
            return NextResponse.json({
                success: false,
                error: 'Could not extract invoice data from the document',
                rawResponse: responseText.substring(0, 500),
            }, { status: 422 });
        }

        const extracted = normalizeInvoiceExtraction(parsed);

        return NextResponse.json({
            success: true,
            data: extracted,
            source: 'Axiom OCR Engine (Gemini Multimodal)',
        });
    } catch (error) {
        console.error('[OCR] Invoice extraction failed:', error);
        return NextResponse.json(
            { success: false, error: 'OCR processing failed. Please try another PDF/image or enter the invoice fields manually.' },
            { status: 502 }
        );
    }
}
