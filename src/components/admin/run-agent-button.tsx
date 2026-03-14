'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { triggerAgentDispatch, type AgentName } from '@/app/actions/agents';
import { toast } from 'sonner';

interface RunAgentButtonProps {
    agentName: AgentName;
}

export function RunAgentButton({ agentName }: RunAgentButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

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
            disabled={isLoading}
        >
            {isLoading ? (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running...
                </>
            ) : (
                <>
                    <Play className="h-3 w-3" />
                    Run
                </>
            )}
        </Button>
    );
}
