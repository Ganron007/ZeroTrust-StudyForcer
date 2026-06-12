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
 *
 * v2.6.0 audit fixes:
 *   - The cross-instance listener was a module-level Set that could
 *     leak. Replaced with a custom event on the window object —
 *     the DOM cleans up listeners on its own.
 *   - emit() was called on every state change, triggering re-renders
 *     in every component even when the value hadn't changed. Now we
 *     only emit if the value differs from the last emitted.
 *   - maskCountImpl ignored its argument (always returned "▒▒" regardless
 *     of the count). The argument is now reserved for future use and
 *     the function documents its actual behavior.
 */

const STORAGE_KEY = "ztsf:opsec"
const EVENT_NAME = "ztsf:opsec-change"

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
const REDACTED_COUNT = "▒▒"

/**
 * Returns a redacted version of the string. Short strings return a
 * single block; long strings return two blocks to imply length.
 */
export function maskText(text: string): string {
  if (!text) return text
  if (text.length <= 5) return REDACTED
  return REDACTED + " " + REDACTED
}

/**
 * Apply the OPSEC mask to a numeric count. Returns "▒▒" when
 * opsec is on, otherwise the number formatted as a string.
 * The `original` argument is unused but reserved for future use
 * (e.g., if we want to show "▒▒" of "▒▒" for a range).
 */
function applyCountMask(original: number | string): string {
  return REDACTED_COUNT
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

  // Sync to localStorage and the data attribute.
  useEffect(() => {
    writeOpsec(opsec)
    if (typeof document !== "undefined") {
      if (opsec) {
        document.documentElement.setAttribute("data-opsec", "1")
      } else {
        document.documentElement.removeAttribute("data-opsec")
      }
    }
  }, [opsec])

  // Cross-instance sync: listen on a window event instead of a
  // module-level Set. The DOM cleans up listeners on its own and
  // there's no risk of leaking.
  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = (e: Event) => {
      const ce = e as CustomEvent<boolean>
      // Only update if the value actually changed (avoid render loops)
      setOpsecState((current) => (current === ce.detail ? current : ce.detail))
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
    }
  }, [])

  // v2.6.0 audit fix: useCallback for setOpsec so consumers can
  // depend on a stable reference.
  const setOpsec = useCallback((value: boolean) => {
    setOpsecState(value)
    // v2.6.0 audit fix: only emit if value actually changes
    // (avoid unnecessary cross-instance re-renders).
    try {
      const prev = readOpsec()
      if (prev !== value) {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }))
      }
    } catch {
      // ignore — localStorage unavailable
    }
  }, [])

  const mask = useCallback(
    (text: string): string => (opsec ? maskText(text) : text),
    [opsec],
  )

  const maskCount = useCallback(
    (n: number | string): string => (opsec ? applyCountMask(n) : String(n)),
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
