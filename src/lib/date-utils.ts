/**
 * X1: Centralized date utilities
 *
 * Single source of truth for date formatting functions used across the codebase.
 * Eliminates duplication of localToday() across 10+ files.
 */

import { nowDate } from "./clock"

/**
 * Returns today's date as YYYY-MM-DD string in local timezone.
 *
 * Used throughout the app for:
 * - Daily log keys
 * - Schedule date comparisons
 * - Backup filenames
 * - Streak calculations
 */
export function localToday(): string {
  const d = nowDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Converts a Date object to YYYY-MM-DD string.
 * Helper for components that need to format arbitrary dates.
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
