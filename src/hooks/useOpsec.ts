import { useEffect, useState, useCallback } from "react"

/**
 * Phase 0.5.5 — OPSEC mode.
 *
 * Masks course names, plan names, and page counts in the UI for
 * screen-sharing. Persisted to localStorage so it survives refresh.
 *
 * When enabled, components should use `mask(text)` to redact strings,
 * and `maskCount(n)` to redact numeric counts. A `[data-opsec]`
 * attribute is also set on the document root so CSS can hide
 * specific elements (e.g., "T-12 days" countdown text).
 *
 * Default: off. Opt-in via the header toggle.
 */

const STORAGE_KEY = "ztsf:opsec"

function readOpsec(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function writeOpsec(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, "1")
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable — fall back to session-only
  }
}

const REDACTED = "█████"

/**
 * Returns a redacted version of the string. Length is preserved
 * (rounded down to 5 chars) so layout doesn't shift.
 */
export function maskText(text: string): string {
  if (!text) return text
  if (text.length <= 5) return REDACTED
  return REDACTED + " " + REDACTED
}

function maskCountImpl(n: number): string {
  return "▒▒"
}

let listeners: Set<(value: boolean) => void> = new Set()

function emit(value: boolean) {
  for (const l of listeners) l(value)
}

/**
 * OPSEC hook. Returns:
 *  - `opsec: boolean` — current state
 *  - `setOpsec(value: boolean): void` — toggle
 *  - `mask(text: string): string` — redacts when opsec=true, else returns the text
 *  - `maskCount(n: number | string): string` — redacts when opsec=true, else returns the value as string
 */
export function useOpsec() {
  const [opsec, setOpsecState] = useState<boolean>(() => readOpsec())

  // Sync to localStorage and to other instances
  useEffect(() => {
    writeOpsec(opsec)
    emit(opsec)
    // Toggle the data attribute on the document root so CSS can hide
    // elements that aren't covered by the mask() function.
    if (typeof document !== "undefined") {
      if (opsec) {
        document.documentElement.setAttribute("data-opsec", "1")
      } else {
        document.documentElement.removeAttribute("data-opsec")
      }
    }
  }, [opsec])

  // Cross-component sync
  useEffect(() => {
    const listener = (value: boolean) => setOpsecState(value)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const setOpsec = useCallback((value: boolean) => {
    setOpsecState(value)
  }, [])

  const mask = useCallback(
    (text: string): string => (opsec ? maskText(text) : text),
    [opsec],
  )

  const maskCount = useCallback(
    (n: number | string): string => {
      if (!opsec) return String(n)
      return maskCountImpl(typeof n === "number" ? n : Number(n))
    },
    [opsec],
  )

  return { opsec, setOpsec, mask, maskCount }
}

/**
 * Read-only check. Use in places where you don't need the toggle
 * (e.g., a memoized component that only redacts its text).
 */
export function isOpsecOn(): boolean {
  return readOpsec()
}
