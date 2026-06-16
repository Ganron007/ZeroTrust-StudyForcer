import { describe, it, expect } from "vitest"
import {
  flattenChapters,
  computeDashboardStats,
  groupPlansByCourse,
  clampPagesPerDay,
} from "../planner-page-helpers"
import type { CourseConfig, CourseUnit, CourseChapter } from "@/types/course"
import type { StudyPlan } from "@/lib/plan-storage"

function makeChapter(id: number, title: string, pages: number): CourseChapter {
  return { id, title, pages }
}

function makeUnit(id: number, title: string, color: string, chapters: CourseChapter[]): CourseUnit {
  return { id, title, color, chapters }
}

function makeCourse(id: string, name: string, units: CourseUnit[]): CourseConfig {
  return {
    id,
    name,
    units,
    defaultSettings: { pagesPerDay: 20, studyDays: [1, 2, 3, 4, 5], startingChapterId: 1 },
  }
}

function makePlan(overrides: Partial<StudyPlan>): StudyPlan {
  return {
    id: "p1",
    courseId: "c1",
    name: "Test Plan",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    startDate: "2026-01-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5],
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}

describe("planner-page-helpers", () => {
  describe("flattenChapters", () => {
    it("returns empty array for course with no units", () => {
      const cfg = makeCourse("c1", "C1", [])
      expect(flattenChapters(cfg)).toEqual([])
    })

    it("returns empty array for course with units but no chapters", () => {
      const cfg = makeCourse("c1", "C1", [makeUnit(1, "U1", "#000", [])])
      expect(flattenChapters(cfg)).toEqual([])
    })

    it("annotates each chapter with its unit's id, name, and color", () => {
      const cfg = makeCourse("c1", "C1", [
        makeUnit(1, "Unit 1", "#ff0000", [
          makeChapter(1, "Ch 1", 20),
          makeChapter(2, "Ch 2", 30),
        ]),
        makeUnit(2, "Unit 2", "#00ff00", [
          makeChapter(3, "Ch 3", 40),
        ]),
      ])
      const flat = flattenChapters(cfg)
      expect(flat).toHaveLength(3)
      expect(flat[0]).toEqual({ id: 1, title: "Ch 1", pages: 20, unitId: 1, unitName: "Unit 1", color: "#ff0000" })
      expect(flat[1]).toEqual({ id: 2, title: "Ch 2", pages: 30, unitId: 1, unitName: "Unit 1", color: "#ff0000" })
      expect(flat[2]).toEqual({ id: 3, title: "Ch 3", pages: 40, unitId: 2, unitName: "Unit 2", color: "#00ff00" })
    })

    it("preserves unit and chapter order", () => {
      const cfg = makeCourse("c1", "C1", [
        makeUnit(2, "U2", "#000", [makeChapter(20, "Ch 20", 1)]),
        makeUnit(1, "U1", "#000", [makeChapter(10, "Ch 10", 1)]),
      ])
      const flat = flattenChapters(cfg)
      expect(flat.map((c) => c.id)).toEqual([20, 10])
    })
  })

  describe("computeDashboardStats", () => {
    it("returns zeros for empty inputs", () => {
      const stats = computeDashboardStats([], [], [])
      expect(stats).toEqual({ totalPlans: 0, activeCount: 0, courseCount: 0, avgPct: 0 })
    })

    it("counts plans and active plan ids correctly", () => {
      const plans = [makePlan({ id: "p1" }), makePlan({ id: "p2", courseId: "c2" })]
      const activePlanIds = ["p1"]
      const courses = [makeCourse("c1", "C1", []), makeCourse("c2", "C2", [])]
      const stats = computeDashboardStats(plans, activePlanIds, courses)
      expect(stats.totalPlans).toBe(2)
      expect(stats.activeCount).toBe(1)
      expect(stats.courseCount).toBe(2)
    })

    it("computes avgPct as the average of (donePages / totalPages) across plans", () => {
      // Plan p1: course with 100 pages, dailyLog has 25 pages read → 25%
      // Plan p2: course with 200 pages, dailyLog has 100 pages read → 50%
      // Average: (25 + 50) / 2 = 37.5 → rounded to 38
      const course1 = makeCourse("c1", "C1", [
        makeUnit(1, "U1", "#000", [
          makeChapter(1, "Ch 1", 50),
          makeChapter(2, "Ch 2", 50),
        ]),
      ])
      const course2 = makeCourse("c2", "C2", [
        makeUnit(1, "U1", "#000", [
          makeChapter(1, "Ch 1", 100),
          makeChapter(2, "Ch 2", 100),
        ]),
      ])
      const plans = [
        makePlan({
          id: "p1",
          courseId: "c1",
          dailyLog: { "2026-01-15": { pagesRead: 25 } },
        }),
        makePlan({
          id: "p2",
          courseId: "c2",
          dailyLog: { "2026-01-15": { pagesRead: 100 } },
        }),
      ]
      const stats = computeDashboardStats(plans, ["p1", "p2"], [course1, course2])
      expect(stats.avgPct).toBe(38)
    })

    it("treats plans with no course config as 0%", () => {
      // Plan p1 has courseId "missing" → no cfg found → counted as 0
      const plans = [makePlan({ id: "p1", courseId: "missing" })]
      const stats = computeDashboardStats(plans, ["p1"], [])
      expect(stats.avgPct).toBe(0)
    })

    it("clamps negative page counts to 0", () => {
      const course = makeCourse("c1", "C1", [
        makeUnit(1, "U1", "#000", [makeChapter(1, "Ch 1", 50)]),
      ])
      const plans = [makePlan({
        id: "p1",
        courseId: "c1",
        dailyLog: { "2026-01-15": { pagesRead: -10 } },
      })]
      const stats = computeDashboardStats(plans, ["p1"], [course])
      expect(stats.avgPct).toBe(0)
    })
  })

  describe("groupPlansByCourse", () => {
    it("returns an empty record for empty inputs", () => {
      expect(groupPlansByCourse([], [])).toEqual({})
    })

    it("groups plans by their courseId", () => {
      const plans = [
        makePlan({ id: "p1", courseId: "c1" }),
        makePlan({ id: "p2", courseId: "c1" }),
        makePlan({ id: "p3", courseId: "c2" }),
      ]
      const courses = [makeCourse("c1", "C1", []), makeCourse("c2", "C2", [])]
      const groups = groupPlansByCourse(courses, plans)
      expect(groups.c1).toHaveLength(2)
      expect(groups.c2).toHaveLength(1)
    })

    it("preserves course iteration order", () => {
      const plans = [makePlan({ id: "p1", courseId: "c1" })]
      const courses = [makeCourse("c2", "C2", []), makeCourse("c1", "C1", [])]
      const groups = groupPlansByCourse(courses, plans)
      expect(Object.keys(groups)).toEqual(["c2", "c1"])
    })

    it("returns empty arrays for courses with no plans", () => {
      const courses = [makeCourse("c1", "C1", []), makeCourse("c2", "C2", [])]
      const groups = groupPlansByCourse(courses, [])
      expect(groups.c1).toEqual([])
      expect(groups.c2).toEqual([])
    })
  })

  describe("clampPagesPerDay", () => {
    it("returns 1 for 0", () => {
      expect(clampPagesPerDay(0)).toBe(1)
    })
    it("returns 1 for negative", () => {
      expect(clampPagesPerDay(-10)).toBe(1)
    })
    it("returns the value for positive", () => {
      expect(clampPagesPerDay(20)).toBe(20)
    })
    it("returns NaN unchanged (caller should pre-validate)", () => {
      // Math.max(1, NaN) === NaN, not 1. The component should pre-validate
      // before calling. This documents the behavior.
      expect(Number.isNaN(clampPagesPerDay(NaN))).toBe(true)
    })
  })
})
