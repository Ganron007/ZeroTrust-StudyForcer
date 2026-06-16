// Pure helper functions extracted from src/components/PlannerPage.tsx
// so they can be unit-tested in isolation.

import type { CourseConfig, Chapter } from "@/types/course"
import { getTotalPages, getOrderedChapters } from "@/lib/cissp-data"
import type { StudyPlan } from "@/lib/plan-storage"

/**
 * Flatten a CourseConfig's nested units/chapters into a flat list of
 * Chapter objects annotated with their unit's id, name, and color.
 * Mirrors what `<PlannerPage>` needs to render plan progress cards.
 */
export function flattenChapters(cfg: CourseConfig): Chapter[] {
  return cfg.units.flatMap((u) =>
    u.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      pages: ch.pages,
      unitId: u.id,
      unitName: u.title,
      color: u.color,
    })),
  )
}

/**
 * Dashboard-level stats derived from the plan set and course list:
 * - totalPlans: total number of plans (any course)
 * - activeCount: number of active plan ids
 * - courseCount: number of courses
 * - avgPct: average completion percentage across all plans
 *
 * Plans with no course config or 0 total pages are counted as 0%
 * to avoid NaN skewing the average.
 */
export function computeDashboardStats(
  allPlans: StudyPlan[],
  activePlanIds: string[],
  courses: CourseConfig[],
): { totalPlans: number; activeCount: number; courseCount: number; avgPct: number } {
  const totalPlans = allPlans.length
  const activeCount = activePlanIds.length
  const courseCount = courses.length
  const avgPct =
    totalPlans === 0
      ? 0
      : Math.round(
          allPlans.reduce((sum, plan) => {
            const cfg = courses.find((c) => c.id === plan.courseId)
            const chapters = cfg ? getOrderedChapters(cfg, plan.unitOrder) : []
            const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chapters)
            const donePages = Object.values(plan.dailyLog).reduce((s, l) => s + Math.max(0, l.pagesRead), 0)
            return sum + (totalPages > 0 ? (donePages / totalPages) * 100 : 0)
          }, 0) / totalPlans,
        )
  return { totalPlans, activeCount, courseCount, avgPct }
}

/**
 * Group plans by their course id. Preserves the iteration order of
 * `courses` so consumers can render the same course order they
 * received as a prop.
 */
export function groupPlansByCourse(
  courses: CourseConfig[],
  allPlans: StudyPlan[],
): Record<string, StudyPlan[]> {
  const map: Record<string, StudyPlan[]> = {}
  for (const course of courses) {
    map[course.id] = allPlans.filter((p) => p.courseId === course.id)
  }
  return map
}

/**
 * Compute the clamped "pages per day" for a plan edit, ensuring it's
 * at least 1. Used by `handleSaveEdit` and `handleCreatePlanSave`.
 */
export function clampPagesPerDay(value: number): number {
  return Math.max(1, value)
}
