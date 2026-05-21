"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
import type { PersonalityMode } from "@/lib/personality"
import {
  getSavedMode,
  saveMode,
  getLabel,
  getToast,
  getEmpty,
  getGreeting,
  getLoading,
  getTips,
} from "@/lib/personality"

interface PersonalityContextValue {
  mode: PersonalityMode
  setMode: (mode: PersonalityMode) => void
  /** Get a label string. Falls back to key if not found in current mode. */
  label: (key: string) => string
  /** Get a toast template string for the given key. */
  toast: (key: string) => string
  /** Get an empty-state message. */
  empty: (key: string) => string
  /** Get a time-based greeting. */
  greeting: (timeKey: "morning" | "afternoon" | "evening") => string
  /** Get a loading message. */
  loading: (key: string) => string
  /** Get the tips array. */
  tips: () => string[]
}

const PersonalityContext = createContext<PersonalityContextValue | null>(null)

export function PersonalityProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PersonalityMode>(getSavedMode)

  const setMode = useCallback((newMode: PersonalityMode) => {
    setModeState(newMode)
    saveMode(newMode)
  }, [])

  const label = useCallback((key: string): string => getLabel(mode, key), [mode])
  const toast = useCallback((key: string): string => getToast(mode, key), [mode])
  const empty = useCallback((key: string): string => getEmpty(mode, key), [mode])
  const greeting = useCallback(
    (timeKey: "morning" | "afternoon" | "evening"): string => getGreeting(mode, timeKey),
    [mode],
  )
  const loading = useCallback((key: string): string => getLoading(mode, key), [mode])
  const tips = useCallback((): string[] => getTips(mode), [mode])

  const value = useMemo<PersonalityContextValue>(
    () => ({ mode, setMode, label, toast, empty, greeting, loading, tips }),
    [mode, setMode, label, toast, empty, greeting, loading, tips],
  )

  return (
    <PersonalityContext.Provider value={value}>
      {children}
    </PersonalityContext.Provider>
  )
}

export function usePersonality(): PersonalityContextValue {
  const ctx = useContext(PersonalityContext)
  if (!ctx) {
    throw new Error("usePersonality must be used within a PersonalityProvider")
  }
  return ctx
}
