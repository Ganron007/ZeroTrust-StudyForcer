import { describe, it, expect, beforeEach, vi } from "vitest"
import { planStorage, defaultPlan, type StudyPlan } from "../plan-storage"

// Mock IS_TAURI to use web/localStorage path
vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

// Mock localStorage
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

describe("planStorage — Persistence", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it("getAll returns empty array when no plans exist", async () => {
    const plans = await planStorage.getAll()
    expect(plans).toEqual([])
  })

  it("save creates a new plan with generated id", async () => {
    const plan = defaultPlan("course-1", { name: "Test Plan" })
    const saved = await planStorage.save(plan)
    expect(saved.id).toBeDefined()
    expect(saved.name).toBe("Test Plan")
    expect(saved.courseId).toBe("course-1")
    expect(saved.createdAt).toBeDefined()
    expect(saved.updatedAt).toBeDefined()
  })

  it("save updates existing plan preserving createdAt", async () => {
    const plan = defaultPlan("course-1", { name: "Original" })
    const saved = await planStorage.save(plan)
    const originalCreatedAt = saved.createdAt

    await new Promise((r) => setTimeout(r, 10)) // ensure time difference

    const updated = await planStorage.save({ ...saved, name: "Updated" })
    expect(updated.id).toBe(saved.id)
    expect(updated.name).toBe("Updated")
    expect(updated.createdAt).toBe(originalCreatedAt)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalCreatedAt).getTime()
    )
  })

  it("get retrieves a plan by id", async () => {
    const plan = defaultPlan("course-1", { name: "Retrievable" })
    const saved = await planStorage.save(plan)
    const retrieved = await planStorage.get(saved.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe(saved.id)
    expect(retrieved!.name).toBe("Retrievable")
  })

  it("get returns null for non-existent id", async () => {
    const result = await planStorage.get("non-existent")
    expect(result).toBeNull()
  })

  it("delete removes plan and active status", async () => {
    const plan = defaultPlan("course-1")
    const saved = await planStorage.save(plan)
    await planStorage.addActiveId(saved.id)

    await planStorage.delete(saved.id)

    const retrieved = await planStorage.get(saved.id)
    expect(retrieved).toBeNull()

    const activeIds = await planStorage.getActiveIds()
    expect(activeIds).not.toContain(saved.id)
  })

  it("rename updates plan name", async () => {
    const plan = defaultPlan("course-1", { name: "Old Name" })
    const saved = await planStorage.save(plan)
    await planStorage.rename(saved.id, "New Name")

    const retrieved = await planStorage.get(saved.id)
    expect(retrieved!.name).toBe("New Name")
  })

  it("active plan ids are persisted", async () => {
    const plan1 = defaultPlan("course-1")
    const plan2 = defaultPlan("course-2")
    const saved1 = await planStorage.save(plan1)
    const saved2 = await planStorage.save(plan2)

    await planStorage.setActiveIds([saved1.id, saved2.id])
    const activeIds = await planStorage.getActiveIds()
    expect(activeIds).toContain(saved1.id)
    expect(activeIds).toContain(saved2.id)
  })

  it("addActiveId deduplicates", async () => {
    const plan = defaultPlan("course-1")
    const saved = await planStorage.save(plan)

    await planStorage.addActiveId(saved.id)
    await planStorage.addActiveId(saved.id)

    const activeIds = await planStorage.getActiveIds()
    expect(activeIds.filter((id) => id === saved.id).length).toBe(1)
  })

  it("removeActiveId removes specific id", async () => {
    const plan1 = defaultPlan("course-1")
    const plan2 = defaultPlan("course-2")
    const saved1 = await planStorage.save(plan1)
    const saved2 = await planStorage.save(plan2)

    await planStorage.setActiveIds([saved1.id, saved2.id])
    await planStorage.removeActiveId(saved1.id)

    const activeIds = await planStorage.getActiveIds()
    expect(activeIds).not.toContain(saved1.id)
    expect(activeIds).toContain(saved2.id)
  })

  it("setActiveIds filters out non-existent plans", async () => {
    const plan = defaultPlan("course-1")
    const saved = await planStorage.save(plan)

    await planStorage.setActiveIds([saved.id, "fake-id"])
    const activeIds = await planStorage.getActiveIds()
    expect(activeIds).toContain(saved.id)
    expect(activeIds).not.toContain("fake-id")
  })

  it("defaultPlan creates plan with correct defaults", () => {
    const plan = defaultPlan("course-1")
    expect(plan.courseId).toBe("course-1")
    expect(plan.name).toBe("My Study Plan")
    expect(plan.pagesPerDay).toBe(20)
    expect(plan.studyDays).toEqual([1, 2, 3, 4, 5])
    expect(plan.startingChapterId).toBe(1)
    expect(plan.anchor).toBe("pagesPerDay")
    expect(plan.dailyLog).toEqual({})
    expect(plan.skippedDays).toEqual([])
  })

  it("defaultPlan applies course defaults", () => {
    const plan = defaultPlan("course-1", {}, { pagesPerDay: 50, studyDays: [1, 3, 5], startingChapterId: 3 })
    expect(plan.pagesPerDay).toBe(50)
    expect(plan.studyDays).toEqual([1, 3, 5])
    expect(plan.startingChapterId).toBe(3)
  })

  it("defaultPlan applies overrides", () => {
    const plan = defaultPlan("course-1", { name: "Override", pagesPerDay: 100 })
    expect(plan.name).toBe("Override")
    expect(plan.pagesPerDay).toBe(100)
  })

  it("unitOrder survives serialization round-trip", async () => {
    const plan = defaultPlan("course-1", {
      name: "Custom Order Plan",
      unitOrder: [3, 1, 5, 2, 8, 4, 6, 7],
    })
    const saved = await planStorage.save(plan)
    expect(saved.unitOrder).toEqual([3, 1, 5, 2, 8, 4, 6, 7])

    // Simulate reload
    const plans = await planStorage.getAll()
    const retrieved = plans.find((p) => p.id === saved.id)
    expect(retrieved).toBeDefined()
    expect(retrieved!.unitOrder).toEqual([3, 1, 5, 2, 8, 4, 6, 7])
  })

  it("unitOrder survives update (existing plan)", async () => {
    // Create plan with a custom order
    const plan = defaultPlan("course-1", {
      name: "Update Test",
      unitOrder: [4, 2, 1, 3],
    })
    const saved = await planStorage.save(plan)
    expect(saved.unitOrder).toEqual([4, 2, 1, 3])

    // Update the plan (e.g. user changes name) — unitOrder must survive
    const updated = await planStorage.save({ ...saved, name: "Updated Name" })
    expect(updated.unitOrder).toEqual([4, 2, 1, 3])

    // Simulate reload
    const retrieved = await planStorage.get(saved.id)
    expect(retrieved!.unitOrder).toEqual([4, 2, 1, 3])
  })

  it("unitOrder preserved when caller does not include it (handleToggleDay scenario)", async () => {
    // Create plan with unitOrder
    const plan = defaultPlan("course-1", {
      name: "Toggle Test",
      unitOrder: [5, 3, 1, 2, 4],
    })
    const saved = await planStorage.save(plan)

    // Simulate handleToggleDay: spread the loaded plan, only override completedDays
    // The caller does NOT include unitOrder in the spread-override
    const loaded = await planStorage.get(saved.id)
    const updated = await planStorage.save({
      ...loaded!,
      completedDays: ["2026-05-01"],
    } as any)
    expect(updated.unitOrder).toEqual([5, 3, 1, 2, 4])

    const retrieved = await planStorage.get(saved.id)
    expect(retrieved!.unitOrder).toEqual([5, 3, 1, 2, 4])
  })

  it("unitOrder can be cleared by saving undefined", async () => {
    const plan = defaultPlan("course-1", {
      name: "Reset Test",
      unitOrder: [2, 1, 3],
    })
    const saved = await planStorage.save(plan)
    expect(saved.unitOrder).toEqual([2, 1, 3])

    // User clicks "Reset to Default" — save with unitOrder: undefined (key present, value undefined)
    const cleared = await planStorage.save({ ...saved, unitOrder: undefined })
    expect(cleared.unitOrder).toBeUndefined()

    const retrieved = await planStorage.get(saved.id)
    expect(retrieved!.unitOrder).toBeUndefined()
  })

  it("storage survives serialization round-trip", async () => {
    const plan = defaultPlan("course-1", {
      name: "Round Trip",
      dailyLog: { "2026-04-01": { pagesRead: 25, note: "Good day" } },
      completedDays: ["2026-04-01"],
      skippedDays: ["2026-04-02"],
    })
    const saved = await planStorage.save(plan)
    await planStorage.addActiveId(saved.id)

    // Simulate app reload by creating fresh storage instance
    // (in reality, readStorage reads from localStorage)
    const plans = await planStorage.getAll()
    const retrieved = plans.find((p) => p.id === saved.id)

    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe("Round Trip")
    expect(retrieved!.dailyLog["2026-04-01"].pagesRead).toBe(25)
    expect(retrieved!.dailyLog["2026-04-01"].note).toBe("Good day")
    expect(retrieved!.completedDays).toContain("2026-04-01")
    expect(retrieved!.skippedDays).toContain("2026-04-02")
  })
})
