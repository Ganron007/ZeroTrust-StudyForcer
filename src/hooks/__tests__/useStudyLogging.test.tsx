/**
 * useStudyLogging hook — behavioral tests.
 *
 * v2.5.0: hook extracted from App.tsx. Owns:
 *   - Log/Skip temp React state (gated on tempLogsLoaded to prevent race)
 *   - Mark Done commit flow
 *   - LogDialog open/close/save/skip
 *   - plansLoggedForDate validation
 *
 * These tests render the hook in isolation with a minimal harness that
 * wires the plan store + a fake schedule. We use jsdom (test-setup.ts)
 * and run under TZ=UTC (vitest.config.ts) so dates are deterministic.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

vi.mock("../../is-tauri", () => ({ IS_TAURI: false }))

import { useStudyLogging } from "../useStudyLogging"
import { usePlanStore } from "../../lib/plan-store"
import { applyTempLog, clearAllTempLogs, readTempLogs } from "../../lib/temp-log-storage"
import type { StudyPlan } from "../../lib/plan-storage"
import type { StudyDay } from "../../lib/cissp-data"

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

const tToast = (key: string) => `[${key}]`
const courseLabel = (id: string) => id

const makePlan = (overrides: Partial<StudyPlan>): StudyPlan => ({
  id: `plan-${Math.random().toString(36).slice(2, 8)}`,
  courseId: "cissp-10th-ed",
  name: "Test Plan",
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

const makeSchedule = (): StudyDay[] => [
  {
    date: "2026-06-10",
    dayNumber: 1,
    totalPages: 20,
    chapters: [
      {
        chapterId: 1,
        chapterTitle: "Ch 1",
        unit: 1,
        unitName: "U1",
        pagesStart: 1,
        pagesEnd: 20,
        pagesCount: 20,
        color: "#000",
        courseId: "cissp-10th-ed",
        courseLabel: "CISSP",
        bookPageStart: 1,
        bookPageEnd: 20,
      },
    ],
  },
  {
    date: "2026-06-11",
    dayNumber: 2,
    totalPages: 20,
    chapters: [
      {
        chapterId: 2,
        chapterTitle: "Ch 2",
        unit: 1,
        unitName: "U1",
        pagesStart: 21,
        pagesEnd: 40,
        pagesCount: 20,
        color: "#000",
        courseId: "cissp-10th-ed",
        courseLabel: "CISSP",
        bookPageStart: 21,
        bookPageEnd: 40,
      },
    ],
  },
]

describe("useStudyLogging — tempLogsLoaded gate", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("starts with tempLogsLoaded=false and gates log/skip/markDone before mount", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    expect(result.current.tempLogsLoaded).toBe(false)
    // markDone should no-op before temp loads
    await act(async () => {
      await result.current.handleMarkDone("2026-06-10")
    })
    const stored = await readTempLogs()
    expect(stored["2026-06-10"]).toBeUndefined()
  })

  it("flips tempLogsLoaded=true after the initial useEffect runs", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => {
      expect(result.current.tempLogsLoaded).toBe(true)
    })
  })
})

describe("useStudyLogging — handleLogPlan", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("writes to temp React state and persists to storage (page within range)", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 10)
    })

    expect(result.current.dailyLog["2026-06-10"]?.["cissp-10th-ed"]?.pagesRead).toBe(9) // 10 - 1
    // Allow microtask for storage write
    await waitFor(async () => {
      const stored = await readTempLogs()
      expect(stored["2026-06-10"]?.["cissp-10th-ed"]?.pagesRead).toBe(9)
    })
  })

  it("rejects page value before schedule start (Bug #2 fix)", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      // Page 0 is before schedule start (1)
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 0)
    })

    expect(result.current.dailyLog["2026-06-10"]?.["cissp-10th-ed"]).toBeUndefined()
  })

  it("rejects page value for unknown date", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("1999-01-01", "cissp-10th-ed", 10)
    })

    expect(result.current.dailyLog["1999-01-01"]).toBeUndefined()
  })

  it("rejects non-integer or negative page values", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 1.5)
    })
    expect(result.current.dailyLog["2026-06-10"]).toBeUndefined()

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", -1)
    })
    expect(result.current.dailyLog["2026-06-10"]).toBeUndefined()

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", Number.NaN)
    })
    expect(result.current.dailyLog["2026-06-10"]).toBeUndefined()
  })
})

describe("useStudyLogging — handleSkipPlan", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("writes pagesRead=0 to temp state and storage", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleSkipPlan("2026-06-10", "cissp-10th-ed")
    })

    expect(result.current.dailyLog["2026-06-10"]?.["cissp-10th-ed"]?.pagesRead).toBe(0)
    await waitFor(async () => {
      const stored = await readTempLogs()
      expect(stored["2026-06-10"]?.["cissp-10th-ed"]?.pagesRead).toBe(0)
    })
  })
})

describe("useStudyLogging — plansLoggedForDate", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("returns true when no chapters on the day (empty plan)", async () => {
    const schedule: StudyDay[] = [{ date: "2026-06-10", dayNumber: 1, totalPages: 0, chapters: [] }]
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))
    expect(result.current.plansLoggedForDate("2026-06-10")).toBe(true)
  })

  it("returns false when no temp log exists", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))
    expect(result.current.plansLoggedForDate("2026-06-10")).toBe(false)
  })

  it("returns true when every course on the date has a log entry", async () => {
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 10)
    })
    expect(result.current.plansLoggedForDate("2026-06-10")).toBe(true)
  })

  it("returns false when only some courses on the date have logs", async () => {
    const schedule: StudyDay[] = [
      {
        date: "2026-06-10",
        dayNumber: 1,
        totalPages: 20,
        chapters: [
          { chapterId: 1, chapterTitle: "A", unit: 1, unitName: "U", pagesStart: 1, pagesEnd: 10, pagesCount: 10, color: "#000", courseId: "a", courseLabel: "A", bookPageStart: 1, bookPageEnd: 10 },
          { chapterId: 2, chapterTitle: "B", unit: 2, unitName: "U", pagesStart: 1, pagesEnd: 10, pagesCount: 10, color: "#000", courseId: "b", courseLabel: "B", bookPageStart: 1, bookPageEnd: 10 },
        ],
      },
    ]
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "a", 5)
    })
    expect(result.current.plansLoggedForDate("2026-06-10")).toBe(false)
  })
})

describe("useStudyLogging — handleMarkDone", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("refuses to commit when not all plans logged for the date", async () => {
    const plan = makePlan({ id: "p1" })
    usePlanStore.setState({
      allPlans: [plan],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    await act(async () => {
      await result.current.handleMarkDone("2026-06-10")
    })

    // Plan.dailyLog should be untouched
    const state = usePlanStore.getState()
    expect(state.allPlans[0].dailyLog["2026-06-10"]).toBeUndefined()
  })

  it("commits to plan.dailyLog and clears temp state on Mark Done", async () => {
    const plan = makePlan({ id: "p1" })
    usePlanStore.setState({
      allPlans: [plan],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 10)
    })
    expect(result.current.plansLoggedForDate("2026-06-10")).toBe(true)

    await act(async () => {
      await result.current.handleMarkDone("2026-06-10")
    })

    const state = usePlanStore.getState()
    expect(state.allPlans[0].dailyLog["2026-06-10"]?.pagesRead).toBe(9)
    // Temp state should be cleared
    expect(result.current.dailyLog["2026-06-10"]).toBeUndefined()
    // Storage should be cleared
    const stored = await readTempLogs()
    expect(stored["2026-06-10"]).toBeUndefined()
  })

  it("invokes onAfterMarkDone callback after a successful commit", async () => {
    const plan = makePlan({ id: "p1" })
    usePlanStore.setState({
      allPlans: [plan],
      activePlanIds: ["p1"],
      primaryActivePlanId: "p1",
    })
    const schedule = makeSchedule()
    const onAfterMarkDone = vi.fn()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast, onAfterMarkDone })
    )
    await waitFor(() => expect(result.current.tempLogsLoaded).toBe(true))

    act(() => {
      result.current.handleLogPlan("2026-06-10", "cissp-10th-ed", 10)
    })
    await act(async () => {
      await result.current.handleMarkDone("2026-06-10")
    })

    expect(onAfterMarkDone).toHaveBeenCalledTimes(1)
  })
})

describe("useStudyLogging — temp-log reload on mount (Bug #6 fix)", () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearAllTempLogs()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("hydrates dailyLog from storage on mount", async () => {
    await applyTempLog("2026-06-10", "cissp-10th-ed", 7)
    const schedule = makeSchedule()
    const { result } = renderHook(() =>
      useStudyLogging({ schedule, courseLabel, tToast })
    )
    await waitFor(() => {
      expect(result.current.dailyLog["2026-06-10"]?.["cissp-10th-ed"]?.pagesRead).toBe(7)
    })
  })
})
