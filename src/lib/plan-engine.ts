import type { Chapter } from "@/types/course"
import type { StudyPlan, Anchor } from "@/lib/plan-storage"
import { getTotalPages, countStudyDays, nthStudyDay, generateSchedule, type GeneratedSchedule } from "./cissp-data"
import { today as todayNow } from "./clock"
import { applySprintPace } from "./sprint"
import { applyAdversaryPace, loadAdversarySettings } from "./adversary"

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
 * Apply transient pace overlays (sprint + adversary) to a base pace.
 * These overlays are read-time only and never persisted to plan storage.
 * v2.8.1: applies to both VELOCITY and DEADLINE anchors.
 */
function applyPaceOverlays(basePace: number, plan: StudyPlan, today: string): number {
  const safeBase = Math.max(1, basePace)
  const sprinted = applySprintPace(safeBase, plan.sprint, today)
  const advSettings = loadAdversarySettings()
  return applyAdversaryPace(sprinted, advSettings, today)
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
    const pace = applyPaceOverlays(derivedPace, plan, today)

    return {
      pagesPerDay: pace,
      endDate: effectiveEndDate,
      isFeasible: true,
      warnings,
      derivedValue: pace,
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
  // v2.8.1: Sprint + Adversary overlays apply to the effective pace
  // regardless of anchor. These are read-time only and never persisted.
  const pace = applyPaceOverlays(safePagesPerDay, plan, today)
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

// ── Phase 3.5: Single schedule derivation ───────────────────────────────────

export interface PlanSchedule {
  /** The computed schedule (day-by-day chapter allocations). */
  schedule: GeneratedSchedule
  /** Computed plan params (pace, end date, feasibility). */
  params: ComputedPlanParams
  /** Today's date used for the computation. */
  today: string
}

/**
 * Single source of truth for plan schedule derivation.
 *
 * Use this from the Zustand store selector to avoid recomputing the
 * schedule in every component. Returns the schedule + params + today
 * as a single object for easy memoization.
 *
 * Pure function: same plan + chapters + today → same output.
 */
export function computePlanSchedule(
  plan: StudyPlan,
  chapters: Chapter[],
  today: string = todayNow(),
): PlanSchedule {
  const params = syncStudyPlan(plan, chapters, today)
  const schedule = generateSchedule(
    plan,
    chapters,
    today,
    params.pagesPerDay,
    params.endDate,
  )
  return { schedule, params, today }
}

// syncStudyPlan is the sole export — no backward-compatible aliases.
