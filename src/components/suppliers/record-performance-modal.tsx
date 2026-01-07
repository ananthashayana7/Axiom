'use client'

import React, { useState, useTransition } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { recordPerformanceLog } from "@/app/actions/suppliers";
import { toast } from "sonner";
import {
    ShieldCheck,
    Loader2,
    Plus,
    Activity
} from "lucide-react";

// Note: Using simplistic UI imports for now, assuming standard Shadcn-like structure
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogDescription as ShadDialogDescription,
    DialogFooter as ShadDialogFooter,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogTrigger as ShadDialogTrigger,
} from "@/components/ui/dialog";

export function RecordPerformanceModal({ supplierId }: { supplierId: string }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [collabScore, setCollabScore] = useState([80]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const data = {
            supplierId,
            deliveryRate: parseFloat(formData.get("deliveryRate") as string),
            qualityScore: parseFloat(formData.get("qualityScore") as string),
            collaborationScore: collabScore[0],
            notes: formData.get("notes") as string
        };

        startTransition(async () => {
            const res = await recordPerformanceLog(data);
            if (res.success) {
                toast.success("Performance Snapshot Recorded");
                setOpen(false);
            } else {
                toast.error(res.error || "Failed to save log");
            }
        });
    };

    return (
        <ShadDialog open={open} onOpenChange={setOpen}>
            <ShadDialogTrigger asChild>
                <Button className="gap-2 font-bold shadow-lg">
                    <Plus className="h-4 w-4" /> Log Performance Audit
                </Button>
            </ShadDialogTrigger>
            <ShadDialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <ShadDialogHeader>
                        <ShadDialogTitle className="flex items-center gap-2 text-xl">
                            <Activity className="h-5 w-5 text-primary" />
                            Record Quality Audit
                        </ShadDialogTitle>
                        <ShadDialogDescription>
                            Assess supplier performance for the current review period.
                        </ShadDialogDescription>
                    </ShadDialogHeader>
                    <div className="grid gap-6 py-6 font-medium">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label htmlFor="deliveryRate">On-Time Delivery Rate (%)</Label>
                                <span className="text-xs text-primary font-bold">Latest Stats</span>
                            </div>
                            <Input id="deliveryRate" name="deliveryRate" type="number" step="0.1" defaultValue="98.5" required />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label htmlFor="qualityScore">Quality / Acceptance Rate (%)</Label>
                                <span className="text-xs text-green-600 font-bold">QC Approved</span>
                            </div>
                            <Input id="qualityScore" name="qualityScore" type="number" step="0.1" defaultValue="99.2" required />
                        </div>
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center">
                                <Label>Collaboration Score ({collabScore[0]})</Label>
                            </div>
                            <Slider
                                value={collabScore}
                                onValueChange={setCollabScore}
                                max={100}
                                step={1}
                                className="py-2"
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Qualitative metric based on responsiveness, communication, and proactiveness.
                            </p>
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="notes">Audit Notes</Label>
                            <Textarea id="notes" name="notes" placeholder="e.g. Minor delay in logistics, but quality remains top-tier." className="min-h-[100px]" />
                        </div>
                    </div>
                    <ShadDialogFooter>
                        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Recording History...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="mr-2 h-5 w-5" />
                                    Finalize & Update Score
                                </>
                            )}
                        </Button>
                    </ShadDialogFooter>
                </form>
            </ShadDialogContent>
        </ShadDialog>
    );
}
