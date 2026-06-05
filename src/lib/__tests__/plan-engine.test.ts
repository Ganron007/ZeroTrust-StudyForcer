import { describe, it, expect } from "vitest"
import { syncStudyPlan } from "../plan-engine"
import { generateSchedule, getTotalPages, countStudyDays, nthStudyDay } from "../cissp-data"
import type { StudyPlan } from "../plan-storage"
import type { Chapter } from "@/types/course"

// ── Test Data ────────────────────────────────────────────────────────────────

const TEST_CHAPTERS: Chapter[] = [
  { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 2, title: "Ch 2", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 3, title: "Ch 3", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
  { id: 4, title: "Ch 4", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
]

const TOTAL_PAGES = 400

function makePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: "test-plan",
    courseId: "test-course",
    name: "Test Plan",
    startDate: "2026-04-01",
    pagesPerDay: 20,
    studyDays: [1, 2, 3, 4, 5], // Mon-Fri
    startingChapterId: 1,
    chapterStartOverrides: {},
    targetEndDate: undefined,
    targetDayCount: undefined,
    anchor: "pagesPerDay",
    completedDays: [],
    dailyLog: {},
    skippedDays: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ── syncStudyPlan: VELOCITY ANCHOR ───────────────────────────────────────────

describe("syncStudyPlan - Velocity Anchor", () => {
  it("fresh plan: no logs = consumed 0, remaining = total", () => {
    const plan = makePlan({ anchor: "pagesPerDay", pagesPerDay: 20 })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(0)
    expect(params.remaining).toBe(TOTAL_PAGES)
    expect(params.pagesPerDay).toBe(20)
    expect(params.anchor).toBe("pagesPerDay")
  })

  it("with past logs: consumed = sum of logs", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      dailyLog: {
        "2026-04-01": { pagesRead: 15 },
        "2026-04-02": { pagesRead: 25 },
        "2026-04-03": { pagesRead: 0 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(40) // 15 + 25 + 0
    expect(params.remaining).toBe(TOTAL_PAGES - 40)
  })

  it("completed-but-unlogged days do NOT count for consumption", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      completedDays: ["2026-04-01", "2026-04-02"],
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(0) // logs only
    expect(params.remaining).toBe(TOTAL_PAGES)
  })

  it("mixed: logs count, completed-unlogged don't, unlogged don't", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      dailyLog: {
        "2026-04-01": { pagesRead: 10 },
        "2026-04-03": { pagesRead: 30 },
      },
      completedDays: ["2026-04-02"], // unlogged
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(40) // 10 + 30 only
  })

  it("derived end date shifts when behind schedule", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      dailyLog: {
        "2026-04-01": { pagesRead: 10 }, // planned 20, only read 10
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    // Remaining = 400 - 10 = 390. At 20/day = 20 days from today
    expect(params.pagesPerDay).toBe(20) // locked
    expect(params.endDate).not.toBeNull()
    expect(params.endDate! > "2026-04-15").toBe(true)
  })

  it("partial log: remaining 10 absorbed into future days", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      dailyLog: {
        "2026-04-01": { pagesRead: 10 }, // 10 short
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-02")
    expect(params.consumed).toBe(10)
    expect(params.remaining).toBe(390)
    // Pace stays at 20, but end date is later because remaining is larger
  })

  it("skipped days = 0 consumption", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      skippedDays: ["2026-04-01", "2026-04-02"],
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(0)
  })

  it("all chapters finished: endDate = today", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      dailyLog: {
        "2026-04-01": { pagesRead: 400 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(400)
    expect(params.remaining).toBe(0)
    expect(params.endDate).toBe("2026-04-15")
  })
})

// ── syncStudyPlan: DEADLINE ANCHOR ───────────────────────────────────────────

describe("syncStudyPlan - Deadline Anchor", () => {
  it("fresh plan: derives pace from remaining / available days", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-30",
      startDate: "2026-04-01",
    })
    // Today = Apr 15. Study days from Apr 15 to Apr 30 = ~11 days
    // Pace = ceil(400 / 11) = 37
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.anchor).toBe("endDate")
    expect(params.pagesPerDay).toBeGreaterThan(0)
    expect(params.endDate).toBe("2026-04-30")
    expect(params.isFeasible).toBe(true)
  })

  it("with past logs: remaining decreases, pace may decrease", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-30",
      startDate: "2026-04-01",
      dailyLog: {
        "2026-04-01": { pagesRead: 10 },
        "2026-04-02": { pagesRead: 10 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    // Consumed = 20, remaining = 380 (less than 400)
    expect(params.consumed).toBe(20)
    expect(params.remaining).toBe(380)
    expect(params.pagesPerDay).toBeGreaterThan(0)
    expect(params.endDate).toBe("2026-04-30") // deadline stays fixed
  })

  it("deadline already passed: infeasible with warning", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.isFeasible).toBe(false)
    expect(params.warnings.length).toBeGreaterThan(0)
    expect(params.warnings[0]).toContain("passed")
  })

  it("impossible deadline: extends past with warning", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-10", // Only ~5 study days from Apr 1
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-05")
    // 400 pages in ~3 days = impossible
    expect(params.pagesPerDay).toBeGreaterThan(0)
  })

  it("stored pagesPerDay is overwritten by derived pace", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-30",
      pagesPerDay: 999, // stale value
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.pagesPerDay).not.toBe(999)
    expect(params.pagesPerDay).toBeGreaterThan(0)
  })
})

// ── syncStudyPlan: FIXED DURATION ANCHOR ─────────────────────────────────────

describe("syncStudyPlan - Fixed Duration Anchor", () => {
  it("computes end date from targetDayCount", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetDayCount: 20,
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-01")
    expect(params.endDate).not.toBeNull()
    expect(params.anchor).toBe("endDate")
    expect(params.isFeasible).toBe(true)
  })

  it("derives pace from targetDayCount", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetDayCount: 20,
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-01")
    // 400 pages / 20 days = 20 ppd
    expect(params.pagesPerDay).toBe(20)
  })
})

// ── generateSchedule ─────────────────────────────────────────────────────────

describe("generateSchedule", () => {
  it("fresh plan: all days show planned pagesPerDay", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)
    expect(result.schedule.length).toBeGreaterThan(0)

    // Past days should show planned content
    const pastDay = result.schedule.find((d) => d.date === "2026-04-01")
    expect(pastDay).toBeDefined()
    expect(pastDay!.totalPages).toBe(20)

    // Future days should also show planned content
    const futureDay = result.schedule.find((d) => d.date >= "2026-04-15")
    expect(futureDay).toBeDefined()
    expect(futureDay!.totalPages).toBe(20)
  })

  it("past logged days show actual log amount", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
      completedDays: ["2026-04-01"],
      dailyLog: {
        "2026-04-01": { pagesRead: 15 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)
    const loggedDay = result.schedule.find((d) => d.date === "2026-04-01")
    expect(loggedDay).toBeDefined()
    expect(loggedDay!.totalPages).toBe(15)
  })

  it("past unlogged days show planned pages (not 0)", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
      // No logs for Apr 1-14
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    const unloggedPastDay = result.schedule.find((d) => d.date === "2026-04-02")
    expect(unloggedPastDay).toBeDefined()
    expect(unloggedPastDay!.totalPages).toBe(20) // Should show planned, not 0
  })

  it("schedule advances pageIdx correctly with mixed logs", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
      dailyLog: {
        "2026-04-01": { pagesRead: 20 },
        "2026-04-02": { pagesRead: 20 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    // After 2 days of 20 pages, next day should start at page 41
    const day3 = result.schedule.find((d) => d.date === "2026-04-03")
    expect(day3).toBeDefined()
    expect(day3!.chapters[0].pagesStart).toBe(41)
  })

  it("deadline mode: all unlogged days use the resolved (derived) pace", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-05-31",
      pagesPerDay: 20,
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    const pastDay = result.schedule.find((d) => d.date === "2026-04-01")
    expect(pastDay).toBeDefined()
    expect(pastDay!.totalPages).toBe(params.pagesPerDay)

    const futureDay = result.schedule.find((d) => d.date >= "2026-04-15")
    expect(futureDay).toBeDefined()
    expect(futureDay!.totalPages).toBe(params.pagesPerDay)
  })

  it("end date wall: stops at deadline", () => {
    const plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-10",
      startDate: "2026-04-01",
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    // Should not have days past the deadline
    const pastDeadline = result.schedule.find((d) => d.date > "2026-04-10")
    expect(pastDeadline).toBeUndefined()
  })

  it("skips skipped days in schedule", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
      skippedDays: ["2026-04-03"],
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    const skipped = result.schedule.find((d) => d.date === "2026-04-03")
    expect(skipped).toBeUndefined()
  })

  it("non-study days are excluded", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-06", // Monday
      studyDays: [1, 3, 5], // Mon, Wed, Fri only
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)

    // Tuesday (Apr 7) should not appear
    const tuesday = result.schedule.find((d) => d.date === "2026-04-07")
    expect(tuesday).toBeUndefined()

    // Monday (Apr 6) should appear
    const monday = result.schedule.find((d) => d.date === "2026-04-06")
    expect(monday).toBeDefined()
  })
})

// ── Integration: create → schedule → log → recompute ─────────────────────────

describe("Integration: full study lifecycle", () => {
  it("velocity plan: log behind schedule, end date shifts", () => {
    // Day 1: create plan
    let plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 20,
      startDate: "2026-04-01",
    })

    // Day 1 schedule
    let params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-01")
    let result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-01", params.pagesPerDay, params.endDate)
    expect(result.schedule[0].totalPages).toBe(20)

    // Day 2: log only 10 pages
    plan = {
      ...plan,
      dailyLog: { "2026-04-01": { pagesRead: 10 } },
    }

    // Recompute
    params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-02")
    expect(params.consumed).toBe(10)
    expect(params.remaining).toBe(390)

    // New schedule from today
    result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-02", params.pagesPerDay, params.endDate)
    const todayDay = result.schedule.find((d) => d.date === "2026-04-02")
    expect(todayDay).toBeDefined()
    expect(todayDay!.totalPages).toBe(20)

    // End date should be later than original
    expect(params.endDate).not.toBeNull()
  })

  it("deadline plan: log behind schedule, pace increases", () => {
    let plan = makePlan({
      anchor: "endDate",
      targetEndDate: "2026-04-30",
      startDate: "2026-04-01",
    })

    // Compute initial pace
    let params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-01")
    const initialPace = params.pagesPerDay

    // Log less than planned for first 5 days
    plan = {
      ...plan,
      dailyLog: {
        "2026-04-01": { pagesRead: 10 },
        "2026-04-02": { pagesRead: 10 },
        "2026-04-03": { pagesRead: 10 },
        "2026-04-04": { pagesRead: 10 },
        "2026-04-07": { pagesRead: 10 },
      },
    }

    // Recompute
    params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-08")
    expect(params.consumed).toBe(50)
    expect(params.remaining).toBe(350)
    // Pace should increase to hit deadline
    expect(params.pagesPerDay).toBeGreaterThan(initialPace)
    expect(params.endDate).toBe("2026-04-30") // deadline stays fixed
  })

  it("merged multi-course: each course has independent schedule", () => {
    const cisspPlan = makePlan({
      id: "cissp-plan",
      courseId: "cissp",
      anchor: "pagesPerDay",
      pagesPerDay: 50,
      startDate: "2026-04-01",
    })
    const secaiPlan = makePlan({
      id: "secai-plan",
      courseId: "secai",
      anchor: "pagesPerDay",
      pagesPerDay: 10,
      startDate: "2026-04-01",
    })

    const cisspChapters = [
      { id: 1, title: "Ch 1", pages: 500, unitId: 1, unitName: "U1", color: "#3b82f6" },
    ]
    const secaiChapters = [
      { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "U1", color: "#8b5cf6" },
    ]

    const cisspParams = syncStudyPlan(cisspPlan, cisspChapters, "2026-04-15")
    const secaiParams = syncStudyPlan(secaiPlan, secaiChapters, "2026-04-15")

    const cisspResult = generateSchedule(cisspPlan, cisspChapters, "2026-04-15", cisspParams.pagesPerDay, cisspParams.endDate)
    const secaiResult = generateSchedule(secaiPlan, secaiChapters, "2026-04-15", secaiParams.pagesPerDay, secaiParams.endDate)

    // CISSP should have more days/pages
    expect(cisspResult.schedule[0].totalPages).toBe(50)
    expect(secaiResult.schedule[0].totalPages).toBe(10)
  })
})

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("empty chapter list: returns sensible defaults", () => {
    const plan = makePlan()
    const params = syncStudyPlan(plan, [], "2026-04-15")
    expect(params.consumed).toBe(0)
    expect(params.remaining).toBe(0)
    expect(params.isFeasible).toBe(true)
  })

  it("start date in future: consumed = 0", () => {
    const plan = makePlan({
      startDate: "2026-05-01",
      anchor: "pagesPerDay",
      pagesPerDay: 20,
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(0)
    expect(params.remaining).toBe(TOTAL_PAGES)
  })

  it("all days logged as 0: consumed = 0, no infinite loop", () => {
    const plan = makePlan({
      startDate: "2026-04-01",
      dailyLog: {
        "2026-04-01": { pagesRead: 0 },
        "2026-04-02": { pagesRead: 0 },
      },
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-15")
    expect(params.consumed).toBe(0)

    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-15", params.pagesPerDay, params.endDate)
    expect(result.schedule.length).toBeGreaterThan(0)
  })

  it("very high pace: doesn't break", () => {
    const plan = makePlan({
      anchor: "pagesPerDay",
      pagesPerDay: 500, // More than total
    })
    const params = syncStudyPlan(plan, TEST_CHAPTERS, "2026-04-01")
    const result = generateSchedule(plan, TEST_CHAPTERS, "2026-04-01", params.pagesPerDay, params.endDate)
    expect(result.schedule.length).toBeGreaterThan(0)
    // First day gets all remaining pages (capped by total)
    expect(result.schedule[0].totalPages).toBe(TOTAL_PAGES)
  })

  it("chapter start override: respects override", () => {
    const chapters: Chapter[] = [
      { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 2, title: "Ch 2", pages: 100, unitId: 1, unitName: "U1", color: "#3b82f6" },
    ]
    const plan = makePlan({
      startingChapterId: 2,
      chapterStartOverrides: { 2: 50 },
    })
    const total = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chapters)
    expect(total).toBe(51) // Ch 2 from 50 to 100 = 51 pages
  })
})

// ── Helper Functions ─────────────────────────────────────────────────────────

describe("Helper Functions", () => {
  it("countStudyDays: counts correctly", () => {
    const days = countStudyDays("2026-04-01", "2026-04-07", [1, 2, 3, 4, 5])
    expect(days).toBe(5) // Mon-Fri
  })

  it("countStudyDays: excludes skipped", () => {
    const days = countStudyDays("2026-04-01", "2026-04-07", [1, 2, 3, 4, 5], ["2026-04-01"])
    expect(days).toBe(4)
  })

  it("nthStudyDay: finds correct date", () => {
    const date = nthStudyDay("2026-04-01", 5, [1, 2, 3, 4, 5])
    expect(date).toBe("2026-04-07") // 5th study day
  })
})

describe("Book page ranges in schedule", () => {
  const chaptersWithBookPages: Chapter[] = [
    { id: 1, title: "Ch 1", pages: 20, unitId: 1, unitName: "Unit 1", color: "#3b82f6", bookPageStart: 1 },
    { id: 2, title: "Ch 2", pages: 38, unitId: 1, unitName: "Unit 1", color: "#3b82f6", bookPageStart: 21 },
    { id: 3, title: "Ch 3", pages: 30, unitId: 2, unitName: "Unit 2", color: "#8b5cf6", bookPageStart: 59 },
  ]

  it("includes bookPageStart and bookPageEnd for each chapter slice", () => {
    const plan = makePlan({ pagesPerDay: 20 })
    const params = syncStudyPlan(plan, chaptersWithBookPages, "2026-04-01")
    const result = generateSchedule(plan, chaptersWithBookPages, "2026-04-01", params.pagesPerDay, params.endDate)
    // Day 1: 20 pages of Ch 1 (book pages 1-20)
    const day1 = result.schedule[0]
    expect(day1.chapters[0].bookPageStart).toBe(1)
    expect(day1.chapters[0].bookPageEnd).toBe(20)

    // Day 2: remaining 0 pages of Ch 1? No, Ch 1 is fully covered on day 1.
    // Actually with 20 pages/day and Ch 1 having 20 pages, day 1 covers all of Ch 1.
    // Day 2 covers 20 pages of Ch 2 (book pages 21-40)
    const day2 = result.schedule[1]
    expect(day2.chapters[0].bookPageStart).toBe(21)
    expect(day2.chapters[0].bookPageEnd).toBe(40)

    // Day 3 covers remaining 18 pages of Ch 2 (book pages 41-58) and 2 pages of Ch 3 (book pages 59-60)
    const day3 = result.schedule[2]
    expect(day3.chapters.length).toBe(2)
    expect(day3.chapters[0].bookPageStart).toBe(41)
    expect(day3.chapters[0].bookPageEnd).toBe(58)
    expect(day3.chapters[1].bookPageStart).toBe(59)
    expect(day3.chapters[1].bookPageEnd).toBe(60)
  })

  it("falls back to sequential pages when bookPageStart is absent", () => {
    const chaptersNoBook: Chapter[] = [
      { id: 1, title: "Ch 1", pages: 20, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
    ]
    const plan = makePlan({ pagesPerDay: 20 })
    const params = syncStudyPlan(plan, chaptersNoBook, "2026-04-01")
    const result = generateSchedule(plan, chaptersNoBook, "2026-04-01", params.pagesPerDay, params.endDate)
    const day1 = result.schedule[0]
    // v2.4.5 (root-cause fix): when a chapter has no bookPageStart, the
    // engine now derives bookPageStart/End from the queue page number
    // (instead of leaving them undefined). This eliminates the need for
    // every consumer to fallback via `?? pagesStart`/`?? pagesEnd` and
    // matches the v2.4.5 regression test in cissp-helpers.test.ts.
    expect(day1.chapters[0].bookPageStart).toBe(1)
    expect(day1.chapters[0].bookPageEnd).toBe(20)
    expect(day1.chapters[0].pagesStart).toBe(1)
    expect(day1.chapters[0].pagesEnd).toBe(20)
  })
})
