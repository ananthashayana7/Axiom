'use client'

import React, { useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { convertRFQToOrder } from "@/app/actions/orders";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ApproveOrderButtonProps {
    rfqId: string;
    supplierId: string;
    variant?: "default" | "secondary" | "outline";
}

export function ApproveOrderButton({ rfqId, supplierId, variant = "default" }: ApproveOrderButtonProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const isSubmittingRef = useRef(false);

    const handleApprove = async () => {
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        startTransition(async () => {
            try {
                const res = await convertRFQToOrder(rfqId, supplierId);
                if (res.success) {
                    toast.success("RFQ Approved & Ordered", {
                        description: "A new procurement order has been generated."
                    });
                    router.push("/sourcing/orders");
                } else {
                    const errorMsg = 'error' in res ? res.error : "Failed to process order";
                    toast.error(errorMsg);
                }
            } finally {
                isSubmittingRef.current = false;
            }
        });
    };

    return (
        <Button
            size="sm"
            className="w-full"
            variant={variant}
            onClick={handleApprove}
            disabled={isPending}
        >
            {isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve & Order
                </>
            )}
        </Button>
    );
}
