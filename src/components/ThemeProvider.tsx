"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "light-grey" | "dark-grey" | "dark"

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  /** Cycle through themes. Kept for backward compatibility. */
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}

const ALL_THEMES: Theme[] = ["light", "light-grey", "dark-grey", "dark"]
const STORAGE_KEY = "cissp-theme"

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (ALL_THEMES as string[]).includes(value)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag to avoid hydration mismatch
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isTheme(saved)) {
        setThemeState(saved)
      } else if (saved === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setThemeState("dark")
      }
    } catch {
      // localStorage unavailable; stick with default
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement

    // dark-grey rides alongside .dark so all `dark:` Tailwind utilities still resolve.
    root.classList.toggle("dark", theme === "dark" || theme === "dark-grey")
    root.classList.toggle("light-grey", theme === "light-grey")
    root.classList.toggle("dark-grey", theme === "dark-grey")

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore quota / disabled storage
    }
  }, [theme, mounted])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggleTheme = () =>
    setThemeState((current) => {
      const idx = ALL_THEMES.indexOf(current)
      return ALL_THEMES[(idx + 1) % ALL_THEMES.length]
    })

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
