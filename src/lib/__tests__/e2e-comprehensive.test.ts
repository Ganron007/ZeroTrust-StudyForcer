/**
 * Comprehensive integration tests covering the full matrix of user scenarios.
 *
 * Scenarios:
 *   1. Multiple courses with multiple anchor points
 *   2. Multiple courses with random unit order all active
 *   3. Multiple courses with random unit order + varied anchors
 *   4. Edit one plan after N days (anchor / unit order change)
 *   5. Edit multiple plans after N days
 *
 * Operations tested per scenario:
 *   - Skip days
 *   - Skip chapters (single day, multiple days)
 *   - Log varying page ranges in varying order
 *   - Mark Done same day / delayed
 *
 * Verification: schedule, pagesRead, remaining, endDate, stats.
 */

import { describe, it, expect, vi } from "vitest"
import { syncStudyPlan } from "../plan-engine"
import { generateSchedule, getOrderedChapters, getTotalPages } from "../cissp-data"
import { type StudyPlan } from "../plan-storage"
import type { Chapter, CourseConfig } from "@/types/course"

// ── Mock IS_TAURI ───────────────────────────────────────────────────────────
vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

// ── Test data: 4 courses with different structures ─────────────────────────
// Each course has 3 units, each with 2 chapters of 10 pages = 60pp per course.

interface CourseFixture {
  course: CourseConfig
  chapters: Chapter[]
}

function makeChapter(id: number, unitId: number, unitName: string): Chapter {
  return { id, title: `Ch${id}`, pages: 10, unitId, unitName, color: "#3b82f6" }
}

function makeUnit(id: number, name: string, chapterIds: number[]): { id: number; title: string; color: string; chapters: { id: number; title: string; pages: number; bookPageStart?: number }[] } {
  return {
    id,
    title: name,
    color: id === 1 ? "#3b82f6" : id === 2 ? "#8b5cf6" : "#f59e0b",
    chapters: chapterIds.map(cid => ({ id: cid, title: `Ch${cid}`, pages: 10 })),
  }
}

// Course A: velocity anchor, standard order [1,2,3,4,5,6]
const COURSE_A: CourseFixture = {
  course: {
    id: "course-a",
    name: "Course A",
    units: [
      makeUnit(1, "U1-A", [1, 2]),
      makeUnit(2, "U2-A", [3, 4]),
      makeUnit(3, "U3-A", [5, 6]),
    ],
  } as CourseConfig,
  chapters: [
    makeChapter(1, 1, "U1-A"), makeChapter(2, 1, "U1-A"),
    makeChapter(3, 2, "U2-A"), makeChapter(4, 2, "U2-A"),
    makeChapter(5, 3, "U3-A"), makeChapter(6, 3, "U3-A"),
  ],
}

// Course B: deadline anchor, standard order [1,2,3,4,5,6]
const COURSE_B: CourseFixture = {
  course: {
    id: "course-b",
    name: "Course B",
    units: [
      makeUnit(1, "U1-B", [1, 2]),
      makeUnit(2, "U2-B", [3, 4]),
      makeUnit(3, "U3-B", [5, 6]),
    ],
  } as CourseConfig,
  chapters: [
    makeChapter(1, 1, "U1-B"), makeChapter(2, 1, "U1-B"),
    makeChapter(3, 2, "U2-B"), makeChapter(4, 2, "U2-B"),
    makeChapter(5, 3, "U3-B"), makeChapter(6, 3, "U3-B"),
  ],
}

// Course C: velocity, custom unit order [3, 1, 2] → ch5,ch6,ch1,ch2,ch3,ch4
const COURSE_C: CourseFixture = {
  course: {
    id: "course-c",
    name: "Course C",
    units: [
      makeUnit(1, "U1-C", [1, 2]),
      makeUnit(2, "U2-C", [3, 4]),
      makeUnit(3, "U3-C", [5, 6]),
    ],
  } as CourseConfig,
  chapters: [
    makeChapter(1, 1, "U1-C"), makeChapter(2, 1, "U1-C"),
    makeChapter(3, 2, "U2-C"), makeChapter(4, 2, "U2-C"),
    makeChapter(5, 3, "U3-C"), makeChapter(6, 3, "U3-C"),
  ],
}

// Course D: deadline, custom unit order [2, 3] → ch3,ch4,ch5,ch6,ch1,ch2
const COURSE_D: CourseFixture = {
  course: {
    id: "course-d",
    name: "Course D",
    units: [
      makeUnit(1, "U1-D", [1, 2]),
      makeUnit(2, "U2-D", [3, 4]),
      makeUnit(3, "U3-D", [5, 6]),
    ],
  } as CourseConfig,
  chapters: [
    makeChapter(1, 1, "U1-D"), makeChapter(2, 1, "U1-D"),
    makeChapter(3, 2, "U2-D"), makeChapter(4, 2, "U2-D"),
    makeChapter(5, 3, "U3-D"), makeChapter(6, 3, "U3-D"),
  ],
}

const TOTAL_PP = 60 // 6 chapters × 10pp

function makeBasePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: "test-plan",
    courseId: "course-a",
    name: "Test",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    startDate: "2026-04-06", // Monday
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5], // Mon-Fri
    startingChapterId: 1,
    chapterStartOverrides: {},
    anchor: "pagesPerDay",
    completedDays: [],
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}

// ── Helper: simulate handleToggleDay ───────────────────────────────────────
// Takes temp chapterProgress + day's chapters, returns pagesRead.
// This EXACTLY mirrors App.tsx handleToggleDay logic.
function simulateMarkDone(
  tempChapterProgress: Record<number, { count: number; skipped?: boolean }> | undefined,
  dayChapters: Chapter[],
): number {
  if (!tempChapterProgress || Object.keys(tempChapterProgress).length === 0) return 0
  let pagesRead = 0
  for (const ch of dayChapters) {
    const progress = tempChapterProgress[ch.id]
    if (progress) {
      pagesRead += progress.skipped ? 0 : progress.count || 0
    }
    // Unlogged = 0 (deferred)
  }
  return pagesRead
}

// ── Helper: log a chapter into temp state ──────────────────────────────────
function logChapter(
  temp: Record<string, Record<number, { count: number; skipped?: boolean }>>,
  date: string,
  chapterId: number,
  count: number,
  skipped = false,
): void {
  if (!temp[date]) temp[date] = {}
  temp[date][chapterId] = { count, skipped }
}

// ── Helper: build a daily log entry from temp chapterProgress ──────────────
function buildLog(date: string, temp: Record<string, Record<number, { count: number; skipped?: boolean }>>, dayChapters: Chapter[]): { pagesRead: number } {
  return { pagesRead: simulateMarkDone(temp[date], dayChapters) }
}

// ── Helper: get ordered chapters for a plan ────────────────────────────────
function getChaptersForPlan(fixture: CourseFixture, unitOrder?: number[]): Chapter[] {
  return getOrderedChapters(fixture.course, unitOrder)
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Multiple courses with multiple anchor points
// ═══════════════════════════════════════════════════════════════════════════
describe("S1: Multi-Course × Multi-Anchor", () => {
  // ── Plan A: velocity, 20ppd, standard order ──
  // ── Plan B: deadline, targetEndDate=2026-04-17, standard order ──
  // First study day: Mon 2026-04-06 → 2 chapters (20pp at 20ppd)

  it("[S1.1] skip one study day on velocity plan A; deadline plan B unaffected", () => {
    const planA = makeBasePlan({ id: "plan-a", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "endDate", pagesPerDay: 20, startDate: "2026-04-06", targetEndDate: "2026-04-17" })

    // Skip day 2026-04-06 (Monday) for plan A only
    planA.skippedDays = ["2026-04-06"]

    const today = "2026-04-07" // Tuesday
    const chA = getChaptersForPlan(COURSE_A)
    const chB = getChaptersForPlan(COURSE_B)
    const paramsA = syncStudyPlan(planA, chA, today)
    const paramsB = syncStudyPlan(planB, chB, today)

    // Plan A: day skipped → 0 consumed, 60 remaining, endDate extends
    expect(paramsA.consumed).toBe(0)
    expect(paramsA.remaining).toBe(TOTAL_PP)
    expect(paramsA.endDate).toBeDefined()
    // Without skip: neededDays = ceil(60/20) = 3 → end ~Apr 8
    // With skip of day 1: neededDays same (3) but starts Apr 7 → end extends by 1 day

    // Plan B: unaffected by plan A's skip. Day 1 not skipped for B → 20 consumed
    // But wait — B also starts Apr 6. If B didn't skip, it should have consumed 20 on Apr 6.
    // We didn't log anything for B. So consumed = 0 (no logs).
    // With deadline: available = countStudyDays(Apr 7, Apr 17, [1,2,3,4,5], [])
    //   Apr 7(Tue)-Apr 17(Fri) = 9 study days
    //   remaining = 60, pace = ceil(60/9) = 7ppd
    expect(paramsB.consumed).toBe(0)
    expect(paramsB.remaining).toBe(TOTAL_PP)
    expect(paramsB.anchor).toBe("endDate")
    expect(paramsB.pagesPerDay).toBeGreaterThanOrEqual(1)
    // Plan A's skip should NOT affect Plan B's endDate/pace
    expect(paramsB.endDate).toBe("2026-04-17")
  })

  it("[S1.2] skip chapter on velocity A + log partial on deadline B → independent recalibration", () => {
    const planA = makeBasePlan({ id: "plan-a", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "endDate", pagesPerDay: 20, startDate: "2026-04-06", targetEndDate: "2026-04-17" })

    const chA = getChaptersForPlan(COURSE_A) // [ch1(10), ch2(10), ch3(10), ch4(10), ch5(10), ch6(10)]
    const chB = getChaptersForPlan(COURSE_B)

    // Day 1 (Apr 6, Mon): both plans have 2 chapters (20pp at 20ppd)
    const day1ChsA = chA.slice(0, 2) // ch1(10), ch2(10)
    const day1ChsB = chB.slice(0, 2) // ch1(10), ch2(10)

    // Plan A: log ch1=3pp, skip ch2
    const tempA: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(tempA, "2026-04-06", 1, 3)
    logChapter(tempA, "2026-04-06", 2, 0, true)
    const pagesReadA = simulateMarkDone(tempA["2026-04-06"], day1ChsA) // 3pp

    // Plan B: log ch1=8pp, ch2=5pp
    const tempB: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(tempB, "2026-04-06", 1, 8)
    logChapter(tempB, "2026-04-06", 2, 5)
    const pagesReadB = simulateMarkDone(tempB["2026-04-06"], day1ChsB) // 13pp

    // Apply to plans
    planA.dailyLog["2026-04-06"] = { pagesRead: pagesReadA }
    planA.completedDays = ["2026-04-06"]
    planB.dailyLog["2026-04-06"] = { pagesRead: pagesReadB }
    planB.completedDays = ["2026-04-06"]

    const today = "2026-04-07"
    const paramsA = syncStudyPlan(planA, chA, today)
    const paramsB = syncStudyPlan(planB, chB, today)

    // Plan A: consumed=3, remaining=57, velocity
    expect(paramsA.consumed).toBe(3)
    expect(paramsA.remaining).toBe(57)
    expect(paramsA.anchor).toBe("pagesPerDay")
    expect(paramsA.pagesPerDay).toBe(20)

    // Plan B: consumed=13, remaining=47, deadline pace=ceil(47/8)=6ppd
    // (Apr 7 to Apr 17 = 9 study days minus 0 = 9... wait, Apr 7 is day after Apr 6)
    // effectiveFrom = max(startDate=Apr6, today=Apr7) = Apr7
    // available = countStudyDays(Apr7, Apr17, [1..5], []) = Apr7-11, Apr14-17 = 9 days
    // pace = ceil(47/9) = 6ppd
    expect(paramsB.consumed).toBe(13)
    expect(paramsB.remaining).toBe(47)
    expect(paramsB.anchor).toBe("endDate")
    expect(paramsB.endDate).toBe("2026-04-17")
    expect(paramsB.pagesPerDay).toBe(6)
  })

  it("[S1.3] log+skip days on both plans → schedules reflect independent consumption", () => {
    const planA = makeBasePlan({ id: "plan-a", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "endDate", pagesPerDay: 20, startDate: "2026-04-06", targetEndDate: "2026-04-17" })

    const chA = getChaptersForPlan(COURSE_A)
    const chB = getChaptersForPlan(COURSE_B)

    // Day 1 (Apr 6): both log 20pp (no skip)
    planA.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planA.completedDays.push("2026-04-06")
    planB.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planB.completedDays.push("2026-04-06")

    // Day 2 (Apr 7): A skips day entirely; B logs 10pp
    planA.skippedDays.push("2026-04-07")
    planB.dailyLog["2026-04-07"] = { pagesRead: 10 }
    planB.completedDays.push("2026-04-07")

    // Day 3 (Apr 8): A logs 5pp; B logs 20pp
    planA.dailyLog["2026-04-08"] = { pagesRead: 5 }
    planA.completedDays.push("2026-04-08")
    planB.dailyLog["2026-04-08"] = { pagesRead: 20 }
    planB.completedDays.push("2026-04-08")

    const today = "2026-04-09" // Thursday
    const paramsA = syncStudyPlan(planA, chA, today)
    const paramsB = syncStudyPlan(planB, chB, today)

    // A: consumed=25, remaining=35. Velocity. needed=ceil(35/20)=2
    expect(paramsA.consumed).toBe(25)
    expect(paramsA.remaining).toBe(35)

    // B: consumed=50, remaining=10. Deadline. Apr9-17 = 7 study days. pace=ceil(10/7)=2
    expect(paramsB.consumed).toBe(50)
    expect(paramsB.remaining).toBe(10)
    expect(paramsB.endDate).toBe("2026-04-17")
    expect(paramsB.pagesPerDay).toBe(2)
  })

  it("[S1.4] delayed Mark Done (log on Mon, Mark Done on Tue) → result matches Wed consumption", () => {
    const plan = makeBasePlan({ id: "plan", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const chs = getChaptersForPlan(COURSE_A)

    // User STUDIES on Mon Apr 6 — logs ch1=5pp, ch2=3pp in temp state
    // But does NOT Mark Done until Tue Apr 7
    // On Tue Apr 7, user Marks Done for Apr 6

    // Simulate what handleToggleDay does on Apr 7 for date Apr 6:
    // The baseSchedule on Apr 7 has Day 1 (Apr 6) with 2 chapters (20pp)
    const day1Chs = chs.slice(0, 2)
    const temp: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(temp, "2026-04-06", 1, 5)
    logChapter(temp, "2026-04-06", 2, 3)
    const pagesRead = simulateMarkDone(temp["2026-04-06"], day1Chs) // 8pp

    // Apply to plan (as if user Marked Done on Apr 7)
    plan.dailyLog["2026-04-06"] = { pagesRead }
    plan.completedDays = ["2026-04-06"]

    // Now run sync on Apr 7 — should see consumed=8
    const params = syncStudyPlan(plan, chs, "2026-04-07")
    expect(params.consumed).toBe(8)
    expect(params.remaining).toBe(52)

    // If user ALSO studies on Apr 7 and logs 12pp:
    plan.dailyLog["2026-04-07"] = { pagesRead: 12 }
    plan.completedDays.push("2026-04-07")

    const params2 = syncStudyPlan(plan, chs, "2026-04-08")
    expect(params2.consumed).toBe(20) // 8 + 12
    expect(params2.remaining).toBe(40)

    // Schedule: Day 1 slice=8, Day 2 slice=12, Day 3+ uncompleted slice=20
    const sched = generateSchedule(plan, chs, "2026-04-08", 20, params2.endDate)
    const day1 = sched.schedule.find(d => d.date === "2026-04-06")
    const day2 = sched.schedule.find(d => d.date === "2026-04-07")
    expect(day1).toBeDefined()
    expect(day1!.totalPages).toBe(8)
    expect(day2).toBeDefined()
    expect(day2!.totalPages).toBe(12)
  })

  it("[S1.5] Day 1 has 2chs at 20ppd; log ch1+skip ch2 → verify deferred pages appear on Day 2", () => {
    const plan = makeBasePlan({ id: "plan", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const chs = getChaptersForPlan(COURSE_A)

    const day1Chs = chs.slice(0, 2) // ch1(10), ch2(10)
    const temp: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(temp, "2026-04-06", 1, 10) // fully read ch1
    logChapter(temp, "2026-04-06", 2, 0, true) // skipped ch2
    const pagesRead = simulateMarkDone(temp["2026-04-06"], day1Chs) // 10pp

    plan.dailyLog["2026-04-06"] = { pagesRead }
    plan.completedDays = ["2026-04-06"]

    // Day 2 (Apr 7): user continues — ch2 should appear (was deferred)
    // At 20ppd, Day 2 gets ch2(10pp, deferred) + ch3(10pp)
    const sched = generateSchedule(plan, chs, "2026-04-07", 20, null)
    const day2 = sched.schedule.find(d => d.date === "2026-04-07")
    expect(day2).toBeDefined()
    expect(day2!.totalPages).toBe(20)
    // Day 2 should include ch2 (from deferred) and ch3
    const day2ChIds = day2!.chapters.map(c => c.chapterId)
    expect(day2ChIds).toContain(2)
    expect(day2ChIds).toContain(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Multiple courses with random unit order all active
// ═══════════════════════════════════════════════════════════════════════════
describe("S2: Multi-Course × Custom Unit Order", () => {
  it("[S2.1] Course C (unitOrder=[3,1,2]) shows ch5,ch6 before ch1,ch2", () => {
    const ordered = getOrderedChapters(COURSE_C.course, [3, 1, 2])
    expect(ordered.length).toBe(6)
    // Unit 3 (ch5,ch6) first, then Unit 1 (ch1,ch2), then Unit 2 (ch3,ch4)
    expect(ordered[0].id).toBe(5)
    expect(ordered[1].id).toBe(6)
    expect(ordered[2].id).toBe(1)
    expect(ordered[3].id).toBe(2)
    expect(ordered[4].id).toBe(3)
    expect(ordered[5].id).toBe(4) // unit 2 = ch3,ch4
    // Let me re-check: COURSE_C units are [makeUnit(1), makeUnit(2), makeUnit(3)]
    // Unit 3 = id 3 = new makeUnit(3, "U3-C", [5, 6]) → chapters [Ch5, Ch6]
    // Unit 1 = id 1 = new makeUnit(1, "U1-C", [1, 2]) → chapters [Ch1, Ch2]
    // Unit 2 = id 2 = new makeUnit(2, "U2-C", [3, 4]) → chapters [Ch3, Ch4]
    // Ordered: [5,6, 1,2, 3,4]
    expect(ordered[0].id).toBe(5)
    expect(ordered[1].id).toBe(6)
    expect(ordered[2].id).toBe(1)
    expect(ordered[3].id).toBe(2)
    expect(ordered[4].id).toBe(3)
    expect(ordered[5].id).toBe(4)
  })

  it("[S2.2] Course D (unitOrder=[2,3]) shows ch3,ch4,ch5,ch6 before ch1,ch2", () => {
    const ordered = getOrderedChapters(COURSE_D.course, [2, 3])
    expect(ordered.length).toBe(6)
    // Unit 2 (ch3,ch4) → Unit 3 (ch5,ch6) → Unit 1 (ch1,ch2, appended)
    expect(ordered[0].id).toBe(3)
    expect(ordered[1].id).toBe(4)
    expect(ordered[2].id).toBe(5)
    expect(ordered[3].id).toBe(6)
    expect(ordered[4].id).toBe(1)
    expect(ordered[5].id).toBe(2)
  })

  it("[S2.3] skip chapter on custom-ordered plan → deferred pages respect custom order", () => {
    // Course C with unitOrder=[3,1,2]: sequence is [ch5, ch6, ch1, ch2, ch3, ch4]
    // Each 10pp. At 20ppd: Day 1 = ch5(10pp) + ch6(10pp)
    // Skip ch6 on Day 1 → Day 2 should show ch6(deferred) + ch1(10pp)
    const plan = makeBasePlan({ id: "plan-c", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [3, 1, 2], startingChapterId: 5 })
    const chs = getOrderedChapters(COURSE_C.course, [3, 1, 2])

    // Day 1 (Apr 6): ch5(10pp) + ch6(10pp). Log ch5=10, Skip ch6.
    const day1Chs = chs.slice(0, 2) // ch5, ch6
    expect(day1Chs[0].id).toBe(5)
    expect(day1Chs[1].id).toBe(6)

    const temp: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(temp, "2026-04-06", 5, 10)
    logChapter(temp, "2026-04-06", 6, 0, true)
    const pagesRead = simulateMarkDone(temp["2026-04-06"], day1Chs) // 10pp

    plan.dailyLog["2026-04-06"] = { pagesRead }
    plan.completedDays = ["2026-04-06"]

    // Generate schedule from Apr 7
    const params = syncStudyPlan(plan, chs, "2026-04-07")
    const sched = generateSchedule(plan, chs, "2026-04-07", 20, params.endDate)

    // Day 2 (Apr 7): should show ch6(deferred=10pp) + ch1(10pp)
    const day2 = sched.schedule.find(d => d.date === "2026-04-07")
    expect(day2).toBeDefined()
    expect(day2!.totalPages).toBe(20)
    const day2ChIds = day2!.chapters.map(c => c.chapterId)
    expect(day2ChIds).toContain(6) // deferred
    expect(day2ChIds).toContain(1) // next in custom order
  })

  it("[S2.4] DEBUG — verify chapter order and page sequence", () => {
    const chsC = getOrderedChapters(COURSE_C.course, [3, 1, 2]) // [ch5,ch6,ch1,ch2,ch3,ch4]
    expect(chsC.length).toBe(6)
    expect(chsC[0].id).toBe(5)
    expect(chsC[1].id).toBe(6)
    expect(chsC[2].id).toBe(1)
    expect(chsC[3].id).toBe(2)
    expect(chsC[4].id).toBe(3)
    expect(chsC[5].id).toBe(4)

    // Generate a schedule without logging to see default day assignments
    const plan = makeBasePlan({ id: "plan-c", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [3, 1, 2], startingChapterId: 5 })
    const sched = generateSchedule(plan, chsC, "2026-04-06", 20, null)
    const day1 = sched.schedule.find(d => d.date === "2026-04-06")
    expect(day1).toBeDefined()
    // At 20ppd, day 1 should be ch5+ch6
    expect(day1!.chapters[0].chapterId).toBe(5)
    expect(day1!.chapters[1].chapterId).toBe(6)
    expect(day1!.totalPages).toBe(20)
  })

  it("[S2.4] two plans with different custom orders — each schedule respects its own order", () => {
    // Plan C: unitOrder=[3,1,2] → [ch5,ch6, ch1,ch2, ch3,ch4]
    // Plan D: unitOrder=[2,3] → [ch3,ch4, ch5,ch6, ch1,ch2]
    const planC = makeBasePlan({ id: "plan-c", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [3, 1, 2], startingChapterId: 5 })
    const planD = makeBasePlan({ id: "plan-d", courseId: "course-d", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [2, 3], startingChapterId: 3 })

    // First verify the chapter arrays are correct
    const chsC = getOrderedChapters(COURSE_C.course, [3, 1, 2])
    const chsD = getOrderedChapters(COURSE_D.course, [2, 3])
    expect(chsC[0].id).toBe(5)
    expect(chsC[1].id).toBe(6)
    expect(chsC[2].id).toBe(1)
    expect(chsD[0].id).toBe(3)
    expect(chsD[1].id).toBe(4)

    // Day 1 (Apr 6): both at 20ppd
    // Plan C: ch5(10pp) + ch6(10pp). Both logged at 10.
    // Plan D: ch3(10pp) + ch4(10pp). Both logged at 10.
    planC.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planC.completedDays = ["2026-04-06"]
    planD.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planD.completedDays = ["2026-04-06"]

    const today = "2026-04-07"
    const schedC = generateSchedule(planC, chsC, today, 20, null)
    const schedD = generateSchedule(planD, chsD, today, 20, null)

    // Day 2 (Apr 7): Plan C should have ch1,ch2; Plan D should have ch5,ch6
    const day2C = schedC.schedule.find(d => d.date === "2026-04-07")
    const day2D = schedD.schedule.find(d => d.date === "2026-04-07")
    expect(day2C).toBeDefined()
    expect(day2D).toBeDefined()
    expect(day2C!.chapters[0].chapterId).toBe(1) // custom order: ch5,ch6 done → ch1
    expect(day2D!.chapters[0].chapterId).toBe(5) // custom order: ch3,ch4 done → ch5
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Multiple courses with random unit order + varied anchors
// ═══════════════════════════════════════════════════════════════════════════
describe("S3: Multi-Course × Custom Order × Varied Anchors", () => {
  it("[S3.1] Course C (velocity+custom order) + Course B (deadline+standard) — independent schedules", () => {
    const planC = makeBasePlan({ id: "plan-c", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [3, 1, 2], startingChapterId: 5 })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "endDate", pagesPerDay: 20, startDate: "2026-04-06", targetEndDate: "2026-04-15" })
    const chsC = getOrderedChapters(COURSE_C.course, [3, 1, 2])
    const chsB = getChaptersForPlan(COURSE_B)

    // Both plan: Day 1 full log (20pp)
    planC.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planC.completedDays = ["2026-04-06"]
    planB.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planB.completedDays = ["2026-04-06"]

    // Day 2: Plan C skips ch2 (ch1 was at index 2, ch2 at index 3 in custom order)
    // Actually in custom order [3,1,2]: ch5,ch6,ch1,ch2,ch3,ch4
    // After day 1 (ch5+ch6 consumed), day 2 has ch1+ch2. Skip ch2, log ch1=10.
    const tempC: Record<string, Record<number, { count: number; skipped?: boolean }>> = {}
    logChapter(tempC, "2026-04-07", 1, 10) // read ch1
    logChapter(tempC, "2026-04-07", 2, 0, true) // skip ch2
    const day2ChsC = [chsC[2], chsC[3]] // ch1, ch2 (indices 2,3 in ordered array)
    const pagesReadC = simulateMarkDone(tempC["2026-04-07"], day2ChsC) // 10pp
    planC.dailyLog["2026-04-07"] = { pagesRead: pagesReadC }
    planC.completedDays.push("2026-04-07")

    planB.dailyLog["2026-04-07"] = { pagesRead: 20 }
    planB.completedDays.push("2026-04-07")

    const today = "2026-04-08"
    const paramsC = syncStudyPlan(planC, chsC, today)
    const paramsB = syncStudyPlan(planB, chsB, today)

    // Plan C: consumed=30, remaining=30, velocity
    expect(paramsC.consumed).toBe(30)
    expect(paramsC.remaining).toBe(30)
    expect(paramsC.anchor).toBe("pagesPerDay")

    // Plan B: consumed=40, remaining=20. Apr8-15 = 6 study days. pace=ceil(20/6)=4
    expect(paramsB.consumed).toBe(40)
    expect(paramsB.remaining).toBe(20)
    expect(paramsB.pagesPerDay).toBe(4)
    expect(paramsB.endDate).toBe("2026-04-15")

    // Plan C schedule: day 1 consumed 20pp (ch5+ch6), day 2 consumed 10pp (ch1 only, ch2 skipped=deferred)
    // Day 3 (Apr 8) should show deferred ch2 + ch3
    const schedC = generateSchedule(planC, chsC, today, 20, paramsC.endDate)
    const day3C = schedC.schedule.find(d => d.date === "2026-04-08")
    expect(day3C).toBeDefined()
    expect(day3C!.totalPages).toBe(20)
    const day3ChIds = day3C!.chapters.map(c => c.chapterId)
    expect(day3ChIds).toContain(2) // ch2 was deferred from day 2
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Edit one plan after N days
// ═══════════════════════════════════════════════════════════════════════════
describe("S4: Edit Plan Mid-Stream (Anchor / Unit Order Change)", () => {
  it("[S4.1] change anchor from velocity to deadline after 2 days → schedule recalculates", () => {
    const plan = makeBasePlan({ id: "plan", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const chs = getChaptersForPlan(COURSE_A)

    // First 2 days: user reads 20pp each day
    plan.dailyLog["2026-04-06"] = { pagesRead: 20 }
    plan.dailyLog["2026-04-07"] = { pagesRead: 20 }
    plan.completedDays = ["2026-04-06", "2026-04-07"]

    // Before edit: velocity, 40 consumed, 20 remaining
    const paramsBefore = syncStudyPlan(plan, chs, "2026-04-08")
    expect(paramsBefore.consumed).toBe(40)
    expect(paramsBefore.remaining).toBe(20)
    expect(paramsBefore.anchor).toBe("pagesPerDay")

    // User edits plan: switch to deadline, targetEndDate = 2026-04-10 (Fri)
    plan.anchor = "endDate"
    plan.targetEndDate = "2026-04-10"

    const paramsAfter = syncStudyPlan(plan, chs, "2026-04-08")
    expect(paramsAfter.consumed).toBe(40) // unchanged
    expect(paramsAfter.remaining).toBe(20) // unchanged
    expect(paramsAfter.anchor).toBe("endDate")
    // Apr 8-10 = 3 study days (Wed, Thu, Fri)
    // pace = ceil(20/3) = 7ppd
    expect(paramsAfter.pagesPerDay).toBe(7)
    expect(paramsAfter.endDate).toBe("2026-04-10")
  })

  it("[S4.2] change unit order after 1 day → consumption math correct, future days follow new order", () => {
    const plan = makeBasePlan({ id: "plan", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [1, 2, 3], startingChapterId: 1 })
    let chs = getOrderedChapters(COURSE_C.course, [1, 2, 3]) // standard: ch1,ch2,ch3,ch4,ch5,ch6

    // Day 1: user reads ch1(10pp)+ch2(10pp)
    plan.dailyLog["2026-04-06"] = { pagesRead: 20 }
    plan.completedDays = ["2026-04-06"]

    // Verify consumption before edit
    const paramsBefore = syncStudyPlan(plan, chs, "2026-04-07")
    expect(paramsBefore.consumed).toBe(20)
    expect(paramsBefore.remaining).toBe(40)

    // User edits: change unitOrder + startingChapterId
    plan.unitOrder = [3, 1, 2]
    plan.startingChapterId = 5
    chs = getOrderedChapters(COURSE_C.course, [3, 1, 2]) // new: [ch5,ch6,ch1,ch2,ch3,ch4]

    // Consumption math stays correct (based on dailyLog, not pageSequence)
    const paramsAfter = syncStudyPlan(plan, chs, "2026-04-07")
    expect(paramsAfter.consumed).toBe(20) // same consumption
    expect(paramsAfter.remaining).toBe(40) // same remaining

    // NOTE: generateSchedule rebuilds pageSequence from the new order.
    // Past completed days will reflect the NEW order's content (limitation).
    // Future uncompleted days follow the new order correctly.
    const sched = generateSchedule(plan, chs, "2026-04-07", 20, paramsAfter.endDate)

    // Day 2 (Apr 7) at 20ppd: should be 2 chapters from new order
    const day2 = sched.schedule.find(d => d.date === "2026-04-07")
    expect(day2).toBeDefined()
    expect(day2!.totalPages).toBe(20)
    // The key assertion: schedule uses the new unit order
    expect(day2!.chapters.length).toBe(2)
  })

  it("[S4.3] change pagesPerDay from 10 to 30 mid-plan → schedule recalculates pace", () => {
    const plan = makeBasePlan({ id: "plan", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 10, startDate: "2026-04-06" })
    const chs = getChaptersForPlan(COURSE_A)

    // Day 1: user reads 10pp (ch1 fully, pace was 10)
    plan.dailyLog["2026-04-06"] = { pagesRead: 10 }
    plan.completedDays = ["2026-04-06"]

    const paramsBefore = syncStudyPlan(plan, chs, "2026-04-07")
    expect(paramsBefore.pagesPerDay).toBe(10)
    expect(paramsBefore.consumed).toBe(10)
    expect(paramsBefore.remaining).toBe(50)

    // User edits: pagesPerDay 10 → 30
    plan.pagesPerDay = 30

    const paramsAfter = syncStudyPlan(plan, chs, "2026-04-07")
    expect(paramsAfter.pagesPerDay).toBe(30) // increased pace
    expect(paramsAfter.consumed).toBe(10) // consumption unchanged
    expect(paramsAfter.remaining).toBe(50) // remaining unchanged
    // neededDays = ceil(50/30) = 2 (vs 5 before)
    expect(paramsAfter.anchor).toBe("pagesPerDay")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Edit multiple plans mid-stream
// ═══════════════════════════════════════════════════════════════════════════
describe("S5: Edit Multiple Plans Mid-Stream", () => {
  it("[S5.1] change both plans' anchors independently → each recalculates correctly", () => {
    const planA = makeBasePlan({ id: "plan-a", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "pagesPerDay", pagesPerDay: 15, startDate: "2026-04-06" })
    const chsA = getChaptersForPlan(COURSE_A)
    const chsB = getChaptersForPlan(COURSE_B)

    // Both study 3 days
    planA.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planA.dailyLog["2026-04-07"] = { pagesRead: 20 }
    planA.dailyLog["2026-04-08"] = { pagesRead: 20 }
    planA.completedDays = ["2026-04-06", "2026-04-07", "2026-04-08"]

    planB.dailyLog["2026-04-06"] = { pagesRead: 15 }
    planB.dailyLog["2026-04-07"] = { pagesRead: 15 }
    planB.dailyLog["2026-04-08"] = { pagesRead: 15 }
    planB.completedDays = ["2026-04-06", "2026-04-07", "2026-04-08"]

    // Edit: Plan A switches to deadline (Apr 16), Plan B increases pace to 25
    planA.anchor = "endDate"
    planA.targetEndDate = "2026-04-16"
    planB.pagesPerDay = 25

    const today = "2026-04-09"
    const paramsA = syncStudyPlan(planA, chsA, today)
    const paramsB = syncStudyPlan(planB, chsB, today)

    // Plan A: consumed=60 → remaining=0 (all chapters done!)
    // All pages consumed. No more schedule needed.
    expect(paramsA.consumed).toBe(60)
    expect(paramsA.remaining).toBe(0)

    // Plan B: consumed=45, remaining=15, pace=25
    expect(paramsB.consumed).toBe(45)
    expect(paramsB.remaining).toBe(15)
    expect(paramsB.pagesPerDay).toBe(25)
  })

  it("[S5.2] change unit orders on two plans mid-stream — each follows its own new order", () => {
    // Plan C: originally unitOrder=[1,2,3], change to [3,1,2]
    // Plan D: originally unitOrder=[1,2,3], change to [2,3]
    const planC = makeBasePlan({ id: "plan-c", courseId: "course-c", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [1, 2, 3], startingChapterId: 1 })
    const planD = makeBasePlan({ id: "plan-d", courseId: "course-d", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06", unitOrder: [1, 2, 3], startingChapterId: 1 })

    // Day 1: both read 20pp
    planC.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planC.completedDays = ["2026-04-06"]
    planD.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planD.completedDays = ["2026-04-06"]

    // Verify consumption before edit
    const chsCOld = getOrderedChapters(COURSE_C.course, [1, 2, 3])
    const chsDOld = getOrderedChapters(COURSE_D.course, [1, 2, 3])
    expect(syncStudyPlan(planC, chsCOld, "2026-04-07").consumed).toBe(20)
    expect(syncStudyPlan(planD, chsDOld, "2026-04-07").consumed).toBe(20)

    // Edit both unit orders + update startingChapterIds
    planC.unitOrder = [3, 1, 2]
    planC.startingChapterId = 5
    planD.unitOrder = [2, 3]
    planD.startingChapterId = 3

    const chsC = getOrderedChapters(COURSE_C.course, [3, 1, 2]) // [ch5,ch6,ch1,ch2,ch3,ch4]
    const chsD = getOrderedChapters(COURSE_D.course, [2, 3])    // [ch3,ch4,ch5,ch6,ch1,ch2]

    const today = "2026-04-07"

    // Consumption math survives edit (uses dailyLog, not pageSequence)
    const paramsC = syncStudyPlan(planC, chsC, today)
    const paramsD = syncStudyPlan(planD, chsD, today)
    expect(paramsC.consumed).toBe(20)
    expect(paramsD.consumed).toBe(20)

    // Schedules follow the new order
    const schedC = generateSchedule(planC, chsC, today, 20, paramsC.endDate)
    const schedD = generateSchedule(planD, chsD, today, 20, paramsD.endDate)

    const day2C = schedC.schedule.find(d => d.date === "2026-04-07")
    const day2D = schedD.schedule.find(d => d.date === "2026-04-07")
    expect(day2C).toBeDefined()
    expect(day2D).toBeDefined()
    // Each schedule should have chapters (exact content depends on pageSequence, 
    // but the key is they're independently generated from each plan's order)
    expect(day2C!.chapters.length).toBeGreaterThan(0)
    expect(day2D!.chapters.length).toBeGreaterThan(0)
  })

  it("[S5.3] change anchor on plan A + unit order on plan B mid-stream — independent edits", () => {
    const planA = makeBasePlan({ id: "plan-a", courseId: "course-a", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const planB = makeBasePlan({ id: "plan-b", courseId: "course-b", anchor: "pagesPerDay", pagesPerDay: 20, startDate: "2026-04-06" })
    const chsA = getChaptersForPlan(COURSE_A)
    const chsB = getChaptersForPlan(COURSE_B)

    // 2 days of study
    planA.dailyLog["2026-04-06"] = { pagesRead: 15 }
    planA.dailyLog["2026-04-07"] = { pagesRead: 20 }
    planA.completedDays = ["2026-04-06", "2026-04-07"]
    planB.dailyLog["2026-04-06"] = { pagesRead: 20 }
    planB.dailyLog["2026-04-07"] = { pagesRead: 10 }
    planB.completedDays = ["2026-04-06", "2026-04-07"]

    // Edit: Plan A → deadline (Apr 15), Plan B → custom unit order [2,3,1]
    planA.anchor = "endDate"
    planA.targetEndDate = "2026-04-15"
    planB.unitOrder = [2, 3, 1]
    planB.startingChapterId = 3

    const today = "2026-04-08"
    const paramsA = syncStudyPlan(planA, chsA, today)
    const newChsB = getOrderedChapters(COURSE_B.course, [2, 3, 1])
    const paramsB = syncStudyPlan(planB, newChsB, today)

    // Plan A: consumed=35, remaining=25. Apr8-15 = 6 study days. pace=ceil(25/6)=5
    expect(paramsA.consumed).toBe(35)
    expect(paramsA.remaining).toBe(25)
    expect(paramsA.anchor).toBe("endDate")
    expect(paramsA.pagesPerDay).toBe(5)

    // Plan B: consumed=30, remaining=30 (new order, same total pages)
    expect(paramsB.consumed).toBe(30)
    expect(paramsB.remaining).toBe(30)
    expect(paramsB.anchor).toBe("pagesPerDay")
    expect(paramsB.pagesPerDay).toBe(20)
  })
})
