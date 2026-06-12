import { describe, it, expect, beforeEach } from "vitest"
import {
  loadAdversarySettings, saveAdversarySettings,
  computeAdversaryBump, applyAdversaryPace,
  type AdversarySettings,
} from "../adversary"

/**
 * Phase 0.5.9: Adversary timer tests.
 *
 * Off by default. When enabled, pace auto-bumps if user hasn't
 * logged today by their deadline.
 */

describe("adversary settings storage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns defaults when nothing is stored", () => {
    const s = loadAdversarySettings()
    expect(s.enabled).toBe(false)
    expect(s.paceBoostPct).toBe(25)
    expect(s.deadline).toBe("21:00")
  })

  it("saves and reads settings", () => {
    const s: AdversarySettings = { enabled: true, paceBoostPct: 50, deadline: "18:30" }
    saveAdversarySettings(s)
    expect(loadAdversarySettings()).toEqual(s)
  })

  it("merges with defaults on partial storage", () => {
    localStorage.setItem("ztsf:adversary-settings", JSON.stringify({ enabled: true }))
    const s = loadAdversarySettings()
    expect(s.enabled).toBe(true)
    expect(s.paceBoostPct).toBe(25)  // default
    expect(s.deadline).toBe("21:00")  // default
  })

  it("returns defaults on corrupt JSON", () => {
    localStorage.setItem("ztsf:adversary-settings", "not json")
    expect(loadAdversarySettings().enabled).toBe(false)
  })
})

describe("computeAdversaryBump", () => {
  it("returns 0 when disabled", () => {
    expect(computeAdversaryBump(
      { enabled: false, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T20:00:00.000Z",
    )).toBe(0)
  })

  it("returns 0 when current time is before deadline", () => {
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T20:30:00.000Z",
    )).toBe(0)
  })

  it("returns the bump when current time is at/after deadline", () => {
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T21:00:00.000Z",
    )).toBe(25)
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T23:59:00.000Z",
    )).toBe(25)
  })

  it("returns 0 when today doesn't match current date", () => {
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-11T22:00:00.000Z",  // tomorrow
    )).toBe(0)
  })

  it("handles malformed deadline gracefully", () => {
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "not-a-time" },
      "2026-06-10",
      "2026-06-10T22:00:00.000Z",
    )).toBe(0)
  })
})

describe("applyAdversaryPace", () => {
  it("returns original when bump is 0", () => {
    expect(applyAdversaryPace(
      20,
      { enabled: false, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T20:00:00.000Z",
    )).toBe(20)
  })

  it("applies +25% boost (20 -> 25)", () => {
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T22:00:00.000Z",
    )).toBe(25)
  })

  it("applies +50% boost (20 -> 30)", () => {
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 50, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T22:00:00.000Z",
    )).toBe(30)
  })

  it("rounds non-integer results", () => {
    // 20 * 1.333 = 26.66 -> 27
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 33, deadline: "21:00" },
      "2026-06-10",
      "2026-06-10T22:00:00.000Z",
    )).toBe(27)
  })
})
