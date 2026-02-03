'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateInvoiceStatus } from "@/app/actions/invoices";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function InvoiceActions({ invoiceId, status }: { invoiceId: string, status: string }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleAction = async (newStatus: 'matched' | 'paid') => {
        setIsLoading(true);
        try {
            const res = await updateInvoiceStatus(invoiceId, newStatus);
            if (res.success) {
                toast.success(`Invoice marked as ${newStatus}`);
            } else {
                toast.error(res.error || "Failed to update invoice");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (status === 'paid') return null;

    return (
        <div className="flex justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-tighter border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => window.alert("3-Way Match Verification: System is auditing PO vs Receipt vs Invoice metrics...")}
                disabled={isLoading}
            >
                Verify Match
            </Button>
            {status === 'pending' && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => handleAction('matched')}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Manual Match"}
                </Button>
            )}
            {status === 'matched' && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-tighter border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handleAction('paid')}
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pay Now"}
                </Button>
            )}
        </div>
    );
}
