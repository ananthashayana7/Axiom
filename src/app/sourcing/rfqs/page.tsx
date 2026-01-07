import { getRFQs } from "@/app/actions/rfqs";
import { getParts } from "@/app/actions/parts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, History, MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { CreateRFQModal } from "@/components/sourcing/create-rfq-modal";
import { auth } from "@/auth";

export const dynamic = 'force-dynamic';

export default async function RFQsPage() {
    const rfqs = await getRFQs();
    const parts = await getParts();
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    return (
        <div className="flex min-h-screen flex-col bg-muted/40 p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sourcing Requests (RFQs)</h1>
                    <p className="text-muted-foreground mt-1">Manage quotations and AI-powered supplier selection.</p>
                </div>
                {isAdmin && <CreateRFQModal parts={parts} />}
            </div>

            <div className="grid gap-6">
                {rfqs.map((rfq: any) => (
                    <Card key={rfq.id} className="hover:shadow-md transition-shadow border-accent/20">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="text-xl">{rfq.title}</CardTitle>
                                    <Badge variant={
                                        rfq.status === 'open' ? 'default' :
                                            rfq.status === 'draft' ? 'secondary' :
                                                'outline'
                                    }>
                                        {rfq.status?.toUpperCase()}
                                    </Badge>
                                </div>
                                <CardDescription className="flex items-center gap-2">
                                    <History size={14} />
                                    Created {new Date(rfq.createdAt!).toLocaleDateString()} • {rfq.items.length} items
                                </CardDescription>
                            </div>
                            <Link href={`/sourcing/rfqs/${rfq.id}`}>
                                <Button variant="ghost" className="gap-2">
                                    View Details
                                    <ArrowRight size={16} />
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2 items-center text-sm">
                                <span className="text-muted-foreground">AI Selected Suppliers:</span>
                                {rfq.suppliers.map((s: any) => (
                                    <Badge key={s.id} variant="secondary" className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary px-3">
                                        {s.supplier.name}
                                    </Badge>
                                ))}
                                {rfq.suppliers.length === 0 && <span className="text-muted-foreground italic">None invited yet</span>}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {rfqs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 bg-background rounded-xl border-2 border-dashed border-accent/30">
                        <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold">No sourcing requests found</h3>
                        <p className="text-muted-foreground mb-6">Create your first RFQ to start automated supplier selection.</p>
                        {isAdmin && <CreateRFQModal parts={parts} />}
                    </div>
                )}
            </div>
        </div>
    );
}
