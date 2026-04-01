import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllTasks, getTaskSummary } from "@/app/actions/workflow-tasks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Clock, AlertTriangle, CheckCircle, ListTodo } from "lucide-react";

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

const entityLinks: Record<string, (id: string) => string> = {
    requisition: (id) => `/sourcing/requisitions`,
    rfq: (id) => `/sourcing/rfqs/${id}`,
    order: (id) => `/sourcing/orders/${id}`,
    invoice: (id) => `/sourcing/invoices`,
    contract: (id) => `/sourcing/contracts`,
    supplier: (id) => `/suppliers/${id}`,
    compliance_obligation: () => `/admin/compliance`,
    agent_recommendation: () => `/admin/agents`,
};

export default async function TaskInboxPage() {
    const session = await auth();
    if (!session?.user || !['admin', 'user'].includes((session.user as any).role)) {
        redirect('/');
    }

    let tasks: any[] = [];
    let summary: any = { byStatus: {}, overdueCount: 0 };

    try {
        tasks = await getAllTasks();
        summary = await getTaskSummary();
    } catch {
        // Tables may not exist yet
    }

    const openCount = summary.byStatus?.open || 0;
    const inProgressCount = summary.byStatus?.in_progress || 0;
    const completedCount = summary.byStatus?.completed || 0;
    const overdueCount = summary.overdueCount || 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Inbox className="h-6 w-6 text-primary" />
                    Task Inbox
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Workflow tasks, assignments, escalations, and SLA tracking across procurement objects
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <ListTodo className="h-8 w-8 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">{openCount}</p>
                                <p className="text-xs text-muted-foreground">Open Tasks</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Clock className="h-8 w-8 text-purple-500" />
                            <div>
                                <p className="text-2xl font-bold">{inProgressCount}</p>
                                <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold">{overdueCount}</p>
                                <p className="text-xs text-muted-foreground">Overdue</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                            <div>
                                <p className="text-2xl font-bold">{completedCount}</p>
                                <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Task List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">All Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                    {tasks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No tasks yet. Tasks are created automatically from workflow actions.</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {tasks.map((task: any) => {
                                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !['completed', 'cancelled'].includes(task.status);
                                const linkFn = entityLinks[task.entityType];
                                const entityLink = linkFn ? linkFn(task.entityId) : '#';

                                return (
                                    <div key={task.id} className={`py-3 flex items-start justify-between gap-4 ${isOverdue ? 'bg-red-50/50 dark:bg-red-950/10 -mx-4 px-4 rounded' : ''}`}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <a href={entityLink} className="font-medium text-sm hover:text-primary transition-colors truncate">
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
                                                <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                <span className="capitalize">{task.entityType?.replace(/_/g, ' ')}</span>
                                                {task.assigneeName && <span>→ {task.assigneeName}</span>}
                                                {task.dueDate && (
                                                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                                        Due: {new Date(task.dueDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {task.nextAction && (
                                                <p className="text-xs text-primary mt-1">Next: {task.nextAction}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
