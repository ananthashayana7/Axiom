"use client"

import * as React from "react"
import { MoonStar, SunMedium, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { motion, AnimatePresence } from "framer-motion"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return <div className="h-9 w-[110px] bg-muted animate-pulse rounded-full" />

    const options = [
        { value: "light", icon: SunMedium, label: "Light" },
        { value: "system", icon: Monitor, label: "System" },
        { value: "dark", icon: MoonStar, label: "Dark" },
    ]

    return (
        <div className="flex items-center p-1 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-full w-fit shadow-inner">
            <div className="flex gap-1 relative">
                {options.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value as any)}
                        className={`
                            relative flex items-center justify-center p-1.5 rounded-full transition-colors z-10
                            ${theme === opt.value
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"}
                        `}
                        title={opt.label}
                    >
                        <opt.icon className="h-[18px] w-[18px]" strokeWidth={2.5} />

                        {theme === opt.value && (
                            <motion.div
                                layoutId="active-theme"
                                className="absolute inset-0 bg-white dark:bg-stone-800 rounded-full shadow-sm -z-10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}
