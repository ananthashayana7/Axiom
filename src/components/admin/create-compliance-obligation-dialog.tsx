'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createComplianceObligation } from "@/app/actions/compliance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type SupplierOption = {
    id: string;
    name: string;
};

interface CreateComplianceObligationDialogProps {
    suppliers: SupplierOption[];
}

export function CreateComplianceObligationDialog({ suppliers }: CreateComplianceObligationDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Obligation
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Compliance Obligation</DialogTitle>
                    <DialogDescription>
                        Add an obligation with an expiry date and optionally link it to a supplier so evidence requests can start immediately.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);

                        startTransition(async () => {
                            try {
                                await createComplianceObligation({
                                    title: String(formData.get("title") || ""),
                                    category: String(formData.get("category") || ""),
                                    supplierId: String(formData.get("supplierId") || "") || undefined,
                                    policyPack: String(formData.get("policyPack") || "") || undefined,
                                    region: String(formData.get("region") || "") || undefined,
                                    expiresAt: formData.get("expiresAt") ? new Date(String(formData.get("expiresAt"))) : undefined,
                                    documentRequired: formData.get("documentRequired") === "on" ? "yes" : "no",
                                });

                                toast.success("Compliance obligation created");
                                setOpen(false);
                                router.refresh();
                            } catch (error) {
                                toast.error(error instanceof Error ? error.message : "Failed to create obligation");
                            }
                        });
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" name="title" placeholder="ISO 9001 recertification" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Input id="category" name="category" placeholder="iso_certification" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="supplierId">Supplier</Label>
                        <select id="supplierId" name="supplierId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="">No supplier linked</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="policyPack">Policy Pack</Label>
                            <Input id="policyPack" name="policyPack" placeholder="EU_REGULATORY" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="region">Region</Label>
                            <Input id="region" name="region" placeholder="EU" />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="expiresAt">Expiry Date</Label>
                            <Input id="expiresAt" name="expiresAt" type="date" />
                        </div>
                        <label className="flex items-center gap-2 text-sm pt-8">
                            <input type="checkbox" name="documentRequired" defaultChecked />
                            Evidence required
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Obligation"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
