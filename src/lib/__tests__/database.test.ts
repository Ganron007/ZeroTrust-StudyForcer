import { describe, it, expect, beforeEach, vi } from "vitest"

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

import { readStorage, writeStorage } from "../database"
import type { StudyPlan } from "../plan-storage"

const makePlan = (id: string): StudyPlan => ({
  id,
  courseId: "cissp-10th-ed",
  name: "Test",
  startDate: "2026-04-01",
  pagesPerDay: 20,
  dailyLog: {},
  chapterStartOverrides: {},
  studyDays: [1, 2, 3, 4, 5],
  unitOrder: [],
  startingChapterId: 1,
  skippedDays: [],
  anchor: "pagesPerDay",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
})

describe("database (web/localStorage mode)", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it("readStorage returns empty state on first call", async () => {
    const data = await readStorage()
    expect(data.plans).toEqual({})
    expect(data.activePlanIds).toEqual([])
  })

  it("writeStorage then readStorage round-trips correctly", async () => {
    const plan = makePlan("p1")
    const data = { plans: { p1: plan }, activePlanIds: ["p1"] }
    await writeStorage(data)
    const loaded = await readStorage()
    expect(loaded.activePlanIds).toEqual(["p1"])
  })

  it("writeStorage overwrites existing data", async () => {
    const plan1 = makePlan("p1")
    await writeStorage({ plans: { p1: plan1 }, activePlanIds: ["p1"] })
    const plan2 = makePlan("p2")
    await writeStorage({ plans: { p2: plan2 }, activePlanIds: [] })
    const loaded = await readStorage()
    expect(loaded.plans.p1).toBeUndefined()
    expect(loaded.plans.p2).toBeDefined()
    expect(loaded.activePlanIds).toEqual([])
  })

  it("writeStorage throws on quota exceeded (simulated via setItem error)", async () => {
    const origSetItem = localStorageMock.setItem
    localStorageMock.setItem = vi.fn(() => { throw new Error("QuotaExceededError") })
    const plan = makePlan("p1")
    await expect(writeStorage({ plans: { p1: plan }, activePlanIds: ["p1"] }))
      .rejects.toThrow("Failed to save data: storage quota exceeded")
    localStorageMock.setItem = origSetItem
  })

  it("handles concurrent read/write without corrupting cache", async () => {
    const plan = makePlan("p1")
    await writeStorage({ plans: { p1: plan }, activePlanIds: ["p1"] })
    const [a, b] = await Promise.all([readStorage(), readStorage()])
    expect(a).toEqual(b)
  })
})
