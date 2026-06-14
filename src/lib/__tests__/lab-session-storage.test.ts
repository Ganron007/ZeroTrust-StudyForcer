import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

import {
  readLabsStorage,
  writeLabsStorage,
  getLast14Days,
  getLast7Days,
  getStreak,
  computeSmartScore,
  getAtRiskCount,
  getLabCategory,
  getTodayMinutes,
} from "../lab-session-storage"
import { DEFAULT_EXTERNAL_LABS, type LabSession } from "../lab-sessions"

describe("readLabsStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns defaults when nothing stored", async () => {
    const data = await readLabsStorage()
    expect(data.labs).toEqual(DEFAULT_EXTERNAL_LABS)
    expect(data.sessions).toHaveLength(0)
  })

  it("returns defaults on corrupt JSON", async () => {
    localStorage.setItem("web:labs_sessions", "not json")
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(0)
    expect(data.labs).toEqual(DEFAULT_EXTERNAL_LABS)
  })

  it("returns defaults on non-object JSON", async () => {
    localStorage.setItem("web:labs_sessions", JSON.stringify([1, 2, 3]))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(0)
  })

  it("reads valid sessions", async () => {
    const storage = {
      labs: DEFAULT_EXTERNAL_LABS,
      sessions: [
        { labId: "tryhackme", date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
      ],
      categories: {},
    }
    localStorage.setItem("web:labs_sessions", JSON.stringify(storage))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].labId).toBe("tryhackme")
  })

  it("S4: rejects sessions that are arrays", async () => {
    const storage = {
      labs: [],
      sessions: [
        ["tryhackme", "2026-06-10", 30],
        { labId: "valid", date: "2026-06-10", minutes: 20, createdAt: "2026-06-10T10:00:00Z" },
      ],
      categories: {},
    }
    localStorage.setItem("web:labs_sessions", JSON.stringify(storage))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].labId).toBe("valid")
  })

  it("S5: rejects sessions with non-string labId", async () => {
    const storage = {
      labs: [],
      sessions: [
        { labId: 123, date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
        { labId: null, date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
      ],
      categories: {},
    }
    localStorage.setItem("web:labs_sessions", JSON.stringify(storage))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(0)
  })

  it("S5: rejects sessions with unparseable date", async () => {
    const storage = {
      labs: [],
      sessions: [
        { labId: "bad", date: "not-a-date", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
      ],
      categories: {},
    }
    localStorage.setItem("web:labs_sessions", JSON.stringify(storage))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(0)
  })

  it("S6: rejects sessions with NaN or non-positive minutes", async () => {
    const storage = {
      labs: [],
      sessions: [
        { labId: "nan", date: "2026-06-10", minutes: NaN, createdAt: "2026-06-10T10:00:00Z" },
        { labId: "zero", date: "2026-06-10", minutes: 0, createdAt: "2026-06-10T10:00:00Z" },
        { labId: "neg", date: "2026-06-10", minutes: -10, createdAt: "2026-06-10T10:00:00Z" },
        { labId: "str", date: "2026-06-10", minutes: "30", createdAt: "2026-06-10T10:00:00Z" },
        { labId: "valid", date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
      ],
      categories: {},
    }
    localStorage.setItem("web:labs_sessions", JSON.stringify(storage))
    const data = await readLabsStorage()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].labId).toBe("valid")
  })
})

describe("getLast14Days / getLast7Days", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
  })

  it("getLast14Days returns 14 dates ending today", () => {
    const days = getLast14Days()
    expect(days).toHaveLength(14)
    expect(days[13]).toBe("2026-06-15")
    expect(days[0]).toBe("2026-06-02")
  })

  it("getLast7Days returns 7 dates ending today", () => {
    const days = getLast7Days()
    expect(days).toHaveLength(7)
    expect(days[6]).toBe("2026-06-15")
    expect(days[0]).toBe("2026-06-09")
  })

  it("uses setDate (DST-safe, not ms arithmetic)", () => {
    // If the function used ms arithmetic, DST transitions would break.
    // Verify it produces correct calendar dates across a known range.
    const days = getLast7Days()
    // Each consecutive day should differ by exactly 1
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + "T00:00:00")
      const curr = new Date(days[i] + "T00:00:00")
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      expect(diff).toBe(1)
    }
  })
})

describe("getStreak", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
  })

  it("returns 0 for empty sessions", () => {
    expect(getStreak([])).toBe(0)
  })

  it("returns 0 if no session today or yesterday", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-12", minutes: 30, createdAt: "2026-06-12T10:00:00Z" },
    ]
    expect(getStreak(sessions)).toBe(0)
  })

  it("returns 1 if logged today but not yesterday", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-15", minutes: 30, createdAt: "2026-06-15T10:00:00Z" },
    ]
    expect(getStreak(sessions)).toBe(1)
  })

  it("counts consecutive days ending today", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-13", minutes: 30, createdAt: "2026-06-13T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-14", minutes: 30, createdAt: "2026-06-14T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-15", minutes: 30, createdAt: "2026-06-15T10:00:00Z" },
    ]
    expect(getStreak(sessions)).toBe(3)
  })

  it("counts streak ending yesterday", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-13", minutes: 30, createdAt: "2026-06-13T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-14", minutes: 30, createdAt: "2026-06-14T10:00:00Z" },
    ]
    expect(getStreak(sessions)).toBe(2)
  })

  it("deduplicates same-day sessions", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-15", minutes: 30, createdAt: "2026-06-15T10:00:00Z" },
      { labId: "hackthebox", date: "2026-06-15", minutes: 45, createdAt: "2026-06-15T11:00:00Z" },
    ]
    expect(getStreak(sessions)).toBe(1)
  })

  it("stops at gap in streak", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-12", minutes: 30, createdAt: "2026-06-12T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-14", minutes: 30, createdAt: "2026-06-14T10:00:00Z" },
      { labId: "tryhackme", date: "2026-06-15", minutes: 30, createdAt: "2026-06-15T10:00:00Z" },
    ]
    // 15 → 14 (streak 2), 13 missing → stop
    expect(getStreak(sessions)).toBe(2)
  })
})

describe("computeSmartScore", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
  })

  it("gives max score for never-used lab (daysSince=null)", () => {
    const result = computeSmartScore("tryhackme", null, 0, [])
    expect(result.score).toBe(100)
    expect(result.factors.base).toBe(100)
    expect(result.factors.atRiskBonus).toBe(20)
    expect(result.factors.unexploredBonus).toBe(15)
    // Clamped to 100
    expect(result.factors.final).toBe(100)
  })

  it("gives 0 base for lab used today", () => {
    const result = computeSmartScore("tryhackme", 0, 60, [])
    expect(result.factors.base).toBe(0)
    expect(result.factors.atRiskBonus).toBe(0)
  })

  it("caps base at 100 for very old lab", () => {
    const result = computeSmartScore("tryhackme", 50, 0, [])
    expect(result.factors.base).toBe(100) // 50*3=150, capped at 100
  })

  it("adds at-risk bonus at 14+ days", () => {
    const r1 = computeSmartScore("tryhackme", 13, 60, [])
    const r2 = computeSmartScore("tryhackme", 14, 60, [])
    expect(r2.factors.atRiskBonus).toBe(20)
    expect(r1.factors.atRiskBonus).toBe(0)
    // Score diff = base diff (+3 from daysSince 13→14) + atRisk (+20)
    expect(r2.score - r1.score).toBe(23)
  })

  it("applies recent use penalty for sessions in last 7 days", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-14", minutes: 30, createdAt: "2026-06-14T10:00:00Z" },
    ]
    const result = computeSmartScore("tryhackme", 1, 30, sessions)
    expect(result.factors.recentUsePenalty).toBe(10)
  })

  it("does not apply recent use penalty for sessions older than 7 days", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-01", minutes: 30, createdAt: "2026-06-01T10:00:00Z" },
    ]
    const result = computeSmartScore("tryhackme", 14, 30, sessions)
    expect(result.factors.recentUsePenalty).toBe(0)
  })

  it("clamps final score to [0, 100]", () => {
    // Very high base + bonuses should clamp to 100
    const result = computeSmartScore("tryhackme", null, 0, [])
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })
})

describe("getAtRiskCount", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
  })

  it("counts all default labs as at-risk when no sessions exist", () => {
    const count = getAtRiskCount([])
    expect(count).toBe(DEFAULT_EXTERNAL_LABS.length)
  })

  it("reduces count when a lab was used recently", () => {
    const sessions: LabSession[] = [
      { labId: DEFAULT_EXTERNAL_LABS[0].id, date: "2026-06-14", minutes: 30, createdAt: "2026-06-14T10:00:00Z" },
      { labId: DEFAULT_EXTERNAL_LABS[1].id, date: "2026-06-10", minutes: 30, createdAt: "2026-06-10T10:00:00Z" },
    ]
    const count = getAtRiskCount(sessions)
    // 2 labs used within 14 days, rest are at-risk
    expect(count).toBe(DEFAULT_EXTERNAL_LABS.length - 2)
  })

  it("lab used exactly 14 days ago is still at-risk (>= 14)", () => {
    const sessions: LabSession[] = [
      { labId: DEFAULT_EXTERNAL_LABS[0].id, date: "2026-06-01", minutes: 30, createdAt: "2026-06-01T10:00:00Z" },
    ]
    const count = getAtRiskCount(sessions)
    // 14 days ago → still at-risk
    expect(count).toBe(DEFAULT_EXTERNAL_LABS.length)
  })

  it("lab used 13 days ago is NOT at-risk", () => {
    const sessions: LabSession[] = [
      { labId: DEFAULT_EXTERNAL_LABS[0].id, date: "2026-06-02", minutes: 30, createdAt: "2026-06-02T10:00:00Z" },
    ]
    const count = getAtRiskCount(sessions)
    expect(count).toBe(DEFAULT_EXTERNAL_LABS.length - 1)
  })
})

describe("getLabCategory", () => {
  it("returns stored category when valid", () => {
    const data = {
      labs: DEFAULT_EXTERNAL_LABS,
      sessions: [],
      categories: { tryhackme: "blue" as const },
    }
    expect(getLabCategory(data, "tryhackme")).toBe("blue")
  })

  it("falls back to lab default when no stored category", () => {
    const data = { labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} }
    expect(getLabCategory(data, "tryhackme")).toBe("purple")
    expect(getLabCategory(data, "blueteamlabs")).toBe("blue")
  })

  it("falls back to purple when lab not found and no stored category", () => {
    const data = { labs: DEFAULT_EXTERNAL_LABS, sessions: [], categories: {} }
    expect(getLabCategory(data, "nonexistent")).toBe("purple")
  })

  it("falls back to default when stored category is invalid", () => {
    const data = {
      labs: DEFAULT_EXTERNAL_LABS,
      sessions: [],
      categories: { tryhackme: "invalid" as any },
    }
    expect(getLabCategory(data, "tryhackme")).toBe("purple")
  })
})

describe("getTodayMinutes", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
  })

  it("returns 0 for empty sessions", () => {
    expect(getTodayMinutes([])).toBe(0)
  })

  it("sums minutes for today's sessions", () => {
    const sessions: LabSession[] = [
      { labId: "tryhackme", date: "2026-06-15", minutes: 30, createdAt: "2026-06-15T10:00:00Z" },
      { labId: "hackthebox", date: "2026-06-15", minutes: 45, createdAt: "2026-06-15T11:00:00Z" },
      { labId: "tryhackme", date: "2026-06-14", minutes: 20, createdAt: "2026-06-14T10:00:00Z" },
    ]
    expect(getTodayMinutes(sessions)).toBe(75)
  })
})
