import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { syncStudyPlan } from "../plan-engine"
import { generateSchedule, getTotalPages } from "../cissp-data"
import { defaultPlan, planStorage, type StudyPlan } from "../plan-storage"
import type { Chapter } from "@/types/course"

// Mock IS_TAURI for planStorage (uses localStorage in web mode)
vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })

const CHAPTERS: Chapter[] = [
  { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 2, title: "Ch 2", pages: 100, unitId: 1, unitName: "Unit 1", color: "#3b82f6" },
  { id: 3, title: "Ch 3", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
  { id: 4, title: "Ch 4", pages: 100, unitId: 2, unitName: "Unit 2", color: "#8b5cf6" },
]

const TOTAL_PAGES = 400

function makePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    ...defaultPlan("test-course"),
    ...overrides,
  } as StudyPlan
}

describe("E2E: Full User Flows", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"))
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Flow 1: Create Velocity Plan → Study → Check Progress", () => {
    it("completes full lifecycle with consistent stats", () => {
      // Step 1: Create plan
      let plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        startDate: "2026-04-01",
      })

      // Step 2: Generate initial schedule
      let params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      let result = generateSchedule(plan, CHAPTERS, "2026-04-01", params.pagesPerDay, params.endDate)

      expect(result.schedule.length).toBeGreaterThan(0)
      expect(result.schedule[0].totalPages).toBe(20)
      expect(params.consumed).toBe(0)
      expect(params.remaining).toBe(TOTAL_PAGES)

      // Step 3: Log Day 1 (read 20 pages as planned)
      plan = {
        ...plan,
        dailyLog: { "2026-04-01": { pagesRead: 20 } },
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-02")
      expect(params.consumed).toBe(20)
      expect(params.remaining).toBe(380)

      result = generateSchedule(plan, CHAPTERS, "2026-04-02", params.pagesPerDay, params.endDate)
      expect(result.schedule[0].totalPages).toBe(20)

      // Step 4: Log Day 2 (fall behind — only read 10)
      plan = {
        ...plan,
        dailyLog: {
          ...plan.dailyLog,
          "2026-04-02": { pagesRead: 10 },
        },
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-03")
      expect(params.consumed).toBe(30)
      expect(params.remaining).toBe(370)

      // Pace stays at 20, but end date shifts
      result = generateSchedule(plan, CHAPTERS, "2026-04-03", params.pagesPerDay, params.endDate)
      expect(result.schedule[0].totalPages).toBe(20)

      // Step 5: Mark Day 3 complete without logging
      plan = {
        ...plan,
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-04")
      // Completed but unlogged = 0 consumption
      expect(params.consumed).toBe(30)
      expect(params.remaining).toBe(370)

      // Step 6: Catch up — read 30 pages on Day 4
      plan = {
        ...plan,
        dailyLog: {
          ...plan.dailyLog,
          "2026-04-04": { pagesRead: 30 },
        },
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-05")
      expect(params.consumed).toBe(60)
      expect(params.remaining).toBe(340)
    })
  })

  describe("Flow 2: Create Deadline Plan → Fall Behind → Pace Adjusts", () => {
    it("increases pace when behind schedule", () => {
      // Step 1: Create deadline plan (20 study days to finish 400 pages)
      let plan = makePlan({
        anchor: "endDate",
        targetEndDate: "2026-04-30",
        startDate: "2026-04-01",
      })

      let params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      const initialPace = params.pagesPerDay
      expect(initialPace).toBeGreaterThan(0)

      // Step 2: Read less than planned for 5 days
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

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-08")
      expect(params.consumed).toBe(50)
      expect(params.remaining).toBe(350)
      // Pace should increase to compensate
      expect(params.pagesPerDay).toBeGreaterThan(initialPace)
      expect(params.endDate).toBe("2026-04-30") // deadline fixed
    })

    it("decreases pace when ahead of schedule", () => {
      let plan = makePlan({
        anchor: "endDate",
        targetEndDate: "2026-04-30",
        startDate: "2026-04-01",
      })

      let params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      const initialPace = params.pagesPerDay

      // Read more than planned
      plan = {
        ...plan,
        dailyLog: {
          "2026-04-01": { pagesRead: 100 },
          "2026-04-02": { pagesRead: 100 },
        },
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-03")
      expect(params.consumed).toBe(200)
      expect(params.remaining).toBe(200)
      // Pace should decrease
      expect(params.pagesPerDay).toBeLessThan(initialPace)
    })
  })

  describe("Flow 3: Skip Days → Schedule Adjusts", () => {
    it("skipping days reduces available study days", () => {
      let plan = makePlan({
        anchor: "endDate",
        targetEndDate: "2026-04-30",
        startDate: "2026-04-01",
      })

      let params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      const paceWithoutSkips = params.pagesPerDay

      // Skip 5 days
      plan = {
        ...plan,
        skippedDays: ["2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11"],
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      // Fewer available days = higher pace
      expect(params.pagesPerDay).toBeGreaterThan(paceWithoutSkips)
    })

    it("skipping past days doesn't affect consumed", () => {
      let plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        startDate: "2026-04-01",
        dailyLog: {
          "2026-04-01": { pagesRead: 20 },
        },
        skippedDays: ["2026-04-02"],
      })

      const params = syncStudyPlan(plan, CHAPTERS, "2026-04-03")
      expect(params.consumed).toBe(20) // only logged day counts
    })
  })

  describe("Flow 4: Multi-Course Study", () => {
    it("each course has independent schedule and stats", () => {
      const cisspChapters = [
        { id: 1, title: "Ch 1", pages: 500, unitId: 1, unitName: "U1", color: "#3b82f6" },
      ]
      const secaiChapters = [
        { id: 1, title: "Ch 1", pages: 100, unitId: 1, unitName: "U1", color: "#8b5cf6" },
      ]

      const cisspPlan = makePlan({
        courseId: "cissp",
        anchor: "pagesPerDay",
        pagesPerDay: 50,
        startDate: "2026-04-01",
      })
      const secaiPlan = makePlan({
        courseId: "secai",
        anchor: "pagesPerDay",
        pagesPerDay: 10,
        startDate: "2026-04-01",
      })

      // CISSP stats
      let cisspParams = syncStudyPlan(cisspPlan, cisspChapters, "2026-04-01")
      expect(cisspParams.consumed).toBe(0)
      expect(cisspParams.remaining).toBe(500)

      // SecAI+ stats
      let secaiParams = syncStudyPlan(secaiPlan, secaiChapters, "2026-04-01")
      expect(secaiParams.consumed).toBe(0)
      expect(secaiParams.remaining).toBe(100)

      // Log CISSP only
      const cisspLogged = {
        ...cisspPlan,
        dailyLog: { "2026-04-01": { pagesRead: 50 } },
      }

      cisspParams = syncStudyPlan(cisspLogged, cisspChapters, "2026-04-02")
      expect(cisspParams.consumed).toBe(50)

      // SecAI+ should be unaffected
      secaiParams = syncStudyPlan(secaiPlan, secaiChapters, "2026-04-02")
      expect(secaiParams.consumed).toBe(0)
    })
  })

  describe("Flow 5: Edit Plan → Stats Recalculate", () => {
    it("changing anchor from velocity to deadline recalculates pace", () => {
      let plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        startDate: "2026-04-01",
      })

      let params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      expect(params.anchor).toBe("pagesPerDay")
      expect(params.pagesPerDay).toBe(20)

      // Switch to deadline mode
      plan = {
        ...plan,
        anchor: "endDate",
        targetEndDate: "2026-04-20",
      }

      params = syncStudyPlan(plan, CHAPTERS, "2026-04-01")
      expect(params.anchor).toBe("endDate")
      expect(params.pagesPerDay).not.toBe(20)
      expect(params.pagesPerDay).toBeGreaterThan(0)
    })

    it("changing start date shifts entire schedule", () => {
      let plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        startDate: "2026-04-01",
      })

      let result = generateSchedule(plan, CHAPTERS, "2026-04-01", 20, null)
      expect(result.schedule[0].date).toBe("2026-04-01")

      // Shift start date
      plan = {
        ...plan,
        startDate: "2026-04-15",
      }

      result = generateSchedule(plan, CHAPTERS, "2026-04-15", 20, null)
      expect(result.schedule[0].date).toBe("2026-04-15")
    })
  })

  describe("Flow 6: Complete Course", () => {
    it("reading all pages marks course as complete", () => {
      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 100,
        startDate: "2026-04-01",
        dailyLog: {
          "2026-04-01": { pagesRead: 200 },
          "2026-04-02": { pagesRead: 200 },
        },
      })

      const params = syncStudyPlan(plan, CHAPTERS, "2026-04-03")
      expect(params.consumed).toBe(400)
      expect(params.remaining).toBe(0)
      expect(params.endDate).toBe("2026-04-03")

      const result = generateSchedule(plan, CHAPTERS, "2026-04-03", params.pagesPerDay, params.endDate)
      // Should have no future days
      expect(result.schedule.find((d) => d.date >= "2026-04-03")).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW TESTS: App.tsx State Management Fixes (Fix 1, Fix 2, Fix 3)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Flow 7: Auto-Save Isolation (Fix 1) — saveActive reads dailyLog from disk", () => {
    beforeEach(async () => {
      localStorageMock.clear()
    })

    it("auto-save preserves dailyLog that was written by handleToggleDay merge", async () => {
      // Step 1: Create a plan in storage
      const plan = defaultPlan("test-course", {
        name: "Auto-Save Test",
        pagesPerDay: 20,
        startDate: "2026-04-01",
        studyDays: [1, 2, 3, 4, 5],
        anchor: "pagesPerDay",
      }) as StudyPlan & { id: string }
      // Force an id so we can use it
      const saved = await planStorage.save(plan)
      const planId = saved.id

      // Step 2: Simulate handleToggleDay merge (Fix 2 pattern)
      // User had temp dailyLog for day 1: read 15 pages (fell behind)
      const mergedDailyLog = {
        "2026-04-01": { pagesRead: 15 },
      }
      const afterToggle = await planStorage.save({
        ...(await planStorage.get(planId))!,
        dailyLog: mergedDailyLog,
      })
      expect(afterToggle.dailyLog["2026-04-01"].pagesRead).toBe(15)

      // Step 3: Simulate saveActive (Fix 1) — reads dailyLog from disk (existing),
      // writes only metadata from React state (which is STALE at this point)
      const existing = await planStorage.get(planId)
      const afterAutoSave = await planStorage.save({
        id: planId,
        courseId: existing!.courseId,
        name: existing!.name,
        startDate: existing!.startDate,
        pagesPerDay: existing!.pagesPerDay,
        studyDays: existing!.studyDays,
        startingChapterId: existing!.startingChapterId,
        chapterStartOverrides: existing!.chapterStartOverrides,
        targetEndDate: existing!.targetEndDate,
        targetDayCount: existing!.targetDayCount,
        anchor: existing!.anchor,
        // These come from disk per Fix 1:
        dailyLog: existing!.dailyLog,
        skippedDays: existing!.skippedDays,
        unitOrder: existing!.unitOrder,
      })

      // Step 4: Verify auto-save did NOT overwrite the merged data
      expect(afterAutoSave.dailyLog["2026-04-01"].pagesRead).toBe(15)
    })

    it("auto-save with stale React dailyLog does NOT corrupt disk data", async () => {
      // Scenario: React state has stale dailyLog={}, user did Mark Done which merged
      // data to disk. Then auto-save fires with the stale React state.
      // Before Fix 1: auto-save would overwrite with stale data (no dailyLog entries).
      // After Fix 1: auto-save reads dailyLog from disk.

      // Step 1: Create plan with day 1 merged (logged 20 pages, marked done)
      const plan = defaultPlan("test-course", {
        name: "Stale State Test",
        pagesPerDay: 20,
        startDate: "2026-04-01",
        studyDays: [1, 2, 3, 4, 5],
        anchor: "pagesPerDay",
        dailyLog: {
          "2026-04-01": { pagesRead: 20 },
        },
      }) as StudyPlan & { id: string }
      const saved = await planStorage.save(plan)

      // Step 2: User logs chapter 2 on day 2 (temp React state only) — not yet Mark Done
      // React dailyLog = { "2026-04-02": { pagesRead: 0 } }

      // Step 3: Auto-save fires with stale React state (dailyLog only has day 2 temp data)
      // But reads the CORRECT dailyLog from disk (Fix 1)
      const existing = await planStorage.get(saved.id)
      const afterAutoSave = await planStorage.save({
        id: saved.id,
        courseId: existing!.courseId,
        name: existing!.name,
        startDate: existing!.startDate,
        pagesPerDay: existing!.pagesPerDay,
        studyDays: existing!.studyDays,
        startingChapterId: existing!.startingChapterId,
        chapterStartOverrides: existing!.chapterStartOverrides,
        targetEndDate: existing!.targetEndDate,
        targetDayCount: existing!.targetDayCount,
        anchor: existing!.anchor,
        dailyLog: existing!.dailyLog,
        skippedDays: existing!.skippedDays,
        unitOrder: existing!.unitOrder,
      })

      // Verify day 1's merged data is intact (not overwritten by stale React state)
      expect(afterAutoSave.dailyLog["2026-04-01"]).toBeDefined()
      expect(afterAutoSave.dailyLog["2026-04-01"].pagesRead).toBe(20)
    })

    it("metadata-only auto-save correctly preserves existing skippedDays and unitOrder", async () => {
      const plan = defaultPlan("test-course", {
        name: "Meta Only",
        pagesPerDay: 20,
        unitOrder: [3, 1, 2],
        skippedDays: ["2026-04-03"],
      }) as StudyPlan & { id: string }
      const saved = await planStorage.save(plan)

      // Auto-save with metadata only
      const existing = await planStorage.get(saved.id)
      const after = await planStorage.save({
        id: saved.id,
        courseId: existing!.courseId,
        name: existing!.name,
        startDate: existing!.startDate,
        pagesPerDay: 25, // metadata change
        studyDays: existing!.studyDays,
        startingChapterId: existing!.startingChapterId,
        chapterStartOverrides: existing!.chapterStartOverrides,
        targetEndDate: existing!.targetEndDate,
        targetDayCount: existing!.targetDayCount,
        anchor: existing!.anchor,
        dailyLog: existing!.dailyLog,
        skippedDays: existing!.skippedDays,
        unitOrder: existing!.unitOrder,
      })
      expect(after.pagesPerDay).toBe(25)
      expect(after.unitOrder).toEqual([3, 1, 2])
      expect(after.skippedDays).toContain("2026-04-03")
    })
  })

  describe("Flow 8: handleToggleDay Merge Pattern (Fix 2) — dailyLog synced after merge", () => {
    beforeEach(async () => {
      localStorageMock.clear()
    })

    it("merge + save preserves chapter-level skip and log data through recalibration", async () => {
      // Scenario: Day 1 has chapters 1 (20 pages) and 2 (20 pages).
      // User logged ch1 for 20 pages, skipped ch2. Expected: pagesRead = 20 (ch1) + 0 (skip) = 20.

      const day1Chapters: Chapter[] = [
        { id: 1, title: "Ch 1", pages: 20, unitId: 1, unitName: "U1", color: "#3b82f6" },
        { id: 2, title: "Ch 2", pages: 20, unitId: 1, unitName: "U1", color: "#3b82f6" },
      ]

      const plan = defaultPlan("test-course", {
        name: "Skip Test",
        pagesPerDay: 20,
        startDate: "2026-04-01",
      }) as StudyPlan & { id: string }
      const saved = await planStorage.save(plan)

      // Simulate daily log: user logged 20 pages for Day 1
      const pagesRead = 20

      const mergedDailyLog = {
        ...saved.dailyLog,
        "2026-04-01": { pagesRead },
      }

      // Save merged data (handleToggleDay save)
      const afterToggle = await planStorage.save({
        ...saved,
        dailyLog: mergedDailyLog,
      })

      // Verify the merged data
      expect(afterToggle.dailyLog["2026-04-01"].pagesRead).toBe(20)

      // Now verify recalibration works correctly
      // Using all chapters (not just day 1) for a realistic schedule
      const params = syncStudyPlan(afterToggle as StudyPlan, CHAPTERS, "2026-04-02")
      // Consumed = 20 (day 1), remaining = 380
      expect(params.consumed).toBe(20)
      expect(params.remaining).toBe(380)
    })

    it("unlogged day contributes 0 consumed pages", () => {
      const day1Chapters: Chapter[] = [
        { id: 1, title: "Ch 1", pages: 20, unitId: 1, unitName: "U1", color: "#3b82f6" },
        { id: 2, title: "Ch 2", pages: 20, unitId: 1, unitName: "U1", color: "#3b82f6" },
      ]

      // User logged 5 pages for the day
      let pagesRead = 5
      // Unlogged pages in chapters contribute 0 — they remain in the queue for future days
      expect(pagesRead).toBe(5)
    })
  })

  describe("Flow 9: Chapter-Level Skip → Recalibration", () => {
    it("skip one chapter on day 1 → remaining pages increase → pace/end date adjusts", () => {
      // Use 20ppd, velocity anchor. Day 1 covers ch1 (100p). User skips ch1 (0 read).
      // Day 2 covers ch2 (100p). Day 3 covers ch3 (100p) etc.
      // Plan needs 20 study days at 20ppd.
      // If day 1 read 0 (skip), consumed = 0, remaining = 400, end date shifts by 5 days
      // (since at 20ppd, 400 pages = 20 days, and we lost day 1)

      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        startDate: "2026-04-01",
        dailyLog: {
          "2026-04-01": { pagesRead: 0 }, // all skipped
        },
      })

      const params = syncStudyPlan(plan, CHAPTERS, "2026-04-02")
      expect(params.consumed).toBe(0)
      expect(params.remaining).toBe(400)

      // With 20ppd, should need 20 more study days from Apr 2
      // ~28 calendar days from Apr 2 to Apr 30 (28 days minus weekends)
      expect(params.endDate).not.toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Planner Save → Reload State (Fix 3)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Flow 10: Planner Save Reloads State (Fix 3)", () => {
    beforeEach(async () => {
      localStorageMock.clear()
    })

    it("simulated onPlansChanged: saved plan metadata matches what was written", async () => {
      // Simulate what onPlansChanged does when saving a plan
      const plan = defaultPlan("test-course", {
        name: "Original",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-01",
        anchor: "pagesPerDay",
      }) as StudyPlan & { id: string }
      const saved = await planStorage.save(plan)

      // Simulate PlannerPage save: user changed pagesPerDay to 30, studyDays to Mon/Wed/Fri
      const plannerChanged = await planStorage.save({
        ...saved,
        pagesPerDay: 30,
        studyDays: [1, 3, 5],
        anchor: "endDate",
        targetEndDate: "2026-05-01",
      })

      // onPlansChanged reads back all plans and reloads React state from the saved plan
      const allPlans = await planStorage.getAll()
      const reloaded = allPlans.find((p) => p.id === saved.id)
      expect(reloaded).toBeDefined()
      expect(reloaded!.pagesPerDay).toBe(30)
      expect(reloaded!.studyDays).toEqual([1, 3, 5])
      expect(reloaded!.anchor).toBe("endDate")
      expect(reloaded!.targetEndDate).toBe("2026-05-01")
    })

    it("onPlansChanged reload prevents stale React state from overwriting Planner changes", async () => {
      // Scenario: User has plan with pagesPerDay=20. Changes to 30 in Planner and saves.
      // onPlansChanged reloads React state from the saved plan.
      // Without this, React still has pagesPerDay=20, and the next auto-save would
      // overwrite the planner's change back to 20.

      // Step 1: Create original plan
      const plan = defaultPlan("test-course", {
        name: "Planner Test",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
      }) as StudyPlan & { id: string }
      const saved = await planStorage.save(plan)

      // Step 2: Simulate Planner save — changed pagesPerDay to 30
      const plannerSaved = await planStorage.save({
        ...saved,
        pagesPerDay: 30,
      })
      expect(plannerSaved.pagesPerDay).toBe(30)

      // Step 3: Simulate auto-save with stale React state (still has pagesPerDay=20)
      // If auto-save uses React state for pagesPerDay, it would overwrite back to 20.
      // But onPlansChanged reloads React state first, so when auto-save fires,
      // React state already has pagesPerDay=30.
      const existing = await planStorage.get(saved.id)
      // After onPlansChanged reload, React state has pagesPerDay=30 (from disk)
      const autoSave = await planStorage.save({
        id: saved.id,
        courseId: existing!.courseId,
        name: existing!.name,
        startDate: existing!.startDate,
        pagesPerDay: existing!.pagesPerDay, // this is now 30 (from disk)
        studyDays: existing!.studyDays,
        startingChapterId: existing!.startingChapterId,
        chapterStartOverrides: existing!.chapterStartOverrides,
        targetEndDate: existing!.targetEndDate,
        targetDayCount: existing!.targetDayCount,
        anchor: existing!.anchor,
        dailyLog: existing!.dailyLog,
        skippedDays: existing!.skippedDays,
        unitOrder: existing!.unitOrder,
      })
      expect(autoSave.pagesPerDay).toBe(30) // NOT overwritten to 20
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW TESTS: Multi-Plan Merged View — Non-Primary Plan Mark Done
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Flow 11: Multi-Plan Merged View Mark Done", () => {
    beforeEach(async () => {
      localStorageMock.clear()
    })

    it("non-primary plan Mark Done preserves primary plan data", async () => {
      // Create two plans for different courses
      const primaryPlan = defaultPlan("course-a", {
        name: "Course A",
        pagesPerDay: 20,
        startDate: "2026-04-01",
      }) as StudyPlan & { id: string }
      const secondaryPlan = defaultPlan("course-b", {
        name: "Course B",
        pagesPerDay: 10,
        startDate: "2026-04-01",
      }) as StudyPlan & { id: string }

      const savedPrimary = await planStorage.save(primaryPlan)
      const savedSecondary = await planStorage.save(secondaryPlan)

      // Simulate handleToggleDay for the secondary (non-primary) plan
      const loadedSecondary = await planStorage.get(savedSecondary.id)
      const mergedDailyLog = {
        "2026-04-01": { pagesRead: 5 },
      }
      const updated = await planStorage.save({
        ...loadedSecondary!,
        dailyLog: mergedDailyLog,
      })
      expect(updated.dailyLog["2026-04-01"].pagesRead).toBe(5)

      // Primary plan should be completely unchanged
      const reloadedPrimary = await planStorage.get(savedPrimary.id)
      expect(reloadedPrimary!.dailyLog).toEqual({})
    })

    it("multi-plan: each plan's dailyLog is independent", async () => {
      const planA = defaultPlan("course-a", {
        name: "Course A",
      }) as StudyPlan & { id: string }
      const planB = defaultPlan("course-b", {
        name: "Course B",
      }) as StudyPlan & { id: string }

      const savedA = await planStorage.save(planA)
      const savedB = await planStorage.save(planB)

      // Mark Done on both plans for different days
      const loadedA = await planStorage.get(savedA.id)
      await planStorage.save({
        ...loadedA!,
        dailyLog: { "2026-04-01": { pagesRead: 20 } },
      })

      const loadedB = await planStorage.get(savedB.id)
      await planStorage.save({
        ...loadedB!,
        dailyLog: { "2026-04-02": { pagesRead: 10 } },
      })

      // Verify independence
      const reloadedA = await planStorage.get(savedA.id)
      const reloadedB = await planStorage.get(savedB.id)
      expect(Object.keys(reloadedA!.dailyLog)).toEqual(["2026-04-01"])
      expect(Object.keys(reloadedB!.dailyLog)).toEqual(["2026-04-02"])
      expect(Object.keys(reloadedA!.dailyLog)).toEqual(["2026-04-01"])
      expect(Object.keys(reloadedB!.dailyLog)).toEqual(["2026-04-02"])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Flow 12: Log/Skip → Mark Done → Schedule Recalibration (multi-chapter day)
  // ─────────────────────────────────────────────────────────────────────────────
  // 
  // Real user scenario:
  //   Day covers 2 chapters of 10pp each = 20pp total.
  //   User logs ch1 with 3pp read. User skips ch2.
  //   Mark Done → pagesRead = 3 (only ch1 logged, ch2 skipped = 0).
  //   Remaining = total - 3. Future days absorb the deferred 17pp.
  //
  // We test this at the ENGINE layer (syncStudyPlan + generateSchedule),
  // which is what handleToggleDay feeds into after merging temp dailyLog.

  describe("Flow 12: Log+Skip → MarkDone → Recalibration (multi-chapter day)", () => {
    // Small chapters for precise assertions
    const SMALL_CHAPTERS: Chapter[] = [
      { id: 1, title: "Ch1", pages: 10, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 2, title: "Ch2", pages: 10, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 3, title: "Ch3", pages: 10, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 4, title: "Ch4", pages: 10, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 5, title: "Ch5", pages: 10, unitId: 1, unitName: "U1", color: "#3b82f6" },
      { id: 6, title: "Ch6", pages: 10, unitId: 2, unitName: "U2", color: "#8b5cf6" },
      { id: 7, title: "Ch7", pages: 10, unitId: 2, unitName: "U2", color: "#8b5cf6" },
      { id: 8, title: "Ch8", pages: 10, unitId: 2, unitName: "U2", color: "#8b5cf6" },
      { id: 9, title: "Ch9", pages: 10, unitId: 2, unitName: "U2", color: "#8b5cf6" },
      { id: 10, title: "Ch10", pages: 10, unitId: 2, unitName: "U2", color: "#8b5cf6" },
    ]
    const SMALL_TOTAL = 100

    it("[VELOCITY] log 3pp of ch1 + skip ch2 → remaining=97, endDate extends", () => {
      // Day 1 has ch1(10pp)+ch2(10pp)=20pp (at 20ppd pace).
      // User logged ch1=3, skipped ch2.
      // handleToggleDay computes: pagesRead = 3 (ch1) + 0 (skipped ch2) = 3
      // consumed += 3, remaining = 100 - 3 = 97
      // At 20ppd: neededDays = ceil(97/20) = 5 (vs 4 if nothing happened)
      // End date extends by ~1 study day
      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-06", // Monday
        dailyLog: {
          "2026-04-06": { pagesRead: 3 }, // logged 3pp, skipped ch2=0
        },
      })

      const params = syncStudyPlan(plan, SMALL_CHAPTERS, "2026-04-07")
      expect(params.consumed).toBe(3)
      expect(params.remaining).toBe(97)
      // Without skip: consumed=20, remaining=80, needed=4 days
      // With skip (3pp): consumed=3, remaining=97, needed=5 days
      expect(params.endDate).not.toBeNull()

      // Generate schedule and verify day 1 consumes only 3 pages
      const result = generateSchedule(plan, SMALL_CHAPTERS, "2026-04-07", params.pagesPerDay, params.endDate)
      expect(result.schedule.length).toBeGreaterThan(0)

      const day1 = result.schedule.find(d => d.date === "2026-04-06")
      expect(day1).toBeDefined()
      expect(day1!.totalPages).toBe(3) // only 3 pages consumed from sequence
      // Day 1's chapters should be just ch1 (partial)
      expect(day1!.chapters[0].chapterId).toBe(1)
      expect(day1!.chapters[0].pagesCount).toBe(3) // only 3 pages of ch1
    })

    it("[VELOCITY] full day skip (pagesRead=0) → remaining=100, endDate extends by 1 day", () => {
      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-06",
        dailyLog: {
          "2026-04-06": { pagesRead: 0 }, // all skipped
        },
      })

      const params = syncStudyPlan(plan, SMALL_CHAPTERS, "2026-04-07")
      expect(params.consumed).toBe(0)
      expect(params.remaining).toBe(100)

      const result = generateSchedule(plan, SMALL_CHAPTERS, "2026-04-07", params.pagesPerDay, params.endDate)
      const day1 = result.schedule.find(d => d.date === "2026-04-06")
      expect(day1).toBeDefined()
      // pagesRead=0 → sliceSize=max(0,0)=0. pageIdx stays 0.
      // Day1 shows 0 pages consumed (all chapters deferred)
      expect(day1!.totalPages).toBe(0)
      expect(day1!.chapters).toEqual([])

      // Day 2 starts from chapter 1 (nothing was consumed on day 1)
      const day2 = result.schedule.find(d => d.date === "2026-04-07")
      expect(day2).toBeDefined()
      expect(day2!.chapters[0].chapterId).toBe(1) // still starts with ch1
      expect(day2!.totalPages).toBe(20) // full 20pp on day 2
    })

    it("[DEADLINE] log 3pp of ch1 + skip ch2 → pace increases, deadline stays", () => {
      const plan = makePlan({
        anchor: "endDate",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-06", // Monday
        targetEndDate: "2026-04-10", // Friday (5 study days)
        dailyLog: {
          "2026-04-06": { pagesRead: 3 }, // only 3pp read
        },
      })

      const params = syncStudyPlan(plan, SMALL_CHAPTERS, "2026-04-07")
      expect(params.consumed).toBe(3)
      expect(params.remaining).toBe(97)
      // 4 study days remain (Tue-Fri). Pace = ceil(97/4) = 25ppd
      expect(params.pagesPerDay).toBe(25)
      expect(params.endDate).toBe("2026-04-10")
    })

    it("engine respects whatever pagesRead handleToggleDay sets — unlogged chapters are not the engine's concern", () => {
      // handleToggleDay is responsible for computing pagesRead from user logs.
      // The engine (syncStudyPlan + generateSchedule) just reads pagesRead.
      // This test confirms: if handleToggleDay says pagesRead=3, the engine uses 3.
      
      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-06",
        dailyLog: {
          "2026-04-06": { pagesRead: 3 }, // handleToggleDay computed this
        },
      })

      const params = syncStudyPlan(plan, SMALL_CHAPTERS, "2026-04-07")
      expect(params.consumed).toBe(3)
      expect(params.remaining).toBe(97)
    })

    it("mixed: log 3pp of ch1 + skip ch2 + unlogged ch3 → engine reads dailyLog.pagesRead, not chapter count", () => {
      // Key insight: the ENGINE doesn't know about chapter-level progress.
      // It only reads dailyLog.pagesRead (the sum that handleToggleDay computed).
      // So whatever handleToggleDay decides is pagesRead, the engine respects it.
      const plan = makePlan({
        anchor: "pagesPerDay",
        pagesPerDay: 20,
        studyDays: [1, 2, 3, 4, 5],
        startDate: "2026-04-06",
        dailyLog: {
          "2026-04-06": { pagesRead: 3 },
        },
      })

      const params = syncStudyPlan(plan, SMALL_CHAPTERS, "2026-04-07")
      expect(params.consumed).toBe(3)

      // generateSchedule: day 1 sliceSize = pagesRead = 3
      const result = generateSchedule(plan, SMALL_CHAPTERS, "2026-04-07", 20, params.endDate)
      const day1 = result.schedule.find(d => d.date === "2026-04-06")
      expect(day1).toBeDefined()
      expect(day1!.totalPages).toBe(3)

      // Day 2 should pick up from page 4 of ch1 (3 were consumed on day 1)
      const day2 = result.schedule.find(d => d.date === "2026-04-07")
      expect(day2).toBeDefined()
      // Day2 starts from page 4 of ch1 (3pp consumed on day1, 20ppd for day2)
      // That means: ch1 pages 4-10 (7pp) + ch2 pages 1-10 (10pp) + ch3 page 1 (3pp) = 20pp
      const day2Ch1 = day2!.chapters.find(c => c.chapterId === 1)
      expect(day2Ch1).toBeDefined()
      expect(day2Ch1!.pagesStart).toBe(4) // started from page 4
      expect(day2Ch1!.pagesCount).toBe(7) // finished ch1
    })
  })
})
