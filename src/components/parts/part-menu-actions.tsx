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

interface Part {
    id: string;
    sku: string;
    name: string;
    category: string;
    stockLevel: number;
    price: string | null;
    marketTrend: string | null;
}

export function PartMenuActions({ part }: { part: Part }) {
    const [open, setOpen] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deletePart(part.id);
            if (result.success) {
                toast.success("Part deleted successfully");
                setShowDeleteAlert(false);
            } else {
                toast.error("Failed to delete part");
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
        <>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowDeleteAlert(true)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
                                <Label htmlFor="marketTrend" className="text-right">
                                    Trend
                                </Label>
                                <Select name="marketTrend" defaultValue={part.marketTrend || 'stable'}>
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
                <AlertDialogContent>
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
        </>
    );
}
