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
 */

export interface SprintOverlay {
  startDate: string
  days: number
  paceBoost: number
}

export function isSprintActive(sprint: SprintOverlay | undefined, today: string = localToday()): boolean {
  if (!sprint) return false
  const start = new Date(sprint.startDate + "T00:00:00").getTime()
  const end = start + sprint.days * 86400000  // +N days
  const t = new Date(today + "T00:00:00").getTime()
  if (isNaN(start) || isNaN(end) || isNaN(t)) return false
  return t >= start && t < end
}

export function sprintDaysRemaining(sprint: SprintOverlay | undefined, today: string = localToday()): number {
  if (!sprint) return 0
  const end = new Date(sprint.startDate + "T00:00:00").getTime() + sprint.days * 86400000
  const t = new Date(today + "T00:00:00").getTime()
  if (isNaN(end) || isNaN(t)) return 0
  return Math.max(0, Math.ceil((end - t) / 86400000))
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
  if (!isSprintActive(sprint, today)) return pagesPerDay
  return Math.round(pagesPerDay * (1 + (sprint!.paceBoost / 100)))
}
