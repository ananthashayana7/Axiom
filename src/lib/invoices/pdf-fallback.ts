import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
    coerceInvoiceNumber,
    coerceMoney,
    inferCurrencyFromMoneyFields,
    normalizeCurrencyCode,
    normalizeDateToIso,
    normalizeInvoiceExtraction,
    type NormalizedInvoiceExtraction,
} from "@/lib/invoices/normalization";

const execFileAsync = promisify(execFile);
const PYTHON_TIMEOUT_MS = 20_000;
const PDF_SCRIPT_PATH = path.join(process.cwd(), "src", "lib", "invoices", "extract_pdf_text.py");

type PdfExtractionResult = {
    data: NormalizedInvoiceExtraction;
    text: string;
    warnings: string[];
};

type PythonCandidate = {
    command: string;
    args?: string[];
};

function getPythonCandidates(): PythonCandidate[] {
    const userHome = os.homedir();
    return [
        {
            command: process.env.AXIOM_PDF_PYTHON_PATH || path.join(
                userHome,
                ".cache",
                "codex-runtimes",
                "codex-primary-runtime",
                "dependencies",
                "python",
                "python.exe"
            ),
        },
        { command: "python" },
        { command: "py", args: ["-3"] },
    ];
}

function collapseWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function cleanupLabelValue(value: string | undefined) {
    if (!value) return null;
    return collapseWhitespace(value)
        .replace(/^[\s:.-]+/, "")
        .replace(/\s+(?:gstin|pan|state|phone|email)\b.*$/i, "")
        .trim() || null;
}

function matchFirst(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const value = cleanupLabelValue(match?.[1]);
        if (value) return value;
    }
    return null;
}

function matchMoney(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const candidate = match?.at(-1);
        if (!candidate) continue;
        const amount = coerceMoney(candidate);
        if (amount !== null) return amount;
    }
    return null;
}

function matchDate(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (!match?.[1]) continue;
        const normalized = normalizeDateToIso(match[1]);
        if (normalized) return normalized;
    }
    return null;
}

function extractSupplierName(text: string) {
    const explicit = matchFirst(text, [
        /supplier\s*(?:name)?\s*[:\-]?\s*([^\n]+)/i,
        /vendor\s*(?:name)?\s*[:\-]?\s*([^\n]+)/i,
        /sold\s+by\s*[:\-]?\s*([^\n]+)/i,
        /from\s*[:\-]?\s*([^\n]+)/i,
    ]);

    if (explicit) return explicit;

    const lines = text
        .split(/\r?\n/)
        .map((line) => collapseWhitespace(line))
        .filter(Boolean)
        .slice(0, 12);

    return lines.find((line) =>
        line.length >= 4 &&
        line.length <= 80 &&
        !/\b(invoice|tax invoice|bill to|ship to|gst|date|number|amount|order)\b/i.test(line) &&
        /[A-Za-z]/.test(line)
    ) || null;
}

function extractInvoiceNumber(text: string, fileName: string) {
    const explicit = matchFirst(text, [
        /invoice\s*(?:no|number|#|num|id)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{3,})/i,
        /bill\s*(?:no|number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{3,})/i,
        /\binv(?:oice)?[-\s_]*no\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{3,})/i,
    ]);

    if (explicit) {
        return coerceInvoiceNumber(explicit);
    }

    return coerceInvoiceNumber(fileName.replace(/\.[^.]+$/, "").trim());
}

function extractPaymentTerms(text: string) {
    return matchFirst(text, [
        /payment\s*terms?\s*[:\-]?\s*([^\n]+)/i,
        /terms\s*(?:and conditions)?\s*[:\-]?\s*([^\n]+)/i,
    ]);
}

function extractPurchaseOrderRef(text: string) {
    return matchFirst(text, [
        /purchase\s*order\s*(?:ref(?:erence)?|no|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,})/i,
        /\bpo\s*(?:ref(?:erence)?|no|number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,})/i,
    ]);
}

function extractInvoiceFromText(text: string, fileName: string) {
    const subtotal = matchMoney(text, [
        /sub\s*total\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ]) ?? matchMoney(text, [
        /taxable\s+value\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ]);

    const taxAmount = matchMoney(text, [
        /(?:gst|igst|cgst|sgst|vat|tax(?:\s+amount)?)\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ]);

    const amount = matchMoney(text, [
        /grand\s*total\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
        /invoice\s*total\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
        /total\s*amount\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
        /amount\s*due\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
        /net\s*amount\s*[:\-]?\s*([A-Z]{3}\s*)?[\$₹€£]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ]);

    const invoiceDate = matchDate(text, [
        /invoice\s*date\s*[:\-]?\s*([0-9./-]{6,20})/i,
        /\bdate\s*[:\-]?\s*([0-9./-]{6,20})/i,
    ]);

    const dueDate = matchDate(text, [
        /due\s*date\s*[:\-]?\s*([0-9./-]{6,20})/i,
        /payment\s*due\s*[:\-]?\s*([0-9./-]{6,20})/i,
    ]);

    const extraction = normalizeInvoiceExtraction({
        invoiceNumber: extractInvoiceNumber(text, fileName),
        amount,
        currency: normalizeCurrencyCode(
            text,
            inferCurrencyFromMoneyFields(text, amount, subtotal, taxAmount) ?? "INR"
        ),
        supplierName: extractSupplierName(text),
        invoiceDate,
        dueDate,
        taxAmount,
        subtotal,
        paymentTerms: extractPaymentTerms(text),
        purchaseOrderRef: extractPurchaseOrderRef(text),
        lineItems: [],
    });

    return extraction;
}

async function runPdfTextScript(pdfPath: string) {
    let lastError: unknown;

    for (const candidate of getPythonCandidates()) {
        try {
            if (path.isAbsolute(candidate.command)) {
                await fs.access(candidate.command);
            }

            const { stdout } = await execFileAsync(
                candidate.command,
                [...(candidate.args || []), PDF_SCRIPT_PATH, pdfPath],
                {
                    timeout: PYTHON_TIMEOUT_MS,
                    maxBuffer: 4 * 1024 * 1024,
                    windowsHide: true,
                }
            );

            const parsed = JSON.parse(stdout.trim() || "{}") as { text?: string; error?: string };
            if (parsed.error) {
                throw new Error(parsed.error);
            }

            return collapseWhitespace(parsed.text || "") ? parsed.text || "" : null;
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) {
        console.warn("[OCR] PDF text extraction fallback unavailable:", lastError);
    }

    return null;
}

export async function extractInvoiceFromPdfBuffer(fileName: string, buffer: Buffer): Promise<PdfExtractionResult | null> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "axiom-pdf-"));
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "invoice"}.pdf`);

    try {
        await fs.writeFile(tempFilePath, buffer);

        const text = await runPdfTextScript(tempFilePath);
        if (!text) return null;

        const data = extractInvoiceFromText(text, fileName);
        const hasMeaningfulFields = Boolean(
            data.invoiceNumber ||
            data.supplierName ||
            data.amount !== null ||
            data.invoiceDate ||
            data.purchaseOrderRef
        );

        if (!hasMeaningfulFields) {
            return null;
        }

        return {
            data,
            text,
            warnings: [
                "Fields were recovered from the PDF text layer. Please review the values before saving.",
                "Line items were not parsed automatically for this PDF.",
            ],
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}
