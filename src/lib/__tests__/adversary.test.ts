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

/**
 * Build a local-time ISO string for a given date+HH:MM. The function
 * is timezone-aware so the test works regardless of the host's
 * local timezone. Returns the equivalent of "Date constructor in
 * local time" -> ISO.
 */
function localIsoString(date: string, hhmm: string): string {
  // Parse the date+time in local time, then ask JS for the ISO.
  // This produces the UTC ISO that corresponds to that local time.
  const d = new Date(`${date}T${hhmm}:00`)
  return d.toISOString()
}

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
    // Use 23:30 local on 2026-06-10, with deadline 21:00. Bump should trigger.
    // We construct a local-time ISO by adding the local offset.
    const lateIso = localIsoString("2026-06-10", "23:30")
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      lateIso,
      "2026-06-10",
    )).toBe(25)
  })

  it("returns 0 when today doesn't match current date", () => {
    // Use a late-evening local time on 2026-06-11
    const lateIso = localIsoString("2026-06-11", "23:30")
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",  // today = June 10
      lateIso,
      "2026-06-11",  // local date June 11
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
    const lateIso = localIsoString("2026-06-10", "23:30")
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      lateIso,
      "2026-06-10",
    )).toBe(25)
  })

  it("applies +50% boost (20 -> 30)", () => {
    const lateIso = localIsoString("2026-06-10", "23:30")
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 50, deadline: "21:00" },
      "2026-06-10",
      lateIso,
      "2026-06-10",
    )).toBe(30)
  })

  it("rounds non-integer results", () => {
    // 20 * 1.333 = 26.66 -> 27
    const lateIso = localIsoString("2026-06-10", "23:30")
    expect(applyAdversaryPace(
      20,
      { enabled: true, paceBoostPct: 33, deadline: "21:00" },
      "2026-06-10",
      lateIso,
      "2026-06-10",
    )).toBe(27)
  })
})

describe("v2.6.0 audit fixes", () => {
  it("REGRESSION: paceBoostPct is clamped to [0, 200] on load", () => {
    localStorage.setItem("ztsf:adversary-settings", JSON.stringify({
      enabled: true, paceBoostPct: 1000, deadline: "21:00",
    }))
    const s = loadAdversarySettings()
    expect(s.paceBoostPct).toBe(200)  // clamped
  })

  it("REGRESSION: negative paceBoostPct is clamped to 0 on load", () => {
    localStorage.setItem("ztsf:adversary-settings", JSON.stringify({
      enabled: true, paceBoostPct: -50, deadline: "21:00",
    }))
    const s = loadAdversarySettings()
    expect(s.paceBoostPct).toBe(0)
  })

  it("REGRESSION: non-finite paceBoostPct falls back to default", () => {
    localStorage.setItem("ztsf:adversary-settings", JSON.stringify({
      enabled: true, paceBoostPct: "not a number", deadline: "21:00",
    }))
    const s = loadAdversarySettings()
    expect(s.paceBoostPct).toBe(25)  // default
  })

  it("REGRESSION: saveAdversarySettings clamps paceBoostPct", () => {
    saveAdversarySettings({ enabled: true, paceBoostPct: 500, deadline: "21:00" })
    const s = loadAdversarySettings()
    expect(s.paceBoostPct).toBe(200)
  })

  it("REGRESSION: explicit nowLocalDate is used to avoid UTC/local mismatch", () => {
    // 2026-06-11T20:00:00Z in Asia/Calcutta (UTC+5:30) is
    // 2026-06-12T01:30 local. This is past the 18:00 deadline.
    // Without the fix: function substrings "2026-06-12" from nowIso and
    // compares to today="2026-06-11" -> mismatch -> returns 0.
    // With the fix: caller passes nowLocalDate="2026-06-11" (the
    // user's actual local date), and local hour 01:30 < 18:00 -> 0.
    //
    // Wait, the user's local hour here is 01:30 of the NEXT day, which
    // is BEFORE 18:00. So no bump triggers. The bump only fires when
    // local hour >= deadline. To test the timezone fix specifically,
    // we need local hour AFTER 18:00. Use a time late in local day:
    const lateUtc = "2026-06-10T13:30:00.000Z"  // = 2026-06-10 19:00 IST (after 18:00)
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "18:00" },
      "2026-06-10",  // user expects to bump today
      lateUtc,
      "2026-06-10",  // local date passed by caller
    )).toBe(25)
  })

  it("REGRESSION: nowLocalDate auto-derived when not provided", () => {
    // 23:30 local on 2026-06-10. Bump should trigger; local date derived
    // from this ISO should match "2026-06-10".
    const lateIso = localIsoString("2026-06-10", "23:30")
    expect(computeAdversaryBump(
      { enabled: true, paceBoostPct: 25, deadline: "21:00" },
      "2026-06-10",
      lateIso,
    )).toBe(25)
  })
})
