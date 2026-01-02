'use client'

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postComment } from "@/app/actions/activity";
import { MessageSquare, User } from "lucide-react";

interface Comment {
    id: string;
    text: string;
    createdAt: Date | null;
    userName: string;
}

interface CommentsSectionProps {
    entityType: string;
    entityId: string;
    initialComments: Comment[];
}

export function CommentsSection({ entityType, entityId, initialComments }: CommentsSectionProps) {
    const [comments, setComments] = useState(initialComments);
    const [text, setText] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;

        startTransition(async () => {
            const result = await postComment(entityType, entityId, text);
            if (result.success) {
                // Optimistically update or just clear and let revalidation handle it?
                // For better UX, we'll wait for revalidation or manually update state for now
                setText("");
                // Realistically, revalidatePath will refresh the server component data
                // But since we are in a client component, we might want to manually prepend
                setComments([{
                    id: Math.random().toString(), // temporary id
                    text,
                    createdAt: new Date(),
                    userName: "You", // Will be refreshed on next load
                }, ...comments]);
            }
        });
    };

    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Team Collaboration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-2">
                    <Textarea
                        placeholder="Add a comment or note..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="min-h-[100px]"
                    />
                    <Button type="submit" disabled={isPending || !text.trim()}>
                        {isPending ? "Posting..." : "Post Comment"}
                    </Button>
                </form>

                <div className="space-y-4">
                    {comments.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No comments yet. Start the conversation!
                        </p>
                    )}
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4 border-b pb-4 last:border-0">
                            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold">{comment.userName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'Just now'}
                                    </p>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
