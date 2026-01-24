'use client'

import React, { useEffect, useState, useTransition } from "react";
import { getSupplierDocuments, uploadSupplierDocument } from "@/app/actions/portal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    FileText,
    Upload,
    Download,
    Trash2,
    Calendar,
    ChevronRight,
    Search,
    Plus,
    Loader2,
    FileCheck,
    FileWarning
} from "lucide-react";
import { toast } from "sonner";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function SupplierDocuments() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadDocs();
    }, []);

    const loadDocs = async () => {
        const data = await getSupplierDocuments();
        setDocs(data);
        setLoading(false);
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const res = await uploadSupplierDocument(formData);
            if (res.success) {
                toast.success("Document uploaded successfully");
                setIsModalOpen(false);
                loadDocs();
            } else {
                toast.error(res.error || "Upload failed");
            }
        });
    };

    if (loading) return <div className="p-8">Syncing vault...</div>;

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Document Vault</h1>
                    <p className="text-muted-foreground mt-1">Manage your contracts, certifications, and compliance documentation.</p>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 font-bold h-11 shadow-lg bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100">
                            <Plus className="h-4 w-4" /> Upload New Document
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <form onSubmit={handleUpload}>
                            <DialogHeader>
                                <DialogTitle>Secure Upload</DialogTitle>
                                <DialogDescription>
                                    Add a new document to your Axiom profile.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Document Name</Label>
                                    <Input id="name" name="name" placeholder="e.g. ISO 9001 Certificate" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="type">Document Type</Label>
                                    <Select name="type" defaultValue="other">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contract">Contract</SelectItem>
                                            <SelectItem value="invoice">Invoice</SelectItem>
                                            <SelectItem value="quote">Quote</SelectItem>
                                            <SelectItem value="license">License / Certification</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="file">File (PDF/Image)</Label>
                                    <div className="flex items-center justify-center border-2 border-dashed rounded-xl p-8 hover:bg-muted/50 transition-colors cursor-pointer group">
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="text-sm text-muted-foreground">Click to select files</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" className="w-full h-11 font-bold" disabled={isPending}>
                                    {isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Verify & Upload"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-6">
                <Card className="shadow-sm border-none bg-gradient-to-r from-amber-50 to-stone-50/20 border-amber-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileCheck className="h-5 w-5 text-amber-600" />
                            Vault Security Notice
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-blue-800/80 leading-relaxed max-w-2xl">
                            All documents are encrypted at rest and shared only with authorized procurement managers.
                            Ensure all certifications are up to date to maintain your Preferred Supplier status.
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Stored Documents</CardTitle>
                                <CardDescription>Access and manage your digital archive.</CardDescription>
                            </div>
                            <div className="relative w-72">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter by name..." className="pl-9 bg-muted/30 border-none shadow-none" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {docs.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center gap-4">
                                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                                        <FileWarning className="h-8 w-8 text-muted-foreground opacity-20" />
                                    </div>
                                    <p className="text-muted-foreground">Your vault is currently empty.</p>
                                </div>
                            ) : (
                                docs.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-muted-foreground/10 hover:border-primary/20 hover:bg-muted/30 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                                <FileText className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">{doc.name}</span>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <Badge variant="secondary" className="text-[10px] uppercase h-5 font-bold">
                                                        {doc.type}
                                                    </Badge>
                                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(doc.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
