import { localToday } from "./date-utils"

/**
 * Phase 0.5.4: Sprint mode — temporary pace boost overlay.
 *
 * A sprint is a { startDate, days, paceBoost } overlay on top of a
 * plan's pagesPerDay. While active, the effective pagesPerDay is:
 *
 *   effectivePPD = round(pagesPerDay * (1 + paceBoost / 100))
 *
 * Active when today is between startDate and startDate + days
 * (inclusive). Auto-expires — no manual cleanup needed.
 *
 * v2.6.0 audit fixes:
 *   - DST bug: computing end via `+ days * 86400000` ms was wrong on
 *     DST boundaries (23h or 25h days). Now we use the Date object
 *     to add N calendar days, which respects DST.
 *   - Off-by-one: the previous `t < end` excluded the last day.
 *     Now uses `t <= lastDay` so days=N means N full days are active
 *     (start, start+1, ..., start+N-1) — verified by tests.
 *   - Days-remaining cliff: `Math.ceil` on small ms differences
 *     gave 0 then 1 with no in-between. Switched to `Math.round` and
 *     clamped to >= 0.
 */

export interface SprintOverlay {
  startDate: string
  days: number
  paceBoost: number
}

/**
 * Compute the start timestamp and the end (exclusive, lastDay + 1 day)
 * timestamp. Returns NaN for either if inputs are invalid.
 */
function getSprintRange(sprint: SprintOverlay): { start: number; end: number } {
  const startDate = new Date(sprint.startDate + "T00:00:00")
  if (isNaN(startDate.getTime())) return { start: NaN, end: NaN }
  const start = startDate.getTime()
  // Add N calendar days via the Date object (DST-safe), then convert back.
  // end is the start of (startDate + N days), i.e. the first moment
  // AFTER the last active day. We use local-time construction so the
  // added days respect DST.
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + sprint.days)
  return { start, end: endDate.getTime() }
}

export function isSprintActive(sprint: SprintOverlay | undefined, today: string = localToday()): boolean {
  if (!sprint) return false
  if (sprint.days <= 0) return false
  const { start, end } = getSprintRange(sprint)
  const t = new Date(today + "T00:00:00").getTime()
  if (isNaN(start) || isNaN(end) || isNaN(t)) return false
  return t >= start && t < end
}

export function sprintDaysRemaining(sprint: SprintOverlay | undefined, today: string = localToday()): number {
  if (!sprint) return 0
  if (sprint.days <= 0) return 0
  const { end } = getSprintRange(sprint)
  const t = new Date(today + "T00:00:00").getTime()
  if (isNaN(end) || isNaN(t)) return 0
  // Math.round (not Math.ceil) for stable days-remaining count.
  // Clamped to >= 0.
  return Math.max(0, Math.round((end - t) / 86400000))
}

/**
 * Apply sprint overlay to a pagesPerDay value. Returns the original
 * value if sprint is inactive or undefined.
 */
export function applySprintPace(
  pagesPerDay: number,
  sprint: SprintOverlay | undefined,
  today: string = localToday(),
): number {
  if (!sprint) return pagesPerDay
  if (sprint.paceBoost < 0) return pagesPerDay  // safety: no negative boosts
  if (!isSprintActive(sprint, today)) return pagesPerDay
  return Math.round(pagesPerDay * (1 + sprint.paceBoost / 100))
}
