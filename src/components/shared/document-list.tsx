'use client'

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Trash2, Plus, Upload, Eye } from "lucide-react";
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

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export function DocumentList({ supplierId, orderId, documents: initialDocs, isAdmin }: DocumentListProps) {
    const [isPending, startTransition] = useTransition();
    const [pendingType, setPendingType] = useState<Document["type"]>('contract');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const triggerUpload = (type: Document["type"]) => {
        setPendingType(type);
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
            toast.error("File size too large. Max 10MB allowed.");
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            if (typeof dataUrl !== 'string') {
                toast.error("Failed to read selected file");
                return;
            }

            startTransition(async () => {
                const result = await addDocument({
                    supplierId,
                    orderId,
                    name: file.name,
                    type: pendingType,
                    url: dataUrl,
                });

                if (result.success) {
                    toast.success(`Uploaded '${file.name}'`);
                } else {
                    toast.error(result.error || "Failed to upload document");
                }
            });
        };
        reader.onerror = () => toast.error("Failed to read selected file");
        reader.readAsDataURL(file);
        event.target.value = '';
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
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.xlsx,.xls"
                            onChange={handleFileUpload}
                        />
                        <Button size="sm" variant="outline" onClick={() => triggerUpload(orderId ? 'invoice' : 'contract')} disabled={isPending}>
                            <Upload className="h-3 w-3 mr-1" />
                            Upload {orderId ? 'Invoice' : 'Contract'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => triggerUpload('other')} disabled={isPending}>
                            <Plus className="h-3 w-3 mr-1" />
                            Supporting Doc
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
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                        if (doc.url) {
                                            window.open(doc.url, '_blank');
                                        } else {
                                            toast.info("Preview unavailable", {
                                                description: `The file '${doc.name}' does not have a stored preview URL yet.`,
                                            });
                                        }
                                    }}
                                >
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
                                <p className="text-[10px] text-muted-foreground mt-1 underline cursor-pointer" onClick={() => triggerUpload('other')}>
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
