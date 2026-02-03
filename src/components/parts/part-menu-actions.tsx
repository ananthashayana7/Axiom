'use client';

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePart, deletePart } from "@/app/actions/parts";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getMarketTrend } from "@/app/actions/intelligence";

interface Part {
    id: string;
    sku: string;
    name: string;
    category: string;
    stockLevel: number;
    price: string | null;
    marketTrend: string | null;
    reorderPoint: number | null;
    minStockLevel: number | null;
}

export function PartMenuActions({ part }: { part: Part }) {
    const [open, setOpen] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isFetchingTrend, setIsFetchingTrend] = useState(false);
    const [marketTrendValue, setMarketTrendValue] = useState(part.marketTrend || 'stable');
    const [trendReason, setTrendReason] = useState<string | null>(null);
    const [trendSource, setTrendSource] = useState<string | null>(null);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deletePart(part.id);
            if (result.success) {
                toast.success("Part deleted successfully");
                setShowDeleteAlert(false);
            } else {
                toast.error(result.error || "Failed to delete part");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUpdate = async (formData: FormData) => {
        setIsUpdating(true);
        try {
            const result = await updatePart(part.id, formData);
            if (result.success) {
                toast.success("Part updated successfully");
                setShowEditDialog(false);
            } else {
                toast.error("Failed to update part");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 flex items-center gap-1 border-amber-100 bg-amber-50/50 text-amber-700 hover:bg-amber-600 hover:text-white transition-all duration-300 rounded-lg shadow-sm group/btn"
                onClick={() => setShowEditDialog(true)}
            >
                <Pencil className="h-3 w-3 transition-transform group-hover/btn:scale-110" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Edit</span>
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 flex items-center gap-1 border-rose-100 bg-rose-50/50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all duration-300 rounded-lg shadow-sm group/btn"
                onClick={() => setShowDeleteAlert(true)}
            >
                <Trash2 className="h-3 w-3 transition-transform group-hover/btn:scale-110" />
                <span className="text-[9px] font-black uppercase tracking-tighter">Del</span>
            </Button>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Part</DialogTitle>
                        <DialogDescription>
                            Make changes to the part details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={handleUpdate}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={part.name}
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
                                    defaultValue={part.sku}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="category" className="text-right">
                                    Category
                                </Label>
                                <Select name="category" defaultValue={part.category} required>
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
                                    defaultValue={part.stockLevel}
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
                                    defaultValue={part.price || '0.00'}
                                    className="col-span-3 font-bold"
                                    min="0"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="reorderPoint" className="text-right text-[10px] font-bold uppercase">Reorder Point</Label>
                                <Input
                                    id="reorderPoint"
                                    name="reorderPoint"
                                    type="number"
                                    defaultValue={part.reorderPoint || 50}
                                    className="col-span-1"
                                    required
                                />
                                <Label htmlFor="minStockLevel" className="text-right text-[10px] font-bold uppercase">Min Stock</Label>
                                <Input
                                    id="minStockLevel"
                                    name="minStockLevel"
                                    type="number"
                                    defaultValue={part.minStockLevel || 20}
                                    className="col-span-1"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="marketTrend" className="text-right">
                                    Trend
                                </Label>
                                <Select name="marketTrend" value={marketTrendValue} onValueChange={setMarketTrendValue}>
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <div />
                                <div className="col-span-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-2"
                                        onClick={async () => {
                                            const nameInput = (document.getElementById('name') as HTMLInputElement)?.value;
                                            const categoryInput = part.category; // Or get from select if changed
                                            if (!nameInput) return toast.error("Please enter a part name first");

                                            setIsFetchingTrend(true);
                                            try {
                                                const intelligence = await getMarketTrend(nameInput, categoryInput);
                                                setMarketTrendValue(intelligence.trend);
                                                setTrendReason(intelligence.reason);
                                                setTrendSource(intelligence.source);
                                                toast.success(`Intelligence fetched from ${intelligence.source}`);
                                            } catch (error) {
                                                toast.error("Failed to fetch market intelligence");
                                            } finally {
                                                setIsFetchingTrend(false);
                                            }
                                        }}
                                        disabled={isFetchingTrend}
                                    >
                                        {isFetchingTrend ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                                        Get Real-Time Intelligence
                                    </Button>
                                    {trendReason && (
                                        <div className="mt-2 text-[10px] text-muted-foreground leading-tight italic bg-muted/50 p-2 rounded border border-dashed">
                                            <p>{trendReason}</p>
                                            {trendSource && (
                                                <p className="mt-1 font-bold not-italic text-stone-500 uppercase tracking-widest text-[8px]">
                                                    Source: {trendSource}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="max-w-[90vw] sm:max-w-[425px] overflow-hidden">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the part
                            <span className="font-semibold text-foreground"> {part.name} </span>
                            ({part.sku}) and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
