'use client'

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, CheckCircle2, PauseCircle } from "lucide-react";
import { toast } from "sonner";

import { updateTaskStatus } from "@/app/actions/workflow-tasks";
import { Button } from "@/components/ui/button";

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled' | 'escalated';

export function TaskRowActions({ taskId, status }: { taskId: string; status: TaskStatus }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = (nextStatus: TaskStatus, successMessage: string) => {
        startTransition(async () => {
            try {
                await updateTaskStatus(taskId, nextStatus);
                toast.success(successMessage);
                router.refresh();
            } catch {
                toast.error("Failed to update task");
            }
        });
    };

    if (status === 'completed' || status === 'cancelled') {
        return null;
    }

    return (
        <div className="flex flex-wrap justify-end gap-2">
            {status === 'open' ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleStatusUpdate('in_progress', "Task moved to in progress")}
                    className="h-8 text-[10px] font-bold uppercase"
                >
                    <Play className="mr-1 h-3 w-3" />
                    Start
                </Button>
            ) : null}
            {status === 'blocked' || status === 'escalated' ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleStatusUpdate('in_progress', "Task resumed")}
                    className="h-8 text-[10px] font-bold uppercase"
                >
                    <Play className="mr-1 h-3 w-3" />
                    Resume
                </Button>
            ) : null}
            {status === 'open' || status === 'in_progress' ? (
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleStatusUpdate('blocked', "Task marked as blocked")}
                    className="h-8 text-[10px] font-bold uppercase"
                >
                    <PauseCircle className="mr-1 h-3 w-3" />
                    Block
                </Button>
            ) : null}
            {status === 'open' || status === 'in_progress' || status === 'blocked' || status === 'escalated' ? (
                <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleStatusUpdate('completed', "Task completed")}
                    className="h-8 text-[10px] font-bold uppercase"
                >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Complete
                </Button>
            ) : null}
        </div>
    );
}
