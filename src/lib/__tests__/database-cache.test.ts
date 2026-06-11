import { describe, it, expect, vi, beforeEach } from "vitest"

// Phase 3.1: Async storage with in-memory cache.
// These tests verify the web/localStorage cache pattern (readStorage +
// writeStorage) round-trips correctly. The Tauri path uses the same
// API surface but is not testable in jsdom (Tauri plugins require
// the Tauri runtime). See e2e/ for Tauri runtime coverage.

vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

import { now } from "../clock"
import type { StudyPlan } from "../plan-storage"

const mockPlan = (id: string): StudyPlan => ({
  id,
  courseId: "test-course",
  name: `Plan ${id}`,
  startDate: "2026-06-10",
  pagesPerDay: 20,
  studyDays: [1, 2, 3, 4, 5],
  startingChapterId: 1,
  chapterStartOverrides: {},
  anchor: "pagesPerDay",
  dailyLog: {},
  skippedDays: [],
  createdAt: now(),
  updatedAt: now(),
})

describe("Phase 3.1: storage read/write + cache invalidation", () => {
  beforeEach(() => {
    // Reset module cache between tests
    vi.resetModules()
    localStorage.clear()
  })

  it("readStorage returns parsed data", async () => {
    const { readStorage, writeStorage } = await import("../database")
    const data = { plans: { p1: mockPlan("p1") }, activePlanIds: ["p1"] }
    await writeStorage(data)
    const result = await readStorage()
    expect(result.plans["p1"].name).toBe("Plan p1")
  })

  it("writeStorage then readStorage round-trips", async () => {
    const { readStorage, writeStorage } = await import("../database")
    const data = {
      plans: { p1: mockPlan("p1"), p2: mockPlan("p2") },
      activePlanIds: ["p1", "p2"],
    }
    await writeStorage(data)
    const result = await readStorage()
    expect(Object.keys(result.plans)).toEqual(["p1", "p2"])
    expect(result.activePlanIds).toEqual(["p1", "p2"])
  })

  it("writeStorage invalidates the cache so next read sees fresh data", async () => {
    const { readStorage, writeStorage } = await import("../database")
    // First write + read
    await writeStorage({ plans: { p1: mockPlan("p1") }, activePlanIds: ["p1"] })
    const first = await readStorage()
    expect(first.plans["p1"].name).toBe("Plan p1")

    // Second write (overwrite)
    await writeStorage({ plans: { p1: { ...mockPlan("p1"), name: "Updated" } }, activePlanIds: ["p1"] })
    const second = await readStorage()
    expect(second.plans["p1"].name).toBe("Updated")
  })

  it("readStorage returns empty on first call with no data", async () => {
    const { readStorage } = await import("../database")
    const result = await readStorage()
    expect(result.plans).toEqual({})
    expect(result.activePlanIds).toEqual([])
  })

  it("writeStorage with empty data clears all plans", async () => {
    const { readStorage, writeStorage } = await import("../database")
    // Create a plan first
    await writeStorage({ plans: { p1: mockPlan("p1") }, activePlanIds: ["p1"] })
    // Clear all
    await writeStorage({ plans: {}, activePlanIds: [] })
    const result = await readStorage()
    expect(result.plans).toEqual({})
    expect(result.activePlanIds).toEqual([])
  })
})
