'use client'

import { useEffect, useRef, useState, useTransition } from "react";

import { clearChatHistory, getChatHistory, processCopilotQuery } from "@/app/actions/ai";
import { ChatMarkdown } from "@/components/copilot/chat-markdown";
import { AxiomLogo } from "@/components/shared/axiom-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader, Paperclip, Send, User, FileText, X } from "lucide-react";
import { toast } from "sonner";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const SUPPORTED_FILE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'csv', 'tsv', 'txt', 'json', 'xlsx', 'xls']);

function isSupportedCopilotFile(file: File) {
    const extension = file.name.toLowerCase().split('.').pop() ?? '';
    return file.type === 'application/pdf'
        || file.type.startsWith('image/')
        || file.type === 'text/csv'
        || file.type === 'text/tab-separated-values'
        || file.type === 'text/plain'
        || file.type === 'application/json'
        || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        || file.type === 'application/vnd.ms-excel'
        || SUPPORTED_FILE_EXTENSIONS.has(extension);
}

function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== "string") {
                reject(new Error("File reader returned an unexpected payload."));
                return;
            }

            const [, base64 = ""] = result.split(",", 2);
            resolve(base64);
        };

        reader.onerror = () => reject(new Error("Failed to read the selected file."));
        reader.readAsDataURL(file);
    });
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
                    { role: 'assistant', content: "Hello! I can help with Axiom workflows, AI agents, procurement data, and uploaded PDF, CSV, or Excel files." }
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("File too large. Maximum size is 10 MB.");
            return;
        }

        if (!isSupportedCopilotFile(file)) {
            toast.error("Unsupported file type. Upload PDF, image, CSV, TSV, TXT, JSON, XLSX, or XLS files.");
            return;
        }

        setSelectedFile(file);
    };

    const handleSend = async (event: React.FormEvent) => {
        event.preventDefault();
        if ((!input.trim() && !selectedFile) || isPending) return;

        const userMessage = input.trim() || (selectedFile ? `Analyze this document: ${selectedFile.name}` : "");

        let fileBase64: string | undefined;
        let fileName: string | undefined;
        let fileMimeType: string | undefined;

        if (selectedFile) {
            try {
                fileBase64 = await fileToBase64(selectedFile);
                fileName = selectedFile.name;
                fileMimeType = selectedFile.type;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to read file. Please try again.");
                return;
            }
        }

        const displayMessage = selectedFile
            ? `${userMessage}\n\n*Document attached: ${selectedFile.name}*`
            : userMessage;

        setInput("");
        setSelectedFile(null);
        const nextUserMessage: Message = { role: 'user', content: displayMessage };
        const updatedHistory: Message[] = [...messages, nextUserMessage];
        setMessages(updatedHistory);

        startTransition(async () => {
            try {
                const response = await processCopilotQuery(
                    userMessage,
                    updatedHistory,
                    fileBase64 ? { data: fileBase64, name: fileName!, mimeType: fileMimeType } : undefined
                );
                setMessages((previous) => [...previous, { role: 'assistant', content: response }]);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Copilot failed to respond. Please try again.");
                setMessages((previous) => [
                    ...previous,
                    { role: 'assistant', content: "Axiom Copilot switched into guided demo mode for this request. Please try again and I will keep working from the current workspace snapshot." }
                ]);
            }
        });
    };

    return (
        <div className="flex min-h-full flex-col bg-muted/30">
            <div className="flex flex-col gap-4 px-4 pb-3 pt-4 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                            <AxiomLogo className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
                            Axiom Copilot
                        </h1>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            Reason over Axiom workflows, agents, and uploaded PDF, image, CSV, or Excel files.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            await clearChatHistory();
                            setMessages([{ role: 'assistant', content: "Hello! Ask about Axiom workflows, live procurement context, or upload a file to analyze." }]);
                        }}
                    >
                        Clear Session
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col px-4 pb-4 sm:px-6 lg:px-8 lg:pb-8">
                <Card className="flex flex-1 min-h-0 flex-col overflow-hidden border-accent/50 bg-background/85 shadow-2xl backdrop-blur-sm">
                    <div
                        ref={scrollRef}
                        className="show-scrollbar flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-muted/5 px-4 py-5 sm:px-6"
                    >
                        <div className="space-y-6">
                            {loadingHistory ? (
                                <div className="flex h-full min-h-[16rem] items-center justify-center">
                                    <Loader className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                    >
                                        <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-10 sm:w-10 ${message.role === 'assistant'
                                                ? 'border-emerald-500 bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none'
                                                : 'border-accent bg-background text-foreground'
                                                }`}
                                        >
                                            {message.role === 'assistant' ? <AxiomLogo className="h-5 w-5 text-white sm:h-6 sm:w-6" /> : <User size={20} />}
                                        </div>
                                        <div
                                            className={`max-w-[92%] rounded-2xl p-4 text-sm shadow-sm sm:max-w-[85%] ${message.role === 'assistant'
                                                ? 'border border-muted-foreground/10 bg-muted/50'
                                                : 'bg-primary font-medium text-primary-foreground'
                                                }`}
                                        >
                                            {message.role === 'assistant' ? (
                                                <ChatMarkdown content={message.content} />
                                            ) : (
                                                <div className="whitespace-pre-wrap">{message.content}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            {isPending && (
                                <div className="flex gap-3 sm:gap-4 animate-in fade-in duration-300">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-200 sm:h-10 sm:w-10">
                                        <AxiomLogo className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                                    </div>
                                    <div className="flex items-center gap-3 rounded-2xl border border-muted-foreground/10 bg-muted/50 p-4">
                                        <div className="flex gap-1">
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                                        </div>
                                        <span className="text-xs font-medium italic text-muted-foreground">Copilot is analyzing your data...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t bg-background/60 p-4 backdrop-blur-md sm:p-6">
                        {selectedFile && (
                            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3 animate-in zoom-in-95 duration-200">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                                        <FileText size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-bold">{selectedFile.name}</div>
                                        <div className="text-[10px] font-black uppercase text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setSelectedFile(null)}
                                >
                                    <X size={18} />
                                </Button>
                            </div>
                        )}

                        <form onSubmit={handleSend} className="flex flex-col gap-3 sm:flex-row">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/pdf,image/*,.csv,.tsv,.txt,.json,.xlsx,.xls"
                            />
                            <div className="flex items-center gap-3 sm:flex-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 rounded-full border-accent hover:bg-muted"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isPending}
                                >
                                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                                </Button>
                                <Input
                                    placeholder="Ask about Axiom workflows, live data, or upload a file to analyze..."
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    className="h-10 flex-1 rounded-full border-accent pl-4 shadow-inner focus-visible:ring-primary"
                                    disabled={isPending}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isPending || (!input.trim() && !selectedFile)}
                                className="h-10 w-full shrink-0 rounded-full px-4 shadow-lg transition-transform active:scale-95 sm:w-10 sm:p-0"
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}
