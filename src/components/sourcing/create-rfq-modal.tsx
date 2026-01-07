'use client'

import { useState, useTransition } from "react";
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
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { createRFQ } from "@/app/actions/rfqs";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Part {
    id: string;
    sku: string;
    name: string;
    category: string;
}

interface CreateRFQModalProps {
    parts: Part[];
}

export function CreateRFQModal({ parts }: CreateRFQModalProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [items, setItems] = useState<{ partId: string; quantity: number }[]>([
        { partId: "", quantity: 1 }
    ]);

    const handleAddItem = () => {
        setItems([...items, { partId: "", quantity: 1 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;

        const validItems = items.filter(i => i.partId !== "");
        if (validItems.length === 0) {
            toast.error("Please add at least one part");
            return;
        }

        startTransition(async () => {
            const result = await createRFQ(title, description, validItems);
            if (result.success) {
                toast.success("RFQ created! AI has selected the best suppliers.");
                setOpen(false);
                setItems([{ partId: "", quantity: 1 }]);
            } else {
                toast.error(result.error || "Failed to create RFQ");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 shadow-sm">
                    <Plus size={18} />
                    New Sourcing Request
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Create Sourcing Request
                        </DialogTitle>
                        <DialogDescription>
                            Define your requirements. Our AI will automatically select the best suppliers based on performance and risk.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Project Title</Label>
                            <Input id="title" name="title" placeholder="e.g., Q1 Electronics Sourcing" required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Input id="description" name="description" placeholder="Short summary of the project" />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Parts & Quantities</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="h-8 gap-1">
                                    <Plus size={14} />
                                    Add Part
                                </Button>
                            </div>

                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3 items-end p-3 rounded-lg border bg-muted/20">
                                    <div className="flex-1 space-y-2">
                                        <Label className="text-[10px] uppercase text-muted-foreground uppercase">Select Part</Label>
                                        <Select
                                            value={item.partId}
                                            onValueChange={(val) => handleUpdateItem(index, 'partId', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="SKU / Name" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {parts.map(part => (
                                                    <SelectItem key={part.id} value={part.id}>
                                                        {part.sku} - {part.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-[100px] space-y-2">
                                        <Label className="text-[10px] uppercase text-muted-foreground uppercase">Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRemoveItem(index)}
                                        disabled={items.length === 1}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Create & Run AI Selection
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
