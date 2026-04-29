import { Inbox, Clock, AlertTriangle, CheckCircle, ListTodo } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { getAllTasks, getInboxTasks, getTaskSummary } from "@/app/actions/workflow-tasks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    escalated: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

const entityLinks: Record<string, (id?: string) => string> = {
    requisition: (id?: string) => id ? `/sourcing/requisitions?id=${id}` : `/sourcing/requisitions`,
    rfq: (id?: string) => `/sourcing/rfqs/${id}`,
    order: (id?: string) => `/sourcing/orders/${id}`,
    invoice: () => `/sourcing/invoices`,
    contract: () => `/sourcing/contracts`,
    supplier: (id?: string) => `/suppliers/${id}`,
    compliance_obligation: () => `/admin/compliance`,
    agent_recommendation: () => `/admin/agents`,
};

type TaskData = Awaited<ReturnType<typeof getAllTasks>> | Awaited<ReturnType<typeof getInboxTasks>>;
type TaskSummary = Awaited<ReturnType<typeof getTaskSummary>>;

export default async function TaskInboxPage() {
    const session = await auth();
    if (!session?.user || !['admin', 'user'].includes(session.user.role)) {
        redirect('/');
    }

    let tasks: TaskData = [];
    let summary: TaskSummary = { byStatus: {}, overdueCount: 0 };

    try {
        tasks = session.user.role === 'admin' ? await getAllTasks() : await getInboxTasks();
        summary = await getTaskSummary();
    } catch {
        // Tables may not exist yet.
    }

    const openCount = summary.byStatus?.open || 0;
    const inProgressCount = summary.byStatus?.in_progress || 0;
    const completedCount = summary.byStatus?.completed || 0;
    const overdueCount = summary.overdueCount || 0;
    const activeTasks = tasks.filter((task) => !['completed', 'cancelled'].includes(task.status));
    const resolvedTasks = tasks.filter((task) => ['completed', 'cancelled'].includes(task.status));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold">
                    <Inbox className="h-6 w-6 text-primary" />
                    Task Inbox
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Workflow tasks, assignments, escalations, and SLA tracking across procurement objects.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={<ListTodo className="h-8 w-8 text-blue-500" />} label="Open Tasks" value={openCount} />
                <SummaryCard icon={<Clock className="h-8 w-8 text-purple-500" />} label="In Progress" value={inProgressCount} />
                <SummaryCard icon={<AlertTriangle className="h-8 w-8 text-red-500" />} label="Overdue" value={overdueCount} />
                <SummaryCard icon={<CheckCircle className="h-8 w-8 text-green-500" />} label="Completed" value={completedCount} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">All Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                    {tasks.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <Inbox className="mx-auto mb-3 h-12 w-12 opacity-30" />
                            <p className="text-sm">No tasks yet. Tasks are created automatically from workflow actions.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <TaskSection title="Active Queue" tasks={activeTasks} emptyMessage="No active tasks remain after reconciliation." />
                            <TaskSection title="Resolved Recently" tasks={resolvedTasks.slice(0, 10)} emptyMessage="No resolved tasks yet." />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                    {icon}
                    <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TaskSection({
    title,
    tasks,
    emptyMessage,
}: {
    title: string;
    tasks: TaskData;
    emptyMessage: string;
}) {
    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{title}</h3>
                <Badge variant="outline">{tasks.length}</Badge>
            </div>
            <div className="divide-y rounded-xl border">
                {tasks.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        {emptyMessage}
                    </div>
                ) : (
                    tasks.map((task) => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'cancelled'].includes(task.status);
                        const linkFn = entityLinks[task.entityType];
                        const entityLink = linkFn ? linkFn(task.entityId) : '#';
                        const assigneeName = 'assigneeName' in task ? task.assigneeName : undefined;

                        return (
                            <div key={task.id} className={`flex items-start justify-between gap-4 px-4 py-3 ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                        <a href={entityLink} className="truncate text-sm font-medium transition-colors hover:text-primary">
                                            {task.title}
                                        </a>
                                        <Badge variant="outline" className={`text-[10px] ${priorityColors[task.priority] || ''}`}>
                                            {task.priority}
                                        </Badge>
                                        <Badge variant="outline" className={`text-[10px] ${statusColors[task.status] || ''}`}>
                                            {task.status?.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                    {task.description && (
                                        <p className="truncate text-xs text-muted-foreground">{task.description}</p>
                                    )}
                                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="capitalize">{task.entityType?.replace(/_/g, ' ')}</span>
                                        {assigneeName && <span>to {assigneeName}</span>}
                                        {task.dueDate && (
                                            <span className={isOverdue ? 'font-medium text-red-600' : ''}>
                                                Due: {new Date(task.dueDate).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    {task.nextAction && (
                                        <p className="mt-1 text-xs text-primary">Next: {task.nextAction}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
