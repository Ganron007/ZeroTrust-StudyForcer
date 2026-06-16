/**
 * useSchedule hook — behavioral tests.
 *
 * v2.7.0: hook extracted from App.tsx. Owns:
 *   - baseSchedule: per-course merged plan schedule
 *   - mergedSchedule: cross-course merge when 2+ selected
 *   - selectedCoursesStats: stats per course for the top bar
 *   - showMerged: derived from selectedCourseIds.size > 1
 *
 * These tests render the hook in isolation with a minimal harness. We
 * use jsdom (test-setup.ts) and run under TZ=UTC (vitest.config.ts) so
 * dates are deterministic.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"

vi.mock("../../is-tauri", () => ({ IS_TAURI: false }))

import { useSchedule } from "../useSchedule"
import type { StudyPlan } from "../../lib/plan-storage"
import type { CourseConfig } from "../../types/course"

const courseLabel = (id: string) => {
  if (id === "cissp-10th-ed") return "CISSP"
  if (id === "comptia-secai-cy0-001") return "SecAI+"
  return id
}

const makeCourse = (overrides: Partial<CourseConfig>): CourseConfig => ({
  id: "cissp-10th-ed",
  name: "CISSP",
  units: [
    { id: 1, title: "Unit 1", color: "#3b82f6", chapters: [
      { id: 1, title: "Ch 1", pages: 100 },
      { id: 2, title: "Ch 2", pages: 100 },
    ]},
  ],
  defaultSettings: { pagesPerDay: 20, studyDays: [1,2,3,4,5], startingChapterId: 1 },
  ...overrides,
})

const makePlan = (overrides: Partial<StudyPlan> & { id: string; courseId: string }): StudyPlan => ({
  name: "Plan",
  startDate: "2026-06-01",
  pagesPerDay: 20,
  dailyLog: {},
  chapterStartOverrides: {},
  studyDays: [1, 2, 3, 4, 5],
  unitOrder: [],
  startingChapterId: 1,
  skippedDays: [],
  anchor: "pagesPerDay",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
})

describe("useSchedule — showMerged flag", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns showMerged=false when only one course is selected", () => {
    const courses = [makeCourse({})]
    const allPlans: StudyPlan[] = []
    const { result } = renderHook(() =>
      useSchedule({
        allPlans,
        activePlanIds: [],
        activeCourseId: "cissp-10th-ed",
        activeCourse: courses[0],
        primaryActivePlanId: null,
        courses,
        selectedCourseIds: new Set(["cissp-10th-ed"]),
        courseLabel,
      })
    )
    expect(result.current.showMerged).toBe(false)
    expect(result.current.schedule).toEqual(result.current.baseSchedule)
  })

  it("returns showMerged=true when 2+ courses are selected", () => {
    const courses = [
      makeCourse({}),
      makeCourse({ id: "comptia-secai-cy0-001", name: "SecAI+" }),
    ]
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [],
        activePlanIds: [],
        activeCourseId: "cissp-10th-ed",
        activeCourse: courses[0],
        primaryActivePlanId: null,
        courses,
        selectedCourseIds: new Set(["cissp-10th-ed", "comptia-secai-cy0-001"]),
        courseLabel,
      })
    )
    expect(result.current.showMerged).toBe(true)
    expect(result.current.schedule).toBe(result.current.mergedSchedule)
  })

  it("returns empty schedule when no active course", () => {
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [],
        activePlanIds: [],
        activeCourseId: null,
        activeCourse: null,
        primaryActivePlanId: null,
        courses: [],
        selectedCourseIds: new Set(),
        courseLabel,
      })
    )
    expect(result.current.schedule).toEqual([])
    expect(result.current.selectedCoursesStats).toEqual({})
  })
})

describe("useSchedule — selectedCoursesStats", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("computes stats for the active course (pctDone, pagesPerDay)", () => {
    const course = makeCourse({})
    const plan = makePlan({ id: "p1", courseId: "cissp-10th-ed" })
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [plan],
        activePlanIds: ["p1"],
        activeCourseId: "cissp-10th-ed",
        activeCourse: course,
        primaryActivePlanId: "p1",
        courses: [course],
        selectedCourseIds: new Set(["cissp-10th-ed"]),
        courseLabel,
      })
    )
    const stat = result.current.selectedCoursesStats["cissp-10th-ed"]
    expect(stat).toBeDefined()
    expect(stat.courseId).toBe("cissp-10th-ed")
    expect(stat.pagesPerDay).toBeGreaterThan(0)
    expect(stat.totalBookPages).toBe(200) // 2 chapters × 100 pages
  })

  it("includes each non-active course from selectedCourseIds", () => {
    const c1 = makeCourse({ id: "cissp-10th-ed" })
    const c2 = makeCourse({ id: "comptia-secai-cy0-001", name: "SecAI+" })
    const plan1 = makePlan({ id: "p1", courseId: "cissp-10th-ed" })
    const plan2 = makePlan({ id: "p2", courseId: "comptia-secai-cy0-001" })
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [plan1, plan2],
        activePlanIds: ["p1", "p2"],
        activeCourseId: "cissp-10th-ed",
        activeCourse: c1,
        primaryActivePlanId: "p1",
        courses: [c1, c2],
        selectedCourseIds: new Set(["cissp-10th-ed", "comptia-secai-cy0-001"]),
        courseLabel,
      })
    )
    const stats = result.current.selectedCoursesStats
    expect(Object.keys(stats).sort()).toEqual(["cissp-10th-ed", "comptia-secai-cy0-001"])
    expect(stats["cissp-10th-ed"].courseName).toBe("CISSP")
    expect(stats["comptia-secai-cy0-001"].courseName).toBe("SecAI+")
  })
})

describe("useSchedule — baseSchedule generation", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns [] when active course has no plans", () => {
    const course = makeCourse({})
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [],
        activePlanIds: [],
        activeCourseId: "cissp-10th-ed",
        activeCourse: course,
        primaryActivePlanId: null,
        courses: [course],
        selectedCourseIds: new Set(["cissp-10th-ed"]),
        courseLabel,
      })
    )
    expect(result.current.baseSchedule).toEqual([])
  })

  it("generates a schedule when an active plan is present", () => {
    const course = makeCourse({})
    const plan = makePlan({ id: "p1", courseId: "cissp-10th-ed" })
    const { result } = renderHook(() =>
      useSchedule({
        allPlans: [plan],
        activePlanIds: ["p1"],
        activeCourseId: "cissp-10th-ed",
        activeCourse: course,
        primaryActivePlanId: "p1",
        courses: [course],
        selectedCourseIds: new Set(["cissp-10th-ed"]),
        courseLabel,
      })
    )
    expect(result.current.baseSchedule.length).toBeGreaterThan(0)
    // Every chapter should be tagged with the active courseId
    for (const day of result.current.baseSchedule) {
      for (const ch of day.chapters) {
        expect(ch.courseId).toBe("cissp-10th-ed")
        expect(ch.courseLabel).toBe("CISSP")
      }
    }
  })
})
