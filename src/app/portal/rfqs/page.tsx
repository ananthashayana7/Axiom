import { getSupplierRFQs } from "@/app/actions/portal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

const statusClasses: Record<string, string> = {
    invited: 'bg-blue-100 text-blue-700 border-blue-200',
    quoted: 'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-stone-100 text-stone-600 border-stone-200',
};

export default async function SupplierRFQsPage() {
    const rfqs = await getSupplierRFQs();

    return (
        <div className="flex min-h-full flex-col bg-muted/40 p-4 lg:p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" /> Incoming Bids
                </h1>
                <p className="text-muted-foreground mt-1 font-medium">RFQs and sourcing invitations from the procurement team.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bid Invitations</CardTitle>
                    <CardDescription>{rfqs.length} invitation(s) available</CardDescription>
                </CardHeader>
                <CardContent>
                    {rfqs.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-6 text-center">No bid invitations yet. You&apos;ll see them here when the procurement team invites you to quote.</p>
                    ) : (
                        <div className="rounded-md border overflow-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">RFQ</th>
                                        <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Title</th>
                                        <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Status</th>
                                        <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Date</th>
                                        <th className="h-11 px-4 text-left text-xs uppercase text-muted-foreground">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rfqs.map((rfq) => (
                                        <tr key={rfq.id} className="border-b hover:bg-muted/40 transition-colors">
                                            <td className="p-4 font-mono text-xs text-primary font-bold">{rfq.id?.slice(0, 8)}</td>
                                            <td className="p-4 font-medium">{rfq.title || 'Untitled RFQ'}</td>
                                            <td className="p-4">
                                                <Badge variant="outline" className={statusClasses[rfq.status || 'pending'] || statusClasses.pending}>
                                                    {rfq.status || 'pending'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-xs">
                                                {rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '—'}
                                            </td>
                                            <td className="p-4">
                                                <Link
                                                    href={`/portal/rfqs/${rfq.rfqId}`}
                                                    className="text-primary hover:underline text-xs font-medium"
                                                >
                                                    View & Quote →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
