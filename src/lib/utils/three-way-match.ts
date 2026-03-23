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

export function getThreeWayMatchReasonLabel(reason: ThreeWayMatchStatus['reason']): string {
    switch (reason) {
        case 'MISSING_RECEIPT':
            return 'Verification is pending because no goods receipt has been logged yet.';
        case 'QC_PENDING_OR_FAILED':
            return 'Verification is pending because the receipt inspection is still pending or has failed quality checks.';
        case 'MISSING_INVOICE':
            return 'Verification is pending because no supplier invoice has been recorded yet.';
        case 'PRICE_MISMATCH':
            return 'Verification is pending because the recorded invoice total does not match the PO amount.';
        case 'MATCHED':
            return 'Verification is successful because the PO, receipt/QC, and supplier invoice all align.';
    }
}

export function getThreeWayMatchSuccessCriteria(): string {
    return 'Verification becomes successful only after a goods receipt is logged, the QC inspection passes, and the supplier invoice total matches the PO amount.';
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
