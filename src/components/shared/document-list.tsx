'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Trash2, Plus, ExternalLink, FileDown, Eye } from "lucide-react";
import { addDocument, deleteDocument } from "@/app/actions/documents";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Document {
    id: string;
    name: string;
    type: 'contract' | 'invoice' | 'quote' | 'license' | 'other';
    url: string | null;
    createdAt: Date | null;
}

interface DocumentListProps {
    supplierId: string;
    orderId?: string;
    documents: Document[];
    isAdmin: boolean;
}

export function DocumentList({ supplierId, orderId, documents: initialDocs, isAdmin }: DocumentListProps) {
    const [isPending, startTransition] = useTransition();

    const handleMockUpload = (type: any) => {
        const name = `${type.charAt(0).toUpperCase() + type.slice(1)}_${Math.random().toString(36).substring(7)}.pdf`;

        startTransition(async () => {
            const result = await addDocument({
                supplierId,
                orderId,
                name,
                type,
            });
            if (result.success) {
                toast.success(`Mock document '${name}' added.`);
            } else {
                toast.error("Failed to add document");
            }
        });
    };

    const handleDelete = (docId: string) => {
        startTransition(async () => {
            const result = await deleteDocument(docId, supplierId, orderId);
            if (result.success) {
                toast.success("Document removed");
            } else {
                toast.error("Failed to remove document");
            }
        });
    };

    return (
        <Card className="h-full border-accent/30 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Documents
                    </CardTitle>
                    <CardDescription>Contracts, quotes, and compliance files.</CardDescription>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleMockUpload('contract')} disabled={isPending}>
                            <Plus className="h-3 w-3 mr-1" />
                            Contract
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {initialDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-md bg-background flex items-center justify-center border shadow-sm group-hover:bg-primary/5">
                                    <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">{doc.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                                            {doc.type}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {isAdmin && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(doc.id)}
                                        disabled={isPending}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    {initialDocs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg bg-muted/10">
                            <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                            {isAdmin && (
                                <p className="text-[10px] text-muted-foreground mt-1 underline cursor-pointer" onClick={() => handleMockUpload('other')}>
                                    Upload your first document
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
