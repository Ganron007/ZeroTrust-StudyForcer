import { describe, it, expect } from "vitest"

import { computePlanSchedule, type PlanSchedule } from "../plan-engine"
import { defaultPlan, type StudyPlan } from "../plan-storage"
import { today as todayNow } from "../clock"
import type { Chapter } from "../../types/course"

const mockChapters: Chapter[] = [
  { id: 1, unitId: 1, title: "Chapter 1", pages: 20, color: "#000", unitName: "Unit 1" },
  { id: 2, unitId: 1, title: "Chapter 2", pages: 20, color: "#000", unitName: "Unit 1" },
  { id: 3, unitId: 1, title: "Chapter 3", pages: 20, color: "#000", unitName: "Unit 1" },
]

describe("computePlanSchedule: single source of truth for schedule derivation", () => {
  it("returns schedule + params + today", () => {
    const plan: StudyPlan = {
      ...defaultPlan("test-course"),
      id: "p1",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    }
    const result: PlanSchedule = computePlanSchedule(plan, mockChapters, "2026-06-10")
    expect(result.schedule).toBeDefined()
    expect(result.schedule.schedule).toBeDefined()
    expect(result.params).toBeDefined()
    expect(result.today).toBe("2026-06-10")
  })

  it("is deterministic — same inputs produce same output", () => {
    const plan: StudyPlan = {
      ...defaultPlan("test-course"),
      id: "p1",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    }
    const r1 = computePlanSchedule(plan, mockChapters, "2026-06-10")
    const r2 = computePlanSchedule(plan, mockChapters, "2026-06-10")
    expect(r1.schedule.schedule.length).toBe(r2.schedule.schedule.length)
    expect(r1.params.pagesPerDay).toBe(r2.params.pagesPerDay)
    expect(r1.params.endDate).toBe(r2.params.endDate)
  })

  it("uses clock.today() as default", () => {
    const plan: StudyPlan = {
      ...defaultPlan("test-course"),
      id: "p1",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    }
    const result = computePlanSchedule(plan, mockChapters)
    // Should use the clock's today() function
    expect(result.today).toBe(todayNow())
  })

  it("respects anchor=endDate (deadline) vs anchor=pagesPerDay (velocity)", () => {
    const planDeadline: StudyPlan = {
      ...defaultPlan("test-course"),
      id: "p1",
      anchor: "endDate",
      targetEndDate: "2026-12-31",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    }
    const planVelocity: StudyPlan = {
      ...defaultPlan("test-course"),
      id: "p2",
      anchor: "pagesPerDay",
      pagesPerDay: 25,
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
    }
    const rDeadline = computePlanSchedule(planDeadline, mockChapters, "2026-06-10")
    const rVelocity = computePlanSchedule(planVelocity, mockChapters, "2026-06-10")
    expect(rDeadline.params.anchor).toBe("endDate")
    expect(rVelocity.params.anchor).toBe("pagesPerDay")
    // Velocity plan uses the fixed pagesPerDay, deadline plan computes a different pace
    expect(rVelocity.params.pagesPerDay).toBe(25)
  })
})
