export interface ThreeWayMatchInput {
    poAmount: number;
    invoiceAmounts: number[];
    hasReceipt: boolean;
    qcPassed: boolean;
}

export interface ThreeWayMatchStatus {
    hasInvoice: boolean;
    totalInvoiced: number;
    isPriceMatched: boolean;
    isMatched: boolean;
    status: 'pending' | 'matched' | 'disputed';
    reason: 'MISSING_RECEIPT' | 'QC_PENDING_OR_FAILED' | 'MISSING_INVOICE' | 'PRICE_MISMATCH' | 'MATCHED';
}

export function calculateThreeWayMatchStatus({
    poAmount,
    invoiceAmounts,
    hasReceipt,
    qcPassed,
}: ThreeWayMatchInput): ThreeWayMatchStatus {
    const totalInvoiced = invoiceAmounts.reduce((sum, amount) => sum + amount, 0);
    const hasInvoice = invoiceAmounts.length > 0;
    const isPriceMatched = hasInvoice && Math.abs(totalInvoiced - poAmount) < 0.01;
    const isMatched = hasReceipt && qcPassed && isPriceMatched;

    if (isMatched) {
        return {
            hasInvoice,
            totalInvoiced,
            isPriceMatched,
            isMatched,
            status: 'matched',
            reason: 'MATCHED',
        };
    }

    if (hasInvoice && !isPriceMatched) {
        return {
            hasInvoice,
            totalInvoiced,
            isPriceMatched,
            isMatched,
            status: 'disputed',
            reason: 'PRICE_MISMATCH',
        };
    }

    if (!hasReceipt) {
        return {
            hasInvoice,
            totalInvoiced,
            isPriceMatched,
            isMatched,
            status: 'pending',
            reason: 'MISSING_RECEIPT',
        };
    }

    if (!qcPassed) {
        return {
            hasInvoice,
            totalInvoiced,
            isPriceMatched,
            isMatched,
            status: 'pending',
            reason: 'QC_PENDING_OR_FAILED',
        };
    }

    return {
        hasInvoice,
        totalInvoiced,
        isPriceMatched,
        isMatched,
        status: 'pending',
        reason: 'MISSING_INVOICE',
    };
}
