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

  it("saves and reads a postmortem", async () => {
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
    await savePostmortem(pm)
    const got = getPostmortem("p1")
    expect(got).toEqual(pm)
  })

  it("deletes a postmortem", async () => {
    await savePostmortem(createEmptyPostmortem("p1"))
    expect(getPostmortem("p1")).not.toBeNull()
    await deletePostmortem("p1")
    expect(getPostmortem("p1")).toBeNull()
  })

  it("preserves other postmortems when one is deleted", async () => {
    await savePostmortem(createEmptyPostmortem("p1"))
    await savePostmortem(createEmptyPostmortem("p2"))
    await deletePostmortem("p1")
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

  it("excludes plans that already have a postmortem", async () => {
    await savePostmortem(createEmptyPostmortem("p1"))
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

  it("REGRESSION: returns plan IDs sorted by date (oldest first)", () => {
    const result = findPlansNeedingPostmortem(
      [
        { id: "p1", targetEndDate: "2026-04-01" },  // oldest
        { id: "p2", targetEndDate: "2026-05-01" },
        { id: "p3", targetEndDate: "2026-03-01" },  // most overdue
        { id: "p4", targetEndDate: "2026-06-01" },
      ],
      "2026-06-10",
    )
    expect(result).toEqual(["p3", "p1", "p2", "p4"])
  })

  it("REGRESSION: reads localStorage ONCE for N plans, not N times", () => {
    // Spy on localStorage.getItem
    let callCount = 0
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = function (key: string) {
      if (key === "ztsf:postmortems") callCount++
      return orig.call(this, key)
    }
    try {
      findPlansNeedingPostmortem(
        [
          { id: "p1", targetEndDate: "2026-01-01" },
          { id: "p2", targetEndDate: "2026-02-01" },
          { id: "p3", targetEndDate: "2026-03-01" },
        ],
        "2026-06-10",
      )
      expect(callCount).toBe(1)  // NOT 3
    } finally {
      Storage.prototype.getItem = orig
    }
  })
})

describe("postmortem RMW race protection (v2.6.0 audit fix)", () => {
  it("REGRESSION: savePostmortem is awaited and serializes concurrent calls", async () => {
    const { savePostmortem, getPostmortem } = await import("../postmortem")
    localStorage.clear()

    // Fire 5 concurrent saves for different plans
    await Promise.all([
      savePostmortem(createEmptyPostmortem("p1")),
      savePostmortem(createEmptyPostmortem("p2")),
      savePostmortem(createEmptyPostmortem("p3")),
      savePostmortem(createEmptyPostmortem("p4")),
      savePostmortem(createEmptyPostmortem("p5")),
    ])

    // All 5 should be present — no lost writes due to RMW races
    expect(getPostmortem("p1")).not.toBeNull()
    expect(getPostmortem("p2")).not.toBeNull()
    expect(getPostmortem("p3")).not.toBeNull()
    expect(getPostmortem("p4")).not.toBeNull()
    expect(getPostmortem("p5")).not.toBeNull()
  })

  it("REGRESSION: deletePostmortem returns a Promise (awaitable)", async () => {
    const { savePostmortem, deletePostmortem, getPostmortem } = await import("../postmortem")
    localStorage.clear()
    await savePostmortem(createEmptyPostmortem("p1"))
    expect(getPostmortem("p1")).not.toBeNull()
    const result = deletePostmortem("p1")
    expect(result).toBeInstanceOf(Promise)
    await result
    expect(getPostmortem("p1")).toBeNull()
  })
})
