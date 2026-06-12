import { describe, it, expect, beforeEach } from "vitest"
import {
  getPostmortem, savePostmortem, deletePostmortem,
  findPlansNeedingPostmortem, createEmptyPostmortem,
  type Postmortem,
} from "../postmortem"

/**
 * Phase 0.5.8: Postmortem mode tests.
 *
 * Storage is per-plan, keyed by plan ID. findPlansNeedingPostmortem
 * returns plans whose exam date has passed and that don't have a
 * postmortem yet.
 */
describe("postmortem storage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns null when no postmortem exists", () => {
    expect(getPostmortem("p1")).toBeNull()
  })

  it("saves and reads a postmortem", () => {
    const pm: Postmortem = {
      planId: "p1",
      createdAt: "2026-06-10T00:00:00.000Z",
      updatedAt: "2026-06-10T00:00:00.000Z",
      timeline: "Started Mar 1",
      rootCause: "Didn't pace well",
      worked: "Morning routine",
      didnt: "Skipping weekends",
      actions: "Add weekend review",
    }
    savePostmortem(pm)
    const got = getPostmortem("p1")
    expect(got).toEqual(pm)
  })

  it("deletes a postmortem", () => {
    savePostmortem(createEmptyPostmortem("p1"))
    expect(getPostmortem("p1")).not.toBeNull()
    deletePostmortem("p1")
    expect(getPostmortem("p1")).toBeNull()
  })

  it("preserves other postmortems when one is deleted", () => {
    savePostmortem(createEmptyPostmortem("p1"))
    savePostmortem(createEmptyPostmortem("p2"))
    deletePostmortem("p1")
    expect(getPostmortem("p1")).toBeNull()
    expect(getPostmortem("p2")).not.toBeNull()
  })

  it("createEmptyPostmortem fills all sections with empty strings", () => {
    const pm = createEmptyPostmortem("p1")
    expect(pm.planId).toBe("p1")
    expect(pm.timeline).toBe("")
    expect(pm.rootCause).toBe("")
    expect(pm.worked).toBe("")
    expect(pm.didnt).toBe("")
    expect(pm.actions).toBe("")
    expect(pm.createdAt).toBeTruthy()
    expect(pm.updatedAt).toBeTruthy()
  })
})

describe("findPlansNeedingPostmortem", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns plans whose exam date has passed and have no postmortem", () => {
    const result = findPlansNeedingPostmortem(
      [{ id: "p1", targetEndDate: "2026-01-01" }],
      "2026-06-10",
    )
    expect(result).toEqual(["p1"])
  })

  it("excludes plans whose exam date is in the future", () => {
    const result = findPlansNeedingPostmortem(
      [{ id: "p1", targetEndDate: "2027-01-01" }],
      "2026-06-10",
    )
    expect(result).toEqual([])
  })

  it("excludes plans with no exam date", () => {
    const result = findPlansNeedingPostmortem(
      [{ id: "p1" }, { id: "p2" }],
      "2026-06-10",
    )
    expect(result).toEqual([])
  })

  it("excludes plans that already have a postmortem", () => {
    savePostmortem(createEmptyPostmortem("p1"))
    const result = findPlansNeedingPostmortem(
      [{ id: "p1", targetEndDate: "2026-01-01" }],
      "2026-06-10",
    )
    expect(result).toEqual([])
  })

  it("handles multiple plans with mixed states", () => {
    const result = findPlansNeedingPostmortem(
      [
        { id: "p1", targetEndDate: "2026-01-01" },  // past, needs postmortem
        { id: "p2", targetEndDate: "2027-12-31" }, // future
        { id: "p3" },                                // no exam
        { id: "p4", targetEndDate: "2026-02-01" },  // past
      ],
      "2026-06-10",
    )
    expect(result).toEqual(["p1", "p4"])
  })

  it("handles malformed date strings gracefully", () => {
    const result = findPlansNeedingPostmortem(
      [{ id: "p1", targetEndDate: "not-a-date" }],
      "2026-06-10",
    )
    expect(result).toEqual([])
  })

  it("treats exam date == today as past", () => {
    // The postmortem should be available the day the exam passes
    const result = findPlansNeedingPostmortem(
      [{ id: "p1", targetEndDate: "2026-06-10" }],
      "2026-06-10",
    )
    expect(result).toEqual(["p1"])
  })
})
