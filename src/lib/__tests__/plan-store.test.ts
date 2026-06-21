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

import { usePlanStore } from "../plan-store"
import type { StudyPlan } from "../plan-storage"

const makePlan = (overrides: Partial<StudyPlan> & { courseId: string }): StudyPlan => ({
  id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "Test Plan",
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
  ...overrides,
})

describe("plan-store", () => {
  beforeEach(() => {
    localStorageMock.clear()
    usePlanStore.setState({
      allPlans: [],
      activePlanIds: [],
      primaryActivePlanId: null,
      isLoading: true,
    })
  })

  it("loadPlans populates state from storage", async () => {
    await usePlanStore.getState().loadPlans()
    const state = usePlanStore.getState()
    expect(Array.isArray(state.allPlans)).toBe(true)
    expect(Array.isArray(state.activePlanIds)).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it("setActivePlanIds filters out non-existent plan IDs", async () => {
    await usePlanStore.getState().loadPlans()
    await usePlanStore.getState().setActivePlanIds(["nonexistent-id"])
    const state = usePlanStore.getState()
    expect(state.activePlanIds).toEqual([])
    expect(state.primaryActivePlanId).toBeNull()
  })

  it("updatePlan adds a new plan to allPlans", async () => {
    const plan = makePlan({ courseId: "cissp-10th-ed" })
    await usePlanStore.getState().updatePlan(plan)
    const state = usePlanStore.getState()
    expect(state.allPlans).toHaveLength(1)
    expect(state.allPlans[0].id).toBe(plan.id)
  })

  it("updatePlan activates a newly created plan", async () => {
    const plan = makePlan({ courseId: "cissp-10th-ed" })
    await usePlanStore.getState().updatePlan(plan)
    const state = usePlanStore.getState()
    expect(state.activePlanIds).toContain(plan.id)
    expect(state.primaryActivePlanId).toBe(plan.id)
  })

  it("updatePlan overwrites an existing plan with the same id", async () => {
    const plan = makePlan({ courseId: "cissp-10th-ed", name: "Original" })
    await usePlanStore.getState().updatePlan(plan)
    const updated = { ...plan, name: "Updated" }
    await usePlanStore.getState().updatePlan(updated)
    const state = usePlanStore.getState()
    expect(state.allPlans).toHaveLength(1)
    expect(state.allPlans[0].name).toBe("Updated")
  })

  it("setPrimaryActivePlanId sets the primary active plan id (not persisted)", () => {
    usePlanStore.getState().setPrimaryActivePlanId("plan-1")
    expect(usePlanStore.getState().primaryActivePlanId).toBe("plan-1")
  })

  it("setPrimaryActivePlanId accepts null", () => {
    usePlanStore.getState().setPrimaryActivePlanId(null)
    expect(usePlanStore.getState().primaryActivePlanId).toBeNull()
  })
})
