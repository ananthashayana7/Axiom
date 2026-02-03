"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Mail, MessageSquare, ShieldAlert, Users, CreditCard, Package } from "lucide-react"
import { toast } from "sonner"

const DEFAULT_DEPARTMENTS = [
    {
        name: "Finance & Budgeting",
        email: "finance@axiom.com",
        description: "Standard budget & payment channel",
        initials: "FN",
        icon: CreditCard,
        color: "text-emerald-500"
    },
    {
        name: "Procurement Team",
        email: "procurement@axiom.com",
        description: "Enterprise sourcing & PO issues",
        initials: "PR",
        icon: ShieldAlert,
        color: "text-orange-500"
    }
]

export function CommunicationHub({ leads = [] }: { leads?: any[] }) {
    const handleNotify = (dept: string) => {
        toast.success(`Priority alert dispatched to ${dept}`);
    }

    // Merge real leads with defaults, preferring leads if they exist for a department
    const displayDepartments = [...DEFAULT_DEPARTMENTS];

    // Simple heuristic: if we have leads, add them or replace defaults
    leads.forEach(lead => {
        const existingIndex = displayDepartments.findIndex(d => d.name.toLowerCase().includes(lead.department.toLowerCase()));
        if (existingIndex !== -1) {
            displayDepartments[existingIndex] = {
                ...displayDepartments[existingIndex],
                name: `${lead.name} (${lead.department})`,
                email: lead.email,
                initials: lead.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
            };
        } else {
            displayDepartments.push({
                name: lead.name,
                email: lead.email,
                description: `Lead: ${lead.department}`,
                initials: lead.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                icon: Users,
                color: "text-blue-500"
            });
        }
    });

    return (
        <Card className="glass-card border-slate-200/50 dark:border-slate-800/50 shadow-2xl overflow-hidden group">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 backdrop-blur-md">
                <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                    <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-200 dark:shadow-none">
                        <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    Escalation Channels
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Direct access to departmental leads
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid gap-3">
                {displayDepartments.map((dept: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-900/50 hover:shadow-lg transition-all group/item">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-md">
                                    <AvatarFallback className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                                        {dept.initials}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover/item:text-emerald-600 transition-colors">
                                    {dept.name}
                                </h4>
                                <p className="text-[10px] text-muted-foreground font-medium">{dept.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-40 group-hover/item:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => handleNotify(dept.name)}
                            >
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                onClick={() => window.open(`mailto:${dept.email}`)}
                            >
                                <Mail className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
