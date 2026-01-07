'use client'

import * as React from "react"
import { Search } from "lucide-react"

export function SearchTrigger() {
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border border-border rounded-md hover:bg-muted transition-colors w-64 text-left">
            <Search className="h-3 w-3" />
            Search Suppliers, RFQs, Orders...
            {mounted && (
                <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">Ctrl</span>K
                </kbd>
            )}
        </button>
    )
}
