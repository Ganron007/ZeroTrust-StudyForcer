import { useMemo } from "react"
import {
  getTotalPages,
  mergeSchedules,
  type StudyDay,
  generateSchedule,
  getOrderedChapters,
  tagChaptersWithCourseId,
  dedupeScheduleByDate,
} from "@/lib/cissp-data"
import { syncStudyPlan } from "@/lib/plan-engine"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig, Chapter } from "@/types/course"
import { computeTotalPages } from "@/types/course"
import { localToday } from "@/lib/date-utils"
import { nowDate } from "@/lib/clock"

export type CourseStat = {
  courseId: string
  courseName: string
  color: string
  planName: string
  scheduleLength: number
  totalBookPages: number
  studyPages: number
  totalPages: number
  totalPagesRead: number
  pctDone: number
  pagesPerDay: number
  studyDaysCount: number
  endDate: Date | null
  endDateLabel: string
  weeksAway: string
}

export type UseScheduleOptions = {
  allPlans: StudyPlan[]
  activePlanIds: string[]
  activeCourseId: string | null
  activeCourse: CourseConfig | null
  primaryActivePlanId: string | null
  courses: CourseConfig[]
  selectedCourseIds: Set<string>
  courseLabel: (id: string) => string
}

export type UseScheduleResult = {
  baseSchedule: StudyDay[]
  otherCoursesInfo: Array<{
    courseId: string
    courseName: string
    schedule: StudyDay[]
    chapters: ReturnType<typeof getOrderedChapters>
  }>
  mergedSchedule: StudyDay[]
  schedule: StudyDay[]
  selectedCoursesStats: Record<string, CourseStat>
  showMerged: boolean
}

/**
 * Derives the active schedule and per-course statistics from plan/course data.
 *
 * This is pure derived state — no side effects, no mutations. It belongs in a
 * hook so the view component only receives ready-to-render data.
 */
export function useSchedule({
  allPlans,
  activePlanIds,
  activeCourseId,
  activeCourse,
  primaryActivePlanId,
  courses,
  selectedCourseIds,
  courseLabel,
}: UseScheduleOptions): UseScheduleResult {
  const plans = useMemo(
    () => allPlans.filter((p) => p.courseId === activeCourseId && activePlanIds.includes(p.id)),
    [allPlans, activeCourseId, activePlanIds],
  )

  const otherSelectedIds = useMemo(
    () => courses.map((c) => c.id).filter((id) => id !== activeCourseId && selectedCourseIds.has(id)),
    [courses, activeCourseId, selectedCourseIds],
  )

  const showMerged = selectedCourseIds.size > 1

  // Merge all active plans for the current course into one schedule.
  // Uses anchor-aware generator that derives pages/day at generation time.
  // Tags every chapter with courseId/courseLabel so single-course view
  // matches multi-course view (mergeSchedules does this for merged view).
  const baseSchedule = useMemo(() => {
    if (!activeCourse) return [] as StudyDay[]
    const activePlansForCourse = plans.filter(
      (p) => p.courseId === activeCourseId && activePlanIds.includes(p.id),
    )
    const today = localToday()
    const label = courseLabel(activeCourseId ?? "")
    const taggedCourseId = activeCourseId ?? undefined

    const days = activePlansForCourse.flatMap((plan) => {
      const planChapters = getOrderedChapters(activeCourse, plan.unitOrder)
      const params = syncStudyPlan(plan, planChapters, today)
      const result = generateSchedule(plan, planChapters, today, params.pagesPerDay, params.endDate)
      return tagChaptersWithCourseId(result.schedule, taggedCourseId, label)
    })
    return dedupeScheduleByDate(days)
  }, [plans, activeCourseId, activePlanIds, activeCourse, courseLabel])

  // For each selected non-active course, merge ALL active plans' schedules.
  const otherCoursesInfo = useMemo(() => {
    if (otherSelectedIds.length === 0) return []
    const out: Array<{ courseId: string; courseName: string; schedule: StudyDay[]; chapters: ReturnType<typeof getOrderedChapters> }> = []
    for (const id of otherSelectedIds) {
      const cfg = courses.find((c) => c.id === id)
      const activePlansForCourse = allPlans.filter(
        (p) => p.courseId === id && activePlanIds.includes(p.id)
      )
      if (!cfg || activePlansForCourse.length === 0) continue

      const mergedSched: StudyDay[] = []
      const today = localToday()
      for (const plan of activePlansForCourse) {
        const planChapters = getOrderedChapters(cfg, plan.unitOrder)
        const params = syncStudyPlan(plan, planChapters, today)
        const result = generateSchedule(plan, planChapters, today, params.pagesPerDay, params.endDate)
        mergedSched.push(...result.schedule)
      }
      const dedupedSched = dedupeScheduleByDate(mergedSched)

      const primaryPlan = activePlansForCourse[0]
      out.push({
        courseId: id,
        courseName: courseLabel(id),
        chapters: getOrderedChapters(cfg, primaryPlan.unitOrder),
        schedule: dedupedSched,
      })
    }
    return out
  }, [otherSelectedIds, courses, allPlans, activePlanIds, courseLabel])

  const mergedSchedule = useMemo(() => {
    if (!showMerged || otherCoursesInfo.length === 0) return baseSchedule
    const items = [
      { schedule: baseSchedule, label: courseLabel(activeCourseId ?? ""), courseId: activeCourseId ?? undefined },
      ...otherCoursesInfo.map((o) => ({ schedule: o.schedule, label: o.courseName, courseId: o.courseId })),
    ]
    return mergeSchedules(items)
  }, [showMerged, baseSchedule, otherCoursesInfo, activeCourseId, courseLabel])

  const schedule = showMerged ? mergedSchedule : baseSchedule

  const selectedCoursesStats = useMemo(() => {
    const map: Record<string, CourseStat> = {}
    const add = (courseId: string, plan: StudyPlan, cfg: CourseConfig, sched: StudyDay[], chs: Chapter[]) => {
      const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chs)
      const today = localToday()
      const params = syncStudyPlan(plan, chs, today)
      const totalPagesRead = params.consumed
      const pctDone = totalPages > 0 ? Math.min(100, Math.round((totalPagesRead / totalPages) * 100)) : 0
      const lastDay = sched[sched.length - 1]
      const endDate = lastDay ? new Date(lastDay.date + "T00:00:00") : null
      const endDateLabel = endDate
        ? endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "\u2014"
      const todayMidnight = nowDate()
      todayMidnight.setHours(0, 0, 0, 0)
      const daysFromToday = endDate && endDate >= todayMidnight
        ? Math.round((endDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const calendarSpan = endDate
        ? Math.round((endDate.getTime() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1
        : 0
      const weeksAway = !endDate
        ? "\u2014"
        : daysFromToday !== null
          ? daysFromToday < 7
            ? `${daysFromToday}d away`
            : `${(daysFromToday / 7).toFixed(1)} wks away`
          : `${(calendarSpan / 7).toFixed(1)} wk span`
      map[courseId] = {
        courseId,
        courseName: cfg.name,
        color: cfg.units[0]?.color ?? "#2563EB",
        planName: plan.name,
        scheduleLength: sched.length,
        totalBookPages: cfg.totalPages ?? computeTotalPages(cfg),
        studyPages: cfg.studyPages ?? computeTotalPages(cfg),
        totalPages,
        totalPagesRead,
        pctDone,
        pagesPerDay: params.pagesPerDay,
        studyDaysCount: plan.studyDays.length,
        endDate,
        endDateLabel,
        weeksAway,
      }
    }

    if (activeCourseId && activeCourse) {
      const plan = plans.find((p) => p.id === primaryActivePlanId) ?? plans[0]
      if (plan) {
        add(activeCourseId, plan, activeCourse, baseSchedule, getOrderedChapters(activeCourse, plan.unitOrder))
      }
    }

    for (const info of otherCoursesInfo) {
      const cfg = courses.find((c) => c.id === info.courseId)
      const activePlansForCourse = allPlans.filter(
        (p) => p.courseId === info.courseId && activePlanIds.includes(p.id)
      )
      const plan = activePlansForCourse[0]
      if (cfg && plan) {
        add(info.courseId, plan, cfg, info.schedule, info.chapters)
      }
    }

    return map
  }, [activeCourseId, activeCourse, primaryActivePlanId, plans, baseSchedule, otherCoursesInfo, courses, allPlans, activePlanIds])

  return {
    baseSchedule,
    otherCoursesInfo,
    mergedSchedule,
    schedule,
    selectedCoursesStats,
    showMerged,
  }
}
