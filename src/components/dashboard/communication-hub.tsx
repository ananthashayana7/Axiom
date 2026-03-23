"use client"

import { useMemo, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mail, MessageSquare, ShieldAlert, Users, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { sendEscalationPing } from "@/app/actions/mail"

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

interface DepartmentLead {
    id?: string;
    name: string;
    email: string;
    department?: string | null;
}

type DisplayDepartment = {
    id?: string;
    department?: string | null;
    name: string;
    email: string;
    description: string;
    initials: string;
    icon?: unknown;
    color?: string;
};

export function CommunicationHub({ leads = [] }: { leads?: DepartmentLead[] }) {
    const [isPending, startTransition] = useTransition();

    const displayDepartments = useMemo(() => {
        const departments = [...DEFAULT_DEPARTMENTS];

        leads.forEach(lead => {
            const normalizedDepartment = lead.department?.trim();
            if (!normalizedDepartment || !lead.email) return;

            const existingIndex = departments.findIndex(
                (d) => d.name.toLowerCase().includes(normalizedDepartment.toLowerCase()),
            );
            const leadEntry = {
                ...departments[Math.max(existingIndex, 0)],
                id: lead.id,
                department: normalizedDepartment,
                name: `${lead.name} (${normalizedDepartment})`,
                email: lead.email,
                description: `Lead escalation inbox for ${normalizedDepartment}`,
                initials: lead.name.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
                icon: existingIndex === -1 ? Users : departments[Math.max(existingIndex, 0)].icon,
                color: existingIndex === -1 ? "text-blue-500" : departments[Math.max(existingIndex, 0)].color,
            };

            if (existingIndex !== -1) {
                departments[existingIndex] = leadEntry;
            } else {
                departments.push(leadEntry);
            }
        });

        return departments;
    }, [leads]);

    const handleNotify = (dept: DisplayDepartment) => {
        if (!dept.id) {
            toast.info(`Escalation details for ${dept.name}`, {
                description: `Use ${dept.email} to reach this team while lead mapping is being configured.`,
            });
            return;
        }

        startTransition(async () => {
            if (!dept.id) {
                toast.error("Lead mapping is incomplete for this department.");
                return;
            }
            const result = await sendEscalationPing({
                leadId: dept.id,
                leadName: dept.name,
                leadEmail: dept.email,
                department: dept.department || dept.name,
            });

            if (!result.success) {
                toast.error(result.error || "Failed to dispatch escalation ping");
                return;
            }

            toast.success(`Escalation ping sent to ${dept.name}`, {
                description: result.warning
                    ? "In-app alert created. Email delivery needs SMTP configuration."
                    : "The lead received an in-app alert and email notification.",
            });
        });
    }

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
                {displayDepartments.map((dept, index: number) => (
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
                                onClick={() => handleNotify(dept)}
                                disabled={isPending}
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
