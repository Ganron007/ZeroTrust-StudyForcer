import type { Chapter } from "@/types/course"
import type { StudyPlan, Anchor } from "@/lib/plan-storage"
import { getTotalPages, countStudyDays, nthStudyDay } from "./cissp-data"

export interface ComputedPlanParams {
  /** The actual pagesPerDay to use for schedule generation. */
  pagesPerDay: number
  /** The actual end date limit (null = no limit, run until chapters finish). */
  endDate: string | null
  /** Warnings about feasibility. */
  warnings: string[]
  /** Whether the plan is feasible with current parameters. */
  isFeasible: boolean
  /** The computed derived value (either pace or end-date depending on anchor). */
  derivedValue: number | string
  /** Which anchor is driving the computation. */
  anchor: Anchor
  /** Actual pages consumed before today (for display). */
  consumed: number
  /** Actual pages remaining (for display). */
  remaining: number
}

/**
 * Calculate how many pages have been effectively consumed before today.
 *
 * Rules (Source of Truth):
 *   - Day in dailyLog: use actual log.pagesRead
 *   - Day not in dailyLog: 0 (user hasn't logged anything yet)
 *   - Skipped day: 0 progress
 *
 * Progress is entirely driven by what the user logs.
 * No assumed consumption.
 */
function pagesConsumedBeforeToday(plan: StudyPlan, today: string, totalPages?: number): number {
  let consumed = 0
  for (const [dateStr, log] of Object.entries(plan.dailyLog)) {
    if (dateStr < today) {
      const pages = typeof log.pagesRead === "number" && !isNaN(log.pagesRead) ? log.pagesRead : 0
      consumed += Math.max(0, pages)
    }
  }
  // Safety clamp — a corrupted log with 9999 pages should not claim more than the course
  return totalPages !== undefined ? Math.min(consumed, totalPages) : consumed
}

/**
 * Central Recalculation Engine — syncStudyPlan
 *
 * Implements the Study Triangle:
 *   Total Remaining = Days Remaining × Daily Velocity
 *
 * Anchor Behaviours:
 *   - VELOCITY (pagesPerDay): Pace is locked. End date shifts when volume changes.
 *   - DEADLINE (endDate): Deadline is locked. Pace adjusts when volume changes.
 *
 * Log Priority (Source of Truth):
 *   - Logged days = actual pages read
 *   - Marked Done (no log) = full planned pace
 *   - Unlogged = 0 progress
 *   - Skipped = 0 progress
 *
 * Partial Log Smoothing:
 *   - If you log 10 pages instead of the planned 20, the remaining 10 are
 *     naturally absorbed into `remaining` and spread across future days.
 */
export function syncStudyPlan(
  plan: StudyPlan,
  chapters: Chapter[],
  today: string,
): ComputedPlanParams {
  const warnings: string[] = []
  const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chapters)
  const consumed = pagesConsumedBeforeToday(plan, today, totalPages)
  const remaining = Math.max(0, totalPages - consumed)

  const studyDaysArr = plan.studyDays.length > 0 ? plan.studyDays : [1, 2, 3, 4, 5]

  // Time-span anchor: schedule starts at plan.startDate (can be past or future).
  // Count from whichever is later — you can't study before today, and you can't
  // study before the plan starts.
  const effectiveFrom = plan.startDate > today ? plan.startDate : today

  // Handle legacy fixedDuration: compute targetEndDate from targetDayCount
  let effectiveEndDate = plan.targetEndDate
  if (plan.anchor === "endDate" && !effectiveEndDate && plan.targetDayCount) {
    // Fixed Duration: N study days from the plan's START date, not from today.
    effectiveEndDate = nthStudyDay(plan.startDate, plan.targetDayCount, studyDaysArr, plan.skippedDays) ?? undefined
  }

  // ── Anchor: DEADLINE ──────────────────────────────────────────────────────
  if (plan.anchor === "endDate" && effectiveEndDate) {
    const available = countStudyDays(effectiveFrom, effectiveEndDate, studyDaysArr, plan.skippedDays)

    if (available <= 0) {
      warnings.push(`Deadline (${effectiveEndDate}) has already passed. Extend the deadline to continue.`)
      return {
        pagesPerDay: Math.max(1, plan.pagesPerDay),
        endDate: effectiveEndDate,
        isFeasible: false,
        warnings,
        derivedValue: Math.max(1, plan.pagesPerDay),
        anchor: "endDate",
        consumed,
        remaining,
      }
    }

    const derivedPace = Math.max(1, Math.ceil(remaining / available))

    return {
      pagesPerDay: derivedPace,
      endDate: effectiveEndDate,
      isFeasible: true,
      warnings,
      derivedValue: derivedPace,
      anchor: "endDate",
      consumed,
      remaining,
    }
  }

  // ── Anchor: VELOCITY ──────────────────────────────────────────────────────
  // v2.4.4: Defensive guards — corrupt plan pagesPerDay could yield NaN/Infinity.
  const safePagesPerDay = Number.isFinite(plan.pagesPerDay) && plan.pagesPerDay > 0
    ? plan.pagesPerDay
    : 1
  const pace = Math.max(1, safePagesPerDay)
  const safeRemaining = Number.isFinite(remaining) && remaining > 0 ? remaining : 0
  const neededDays = safeRemaining > 0 ? Math.ceil(safeRemaining / pace) : 0
  const derivedEndDate = neededDays > 0
    ? nthStudyDay(effectiveFrom, neededDays, studyDaysArr, plan.skippedDays)
    : today

  return {
    pagesPerDay: pace,
    endDate: derivedEndDate,
    isFeasible: true,
    warnings,
    derivedValue: neededDays,
    anchor: "pagesPerDay",
    consumed,
    remaining,
  }
}

// syncStudyPlan is the sole export — no backward-compatible aliases.
