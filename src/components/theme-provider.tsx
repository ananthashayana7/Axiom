"use client"

import * as React from "react"

type Theme = "dark" | "light" | "system"

interface ThemeProviderProps {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
    attribute?: string
    enableSystem?: boolean
    disableTransitionOnChange?: boolean
}

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "axiom-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<Theme>(defaultTheme)

    React.useEffect(() => {
        const storedTheme = localStorage.getItem(storageKey) as Theme | null
        if (storedTheme) {
            setThemeState(storedTheme)
        }
    }, [storageKey])

    React.useEffect(() => {
        const root = window.document.documentElement
        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme])

    const value = React.useMemo(
        () => ({
            theme,
            setTheme: (theme: Theme) => {
                localStorage.setItem(storageKey, theme)
                setThemeState(theme)
            },
        }),
        [theme, storageKey]
    )

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => {
    const context = React.useContext(ThemeContext)
    if (context === undefined) {
        // Fallback for SSR or when used outside provider to prevent crashes
        return { theme: 'system' as Theme, setTheme: () => { } }
    }
    return context
}
