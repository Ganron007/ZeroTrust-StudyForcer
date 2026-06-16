// Pure helper functions extracted from src/components/LabDashboard.tsx
// so they can be unit-tested in isolation. These functions are
// side-effect-free and depend only on `date-utils` and `lab-session-storage`.

import { getDaysSince } from "./lab-session-storage"

/**
 * Short weekday label (e.g. "Mo", "Tu") for a given ISO date string.
 * Returns the first 2 characters of the locale weekday name.
 */
export function dayLabel(date: string): string {
  const d = new Date(date + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)
}

/**
 * Day-of-month number for a given ISO date string.
 */
export function dayNumber(date: string): number {
  const d = new Date(date + "T00:00:00")
  return d.getDate()
}

/**
 * Format a "days since" integer as a human-friendly string.
 * null = never, 0 = Today, 1 = Yesterday, N = "N days ago".
 */
export function formatRelative(days: number | null): string {
  if (days === null) return "Never used"
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

/**
 * Format an ISO date string relative to today.
 * - Same day → "Today"
 * - 1 day ago → "Yesterday"
 * - 2-6 days ago → "N days ago"
 * - 7+ days ago → returns the date string unchanged
 *
 * Returns the input string if `getDaysSince` can't compute a value.
 */
export function formatDateRelative(dateStr: string): string {
  const days = getDaysSince(dateStr)
  if (days === null) return dateStr
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return dateStr
}
