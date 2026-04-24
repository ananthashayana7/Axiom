'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, Loader2, Play } from 'lucide-react';
import { triggerAgentDispatch, type AgentName } from '@/app/actions/agents';
import { toast } from 'sonner';
import type { AgentDispatchMode } from '@/app/actions/agents/registry';

interface RunAgentButtonProps {
    agentName: AgentName;
    requiresApproval?: boolean;
    isEnabled?: boolean;
    dispatchMode?: AgentDispatchMode;
    dashboardHref?: string;
}

export function RunAgentButton({
    agentName,
    requiresApproval = false,
    isEnabled = true,
    dispatchMode = 'global',
    dashboardHref,
}: RunAgentButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    if (dispatchMode === 'workspace' && dashboardHref) {
        return (
            <Link href={dashboardHref} className="flex-1">
                <Button
                    size="sm"
                    className="w-full gap-1"
                    variant="outline"
                    disabled={!isEnabled}
                >
                    <ArrowUpRight className="h-3 w-3" />
                    Open Workspace
                </Button>
            </Link>
        );
    }

    const handleRun = async () => {
        setIsLoading(true);
        try {
            const result = await triggerAgentDispatch(agentName);

            if (result.success) {
                toast.success(`${agentName} executed successfully`, {
                    description: result.reasoning || 'Agent task completed.'
                });
            } else {
                toast.error(`Agent ${agentName} failed`, {
                    description: result.error || 'Check telemetry for details.'
                });
            }
        } catch {
            toast.error('Dispatch error', {
                description: 'Failed to communicate with the agent engine.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            className="flex-1 gap-1"
            onClick={handleRun}
            disabled={isLoading || !isEnabled}
            variant={requiresApproval ? "outline" : "default"}
        >
            {isLoading ? (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running...
                </>
            ) : (
                <>
                    <Play className="h-3 w-3" />
                    {requiresApproval ? 'Admin Run' : 'Run'}
                </>
            )}
        </Button>
    );
}
