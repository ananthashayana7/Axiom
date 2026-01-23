'use client'

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, User, Send, Sparkles, Loader, Paperclip, FileText, X } from "lucide-react";
import { processCopilotQuery, getChatHistory, clearChatHistory } from "@/app/actions/ai";
import { ChatMarkdown } from "@/components/copilot/chat-markdown";
import { toast } from "sonner";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function CopilotPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isPending, startTransition] = useTransition();
    const [loadingHistory, setLoadingHistory] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function loadHistory() {
            setLoadingHistory(true);
            const history = await getChatHistory();
            if (history.length > 0) {
                setMessages(history);
            } else {
                setMessages([
                    { role: 'assistant', content: "Hello! I'm your Axiom Copilot. How can I help you with your procurement data today?" }
                ]);
            }
            setLoadingHistory(false);
        }
        loadHistory();
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isPending]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
                setSelectedFile(file);
            } else {
                toast.error("Unsupported file type. Please upload a PDF or an image.");
            }
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !selectedFile) || isPending) return;

        const userMessage = input.trim() || (selectedFile ? `Analyzing file: ${selectedFile.name}` : "");

        // In a real app, we'd upload the file and get content first
        // For now, we'll simulate the text extraction or just pass the filename
        const displayMessage = selectedFile
            ? `${userMessage}\n\n*Document attached: ${selectedFile.name}*`
            : userMessage;

        setInput("");
        setSelectedFile(null);
        setMessages(prev => [...prev, { role: 'user', content: displayMessage }]);

        startTransition(async () => {
            const response = await processCopilotQuery(displayMessage, messages);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-muted/30">
            <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-primary font-outfit">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                        Axiom Copilot
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">AI-powered procurement insights and multi-format document analysis.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={async () => {
                        await clearChatHistory();
                        setMessages([{ role: 'assistant', content: "Hello! How can I help you today?" }]);
                    }}>
                        Clear Session
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden px-8 pb-8 flex flex-col">
                <Card className="flex-1 flex flex-col overflow-hidden border-accent/50 shadow-2xl bg-background/80 backdrop-blur-sm">
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-transparent to-muted/5"
                    >
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            messages.map((m, i) => (
                                <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${m.role === 'assistant'
                                        ? 'bg-primary text-primary-foreground border-primary/20'
                                        : 'bg-background text-foreground border-accent'
                                        }`}>
                                        {m.role === 'assistant' ? <Bot size={22} className="text-white" /> : <User size={22} />}
                                    </div>
                                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${m.role === 'assistant'
                                        ? 'bg-muted/50 border border-muted-foreground/10'
                                        : 'bg-primary text-primary-foreground font-medium'
                                        }`}>
                                        {m.role === 'assistant' ? (
                                            <ChatMarkdown content={m.content} />
                                        ) : (
                                            <div className="whitespace-pre-wrap">{m.content}</div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {isPending && (
                            <div className="flex gap-4 animate-in fade-in duration-300">
                                <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                                    <Bot size={22} className="text-white" />
                                </div>
                                <div className="bg-muted/50 border border-muted-foreground/10 rounded-2xl p-4 flex items-center gap-3">
                                    <div className="flex gap-1">
                                        <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="h-2 w-2 bg-primary rounded-full animate-bounce"></span>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium italic">Copilot is analyzing your data...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t bg-background/50 backdrop-blur-md">
                        {selectedFile && (
                            <div className="mb-4 p-3 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between animate-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase font-black">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setSelectedFile(null)}>
                                    <X size={18} />
                                </Button>
                            </div>
                        )}
                        <form onSubmit={handleSend} className="flex gap-3 relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/pdf,image/*"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0 h-10 w-10 rounded-full border-accent hover:bg-muted"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isPending}
                            >
                                <Paperclip className="h-5 w-5 text-muted-foreground" />
                            </Button>
                            <Input
                                placeholder="Ask Axiom Copilot anything..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1 h-10 rounded-full pl-4 border-accent focus-visible:ring-primary shadow-inner"
                                disabled={isPending}
                            />
                            <Button type="submit" disabled={isPending || (!input.trim() && !selectedFile)} className="shrink-0 h-10 w-10 rounded-full p-0 shadow-lg transition-transform active:scale-95">
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}
