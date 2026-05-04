import type { NormalizedInvoiceExtraction } from "@/lib/invoices/normalization";

export type InvoiceReviewSignal = {
    severity: "warning" | "critical";
    message: string;
};

function roundToCents(value: number) {
    return Math.round(value * 100) / 100;
}

export function assessInvoiceReviewSignals(invoice: Partial<NormalizedInvoiceExtraction>) {
    const signals: InvoiceReviewSignal[] = [];

    if (!invoice.invoiceNumber) {
        signals.push({
            severity: "critical",
            message: "Invoice number is missing, so the document must stay in manual review.",
        });
    }

    if (!invoice.amount || invoice.amount <= 0) {
        signals.push({
            severity: "critical",
            message: "Invoice amount is missing or invalid, so payment routing must stay blocked.",
        });
    }

    if (!invoice.supplierName) {
        signals.push({
            severity: "critical",
            message: "Supplier identity was not extracted confidently and needs manual confirmation.",
        });
    }

    if (!invoice.currency) {
        signals.push({
            severity: "warning",
            message: "Currency was not detected confidently. Confirm the source currency before posting.",
        });
    }

    if ((invoice.lineItems?.length || 0) === 0) {
        signals.push({
            severity: "warning",
            message: "No line items were extracted confidently. Treat this as a manual review invoice.",
        });
    }

    const amount = Number(invoice.amount || 0);
    const subtotal = Number(invoice.subtotal || 0);
    const taxAmount = Number(invoice.taxAmount || 0);
    const lineItemTotal = roundToCents((invoice.lineItems || []).reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));

    if (subtotal > 0 && taxAmount >= 0 && amount > 0) {
        const expectedTotal = roundToCents(subtotal + taxAmount);
        if (Math.abs(expectedTotal - amount) > 1) {
            signals.push({
                severity: "warning",
                message: "Subtotal and tax do not reconcile cleanly to the invoice total. Review before approval.",
            });
        }
    }

    if (lineItemTotal > 0 && amount > 0 && Math.abs(lineItemTotal - amount) > 1) {
        signals.push({
            severity: "warning",
            message: "Line-item totals do not reconcile cleanly to the invoice header amount.",
        });
    }

    if (invoice.invoiceDate && invoice.dueDate && invoice.dueDate < invoice.invoiceDate) {
        signals.push({
            severity: "warning",
            message: "Due date falls before the invoice date. Check for locale-driven date reversal before saving.",
        });
    }

    return signals;
}
