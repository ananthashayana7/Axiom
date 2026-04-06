import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAiModel } from '@/lib/ai-provider';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'Only PDF and image files are supported for OCR' },
                { status: 400 }
            );
        }

        // Enforce 10 MB file size limit to prevent OOM
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds the 10 MB limit' },
                { status: 413 }
            );
        }

        const model = await getAiModel();
        if (!model) {
            return NextResponse.json({ error: 'AI model not available' }, { status: 503 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');
        const mimeType = file.type;

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
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return NextResponse.json({
                success: false,
                error: 'Could not extract invoice data from the document',
                rawResponse: responseText.substring(0, 500),
            });
        }

        const extracted = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
            success: true,
            data: extracted,
            source: 'Axiom OCR Engine (Gemini Multimodal)',
        });
    } catch (error) {
        console.error('[OCR] Invoice extraction failed:', error);
        return NextResponse.json(
            { error: 'OCR processing failed' },
            { status: 500 }
        );
    }
}
