'use client';

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { addPart } from "@/app/actions/parts";
import { toast } from "sonner";

export function CreatePartDialog() {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await addPart(formData);
            if (result.success) {
                toast.success("Part added successfully");
                setOpen(false);
            } else {
                toast.error("Failed to add part");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Part
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Part</DialogTitle>
                    <DialogDescription>
                        Enter the details of the new part below. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="e.g. Industrial Bearing"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sku" className="text-right">
                                SKU
                            </Label>
                            <Input
                                id="sku"
                                name="sku"
                                placeholder="e.g. PART-001"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">
                                Category
                            </Label>
                            <Select name="category" required>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                                    <SelectItem value="Electronics">Electronics</SelectItem>
                                    <SelectItem value="Hydraulics">Hydraulics</SelectItem>
                                    <SelectItem value="Plumbing">Plumbing</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="stock" className="text-right">
                                Stock
                            </Label>
                            <Input
                                id="stock"
                                name="stock"
                                type="number"
                                defaultValue="0"
                                className="col-span-3"
                                min="0"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="price" className="text-right">
                                Price (₹)
                            </Label>
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                step="0.01"
                                defaultValue="0.00"
                                className="col-span-3 font-bold"
                                min="0"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="marketTrend" className="text-right">
                                Trend
                            </Label>
                            <Select name="marketTrend" defaultValue="stable">
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select trend" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="stable">Stable</SelectItem>
                                    <SelectItem value="up">Rising</SelectItem>
                                    <SelectItem value="down">Falling</SelectItem>
                                    <SelectItem value="volatile">Volatile</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Part
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
