'use client'

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Send, Sparkles, Loader2 } from "lucide-react";
import { processCopilotQuery } from "@/app/actions/ai";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function CopilotPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your Axiom Copilot. How can I help you with your procurement data today?" }
    ]);
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isPending) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        startTransition(async () => {
            const response = await processCopilotQuery(userMessage);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/30">
            <div className="p-8 pb-4">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="h-8 w-8 text-primary" />
                    Axiom Copilot
                </h1>
                <p className="text-muted-foreground mt-1">AI-powered procurement insights and assistance.</p>
            </div>

            <div className="flex-1 overflow-hidden px-8 pb-8 flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden border-accent shadow-lg">
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-6 space-y-6"
                    >
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-accent'
                                    }`}>
                                    {m.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                                </div>
                                <div className={`max-w-[80%] rounded-lg p-4 text-sm ${m.role === 'assistant'
                                    ? 'bg-muted border'
                                    : 'bg-primary text-primary-foreground'
                                    }`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {isPending && (
                            <div className="flex gap-4">
                                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                                    <Bot size={18} />
                                </div>
                                <div className="bg-muted border rounded-lg p-4 flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground italic">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-background">
                        <form onSubmit={handleSend} className="flex gap-2">
                            <Input
                                placeholder="Ask about spend, risks, or suppliers..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1"
                                disabled={isPending}
                            />
                            <Button type="submit" disabled={isPending || !input.trim()}>
                                <Send className="h-4 w-4 outline-none" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}
