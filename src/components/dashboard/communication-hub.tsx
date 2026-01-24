"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Mail, MessageSquare, ShieldAlert, Users, CreditCard, Package } from "lucide-react"
import { toast } from "sonner"

const DEPARTMENTS = [
    {
        name: "Finance & Budgeting",
        email: "finance@axiom.com",
        description: "Budget approvals & payment queries",
        initials: "FN",
        icon: CreditCard,
        color: "text-blue-500"
    },
    {
        name: "Supplier Operations",
        email: "supplier.ops@axiom.com",
        description: "Vendor onboarding & compliance",
        initials: "OP",
        icon: Users,
        color: "text-green-500"
    },
    {
        name: "Procurement Team",
        email: "procurement@axiom.com",
        description: "Purchase orders & sourcing",
        initials: "PR",
        icon: ShieldAlert,
        color: "text-orange-500"
    },
    {
        name: "Inventory Control",
        email: "inventory@axiom.com",
        description: "Stock levels & warehousing",
        initials: "IN",
        icon: Package,
        color: "text-purple-500"
    }
]

export function CommunicationHub() {
    const handleNotify = (dept: string) => {
        // In a real app, this would trigger a backend notification event
        toast.success(`Alert sent to ${dept} Dashboard`);
    }

    return (
        <Card className="shadow-lg border-primary/10">
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Departmental Contacts
                </CardTitle>
                <CardDescription>
                    Direct channels for escalation and support.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid gap-4">
                {DEPARTMENTS.map((dept, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-card border hover:border-primary/30 transition-colors group">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">{dept.initials}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                    {dept.name}
                                </h4>
                                <p className="text-xs text-muted-foreground">{dept.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleNotify(dept.name)} title="Trigger Dashboard Alert">
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => window.open(`mailto:${dept.email}`)} title={`Email ${dept.email}`}>
                                <Mail className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
