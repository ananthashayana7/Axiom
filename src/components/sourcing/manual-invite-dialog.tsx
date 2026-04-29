'use client';

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search, CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { inviteSupplierToRFQ } from "@/app/actions/rfqs";
import { toast } from "sonner";
import type { Supplier } from "@/db/schema";

interface ManualInviteDialogProps {
    rfqId: string;
    suppliers: Supplier[];
    alreadyInvitedIds: string[];
}

export function ManualInviteDialog({ rfqId, suppliers, alreadyInvitedIds }: ManualInviteDialogProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [isPending, setIsPending] = useState<string | null>(null);

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) &&
        !alreadyInvitedIds.includes(s.id) &&
        s.status === 'active'
    );

    const handleInvite = async (supplierId: string) => {
        setIsPending(supplierId);
        try {
            const res = await inviteSupplierToRFQ(rfqId, supplierId);
            if (res.success) {
                const emailDelivered = 'emailDelivered' in res ? res.emailDelivered : false;
                const emailWarning = 'emailWarning' in res ? res.emailWarning : undefined;
                toast.success("Supplier invited successfully", {
                    description: emailDelivered
                        ? "Portal access and email communication were both sent."
                        : emailWarning
                            ? `Portal access is live. Email status: ${emailWarning}`
                            : "Portal access is live for this supplier.",
                });
                setOpen(false);
            } else {
                toast.error(res.error || "Failed to invite supplier");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsPending(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Plus size={14} />
                    Manual Invite
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Invite Suppliers
                    </DialogTitle>
                    <DialogDescription>
                        Manually select a supplier to participate in this sourcing event.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search suppliers..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                        {filteredSuppliers.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div>
                                    <p className="font-semibold text-sm">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">Risk: {s.riskScore}% | Performance: {s.performanceScore}%</p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => handleInvite(s.id)}
                                    disabled={!!isPending}
                                >
                                    {isPending === s.id ? <Loader2 size={14} className="animate-spin" /> : "Invite"}
                                </Button>
                            </div>
                        ))}
                        {filteredSuppliers.length === 0 && (
                            <p className="text-center py-6 text-sm text-muted-foreground italic">
                                No eligible suppliers found.
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
