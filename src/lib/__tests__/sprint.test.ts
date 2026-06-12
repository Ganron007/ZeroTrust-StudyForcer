import { describe, it, expect } from "vitest"
import { isSprintActive, sprintDaysRemaining, applySprintPace, type SprintOverlay } from "../sprint"

/**
 * Phase 0.5.4: Sprint mode tests.
 *
 * Sprint is a { startDate, days, paceBoost } overlay on pagesPerDay.
 * Active between startDate and startDate + days (inclusive).
 */
function sprint(overrides: Partial<SprintOverlay> = {}): SprintOverlay {
  return {
    startDate: "2026-06-10",
    days: 7,
    paceBoost: 25,
    ...overrides,
  }
}

describe("isSprintActive", () => {
  it("returns false when sprint is undefined", () => {
    expect(isSprintActive(undefined, "2026-06-12")).toBe(false)
  })

  it("returns true on start date", () => {
    expect(isSprintActive(sprint(), "2026-06-10")).toBe(true)
  })

  it("returns true mid-sprint", () => {
    expect(isSprintActive(sprint(), "2026-06-13")).toBe(true)
  })

  it("returns true on the last day (days=N means start..start+N-1 are active)", () => {
    // startDate=2026-06-10, days=7 means active from 6-10 to 6-16 inclusive
    // 6-17 is the first inactive day
    expect(isSprintActive(sprint(), "2026-06-16")).toBe(true)
    expect(isSprintActive(sprint(), "2026-06-17")).toBe(false)
  })

  it("returns false before start date", () => {
    expect(isSprintActive(sprint(), "2026-06-09")).toBe(false)
  })

  it("returns false after end date", () => {
    expect(isSprintActive(sprint({ days: 3 }), "2026-06-15")).toBe(false)
  })

  it("handles malformed date strings gracefully", () => {
    expect(isSprintActive(sprint({ startDate: "not-a-date" }), "2026-06-12")).toBe(false)
  })
})

describe("sprintDaysRemaining", () => {
  it("returns 0 when no sprint", () => {
    expect(sprintDaysRemaining(undefined, "2026-06-12")).toBe(0)
  })

  it("returns N on start date", () => {
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-10")).toBe(7)
  })

  it("decreases as days pass", () => {
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-11")).toBe(6)
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-13")).toBe(4)
  })

  it("returns 0 on the day after end", () => {
    // days=7 means active for 7 days, so day 8 is the first inactive
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-17")).toBe(0)
  })

  it("returns 0 after sprint ended", () => {
    expect(sprintDaysRemaining(sprint({ days: 3 }), "2026-06-20")).toBe(0)
  })
})

describe("applySprintPace", () => {
  it("returns original when no sprint", () => {
    expect(applySprintPace(20, undefined, "2026-06-12")).toBe(20)
  })

  it("returns original when sprint is inactive", () => {
    expect(applySprintPace(20, sprint(), "2026-06-09")).toBe(20)
    expect(applySprintPace(20, sprint(), "2026-06-17")).toBe(20)
  })

  it("applies +25% boost (20 -> 25)", () => {
    expect(applySprintPace(20, sprint({ paceBoost: 25 }), "2026-06-12")).toBe(25)
  })

  it("applies +50% boost (20 -> 30)", () => {
    expect(applySprintPace(20, sprint({ paceBoost: 50 }), "2026-06-12")).toBe(30)
  })

  it("rounds non-integer results", () => {
    // 20 * 1.333 = 26.66 -> 27
    expect(applySprintPace(20, sprint({ paceBoost: 33 }), "2026-06-12")).toBe(27)
  })
})

describe("v2.6.0 audit fixes", () => {
  it("REGRESSION: zero/negative days makes sprint inactive", () => {
    expect(isSprintActive(sprint({ days: 0 }), "2026-06-10")).toBe(false)
    expect(isSprintActive(sprint({ days: -5 }), "2026-06-10")).toBe(false)
  })

  it("REGRESSION: negative paceBoost is treated as no boost (safety)", () => {
    // 20 * (1 + -50/100) = 10, but we guard against negative
    expect(applySprintPace(20, sprint({ paceBoost: -50 }), "2026-06-12")).toBe(20)
  })

  it("REGRESSION: sprintDaysRemaining uses Math.round (not ceil) for stable count", () => {
    // On start date: should be exactly 7
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-10")).toBe(7)
    // 1 day after start: 6
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-11")).toBe(6)
    // 7 days after start (June 17): 0, not negative
    expect(sprintDaysRemaining(sprint({ days: 7 }), "2026-06-17")).toBe(0)
  })

  it("REGRESSION: DST-safe — sprint end uses calendar date addition (not ms math)", () => {
    // March 8 → 9 → 10 → ... is 2026 US DST start (spring forward).
    // March 8 has 23 hours, March 9 has 23 hours, March 10 has 24 hours.
    // A 3-day sprint starting March 8 should end on March 11 (DST-safe),
    // not 3*86400000 ms later (which would land on March 10 at 23:00 PST).
    const dstSprint = sprint({ startDate: "2026-03-08", days: 3 })
    // Active: March 8, 9, 10. Inactive: March 11.
    expect(isSprintActive(dstSprint, "2026-03-08")).toBe(true)
    expect(isSprintActive(dstSprint, "2026-03-09")).toBe(true)
    expect(isSprintActive(dstSprint, "2026-03-10")).toBe(true)
    expect(isSprintActive(dstSprint, "2026-03-11")).toBe(false)
  })
})
