/**
 * Single clock source — Phase 3.4
 *
 * Centralizes all "what time is it?" calls into a single module that can
 * be injected and mocked. This makes time-dependent logic testable
 * (vi.useFakeTimers / vi.setSystemTime) and debuggable.
 *
 * Inviolable rule (Phase 3.4 + v2.5.0): all production code that needs
 * the current time MUST go through this module — never call new Date() or
 * Date.now() directly. (Naked = no arguments; new Date(arg) for parsing
 * a date string is still fine.)
 *
 * Scope: src/lib/ AND src/components/ AND App.tsx. v2.5.0 audit
 * confirmed all production code is migrated (enforced by
 * src/lib/__tests__/clock.test.ts for lib/ and
 * src/lib/__tests__/app-temp-log-wiring.test.ts for App.tsx).
 *
 * Usage:
 *   import { now, today } from "@/lib/clock"
 *   const currentTime = now()
 *   const dateString = today()
 *
 * Testing:
 *   vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
 *   // clock.now() will return the mocked time
 */

/**
 * Returns the current timestamp as an ISO 8601 string.
 * Use for logging, timestamps in storage, etc.
 */
export function now(): string {
  return new Date().toISOString()
}

/**
 * Returns the current local date as YYYY-MM-DD.
 * Use for "today" comparisons, date math, etc.
 * Inherits timezone from the user's browser.
 */
export function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Returns the current epoch milliseconds.
 * Use for timing, intervals, etc.
 */
export function nowMs(): number {
  return Date.now()
}

/**
 * Returns a Date object for the current time.
 * Use when you need Date methods (getDay, getTime, etc.).
 * Prefer today() for date-only logic.
 */
export function nowDate(): Date {
  return new Date()
}
