'use client'

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
    Search,
    FileText,
    ShoppingCart,
    Users,
    Package,
    Plus,
    History,
    Zap,
    Sparkles
} from "lucide-react"

import { cn } from "@/lib/utils"
import { globalSearch, SearchResult } from "@/app/actions/search"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export function CommandPalette() {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<SearchResult[]>([])
    const [loading, setLoading] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)
    const router = useRouter()

    React.useEffect(() => {
        setMounted(true)
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    React.useEffect(() => {
        if (!query || query.length < 2) {
            setResults([])
            return
        }

        const debounce = setTimeout(async () => {
            setLoading(true)
            const searchResults = await globalSearch(query)
            setResults(searchResults)
            setLoading(false)
        }, 300)

        return () => clearTimeout(debounce)
    }, [query])

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false)
        command()
    }, [])

    if (!mounted) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="overflow-hidden p-0 shadow-2xl bg-background border border-border max-w-[600px]">
                <DialogTitle className="sr-only">Command Palette</DialogTitle>
                <Command className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
                    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Command.Input
                            placeholder="Type a command or search..."
                            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
                        <Command.Empty className="py-6 text-center text-sm">
                            {loading ? "Searching Axiom databases..." : "No results found."}
                        </Command.Empty>

                        {results.length > 0 && (
                            <Command.Group heading="Search Results">
                                {results.map((res) => (
                                    <Command.Item
                                        key={`${res.type}-${res.id}`}
                                        value={`${res.type} ${res.title}`}
                                        onSelect={() => runCommand(() => router.push(res.href))}
                                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-3 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            {res.type === 'supplier' && <Users className="h-4 w-4" />}
                                            {res.type === 'rfq' && <FileText className="h-4 w-4" />}
                                            {res.type === 'order' && <ShoppingCart className="h-4 w-4" />}
                                            {res.type === 'part' && <Package className="h-4 w-4" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{res.title}</span>
                                            <span className="text-xs text-muted-foreground">{res.subtitle}</span>
                                        </div>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        )}

                        <Command.Group heading="Quick Actions">
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/sourcing/rfqs"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-muted/50"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                <span>Create New Sourcing Request</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">A</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/copilot"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-muted/50"
                            >
                                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                                <span>Consult Axiom Copilot</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">C</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/admin/audit"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground hover:bg-muted/50"
                            >
                                <History className="mr-2 h-4 w-4" />
                                <span>View Recent Audits</span>
                                <span className="ml-auto text-xs tracking-widest text-muted-foreground">H</span>
                            </Command.Item>
                        </Command.Group>

                        <Command.Separator />

                        <Command.Group heading="Navigation">
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/suppliers"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-muted/50"
                            >
                                <Users className="mr-2 h-4 w-4" />
                                <span>Suppliers Directory</span>
                            </Command.Item>
                            <Command.Item
                                onSelect={() => runCommand(() => router.push("/sourcing/orders"))}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-muted/50"
                            >
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                <span>Procurement Orders</span>
                            </Command.Item>
                        </Command.Group>
                    </Command.List>
                    <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 font-mono font-medium text-muted-foreground opacity-100">
                                    <span className="text-xs">↑↓</span>
                                </kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-border bg-muted/50 px-1.5 font-mono font-medium text-muted-foreground opacity-100">
                                    <span className="text-xs">↵</span>
                                </kbd>
                                Select
                            </span>
                        </div>
                        <div className="flex items-center gap-1 font-bold text-primary">
                            <Zap className="h-3 w-3" />
                            Axiom Command Center
                        </div>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    )
}
