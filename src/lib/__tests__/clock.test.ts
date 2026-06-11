import { describe, it, expect, vi, afterEach } from "vitest"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

import { now, today, nowMs, nowDate } from "../clock"

afterEach(() => {
  vi.useRealTimers()
})

describe("clock module", () => {
  it("now() returns an ISO 8601 string", () => {
    const result = now()
    expect(typeof result).toBe("string")
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    // Should be parseable as a Date
    const parsed = new Date(result)
    expect(isNaN(parsed.getTime())).toBe(false)
  })

  it("today() returns YYYY-MM-DD", () => {
    const result = today()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("nowMs() returns epoch milliseconds (number)", () => {
    const result = nowMs()
    expect(typeof result).toBe("number")
    expect(result).toBeGreaterThan(0)
    // Should be close to Date.now() (within 100ms)
    expect(Math.abs(result - Date.now())).toBeLessThan(100)
  })

  it("nowDate() returns a Date object", () => {
    const result = nowDate()
    expect(result).toBeInstanceOf(Date)
    expect(isNaN(result.getTime())).toBe(false)
  })

  it("is mockable with vi.setSystemTime", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
    expect(now()).toBe("2026-06-10T12:00:00.000Z")
    expect(today()).toBe("2026-06-10")
    expect(nowMs()).toBe(new Date("2026-06-10T12:00:00Z").getTime())
  })
})

describe("Inviolable rule: lib/ files use clock module instead of direct Date calls", () => {
  it("all lib/ files use clock module instead of direct Date calls", () => {
    // Phase 3.4 + v2.5.0 migration scope: all files in src/lib/ AND
    // App.tsx that handle "now" must go through the clock module.
    // (Naked = no arguments, meaning "now". new Date(arg) for parsing
    // a date string is fine.)
    // App.tsx is covered by src/lib/__tests__/app-temp-log-wiring.test.ts.
    const libFiles = [
      "src/lib/auto-backup.ts",
      "src/lib/database.ts",
      "src/lib/date-utils.ts",
      "src/lib/lab-session-storage.ts",
      "src/lib/news-storage.ts",
      "src/lib/notifications.ts",
      "src/lib/plan-storage.ts",
      "src/lib/temp-log-storage.ts",
      "src/lib/timer-storage.ts",
    ]
    for (const file of libFiles) {
      const source = readFileSync(
        resolve(__dirname, `../../../${file}`),
        "utf8"
      )
      // Check for naked new Date() with optional whitespace
      const nakedNewDate = source.match(/new Date\(\s*\)/g) || []
      // Check for naked Date.now()
      const nakedDateNow = source.match(/Date\.now\(\s*\)/g) || []
      // Each file should have zero naked Date calls (all should go through clock)
      expect(
        nakedNewDate.length,
        `${file} has ${nakedNewDate.length} naked new Date() call(s): ${nakedNewDate.join(", ")}`
      ).toBe(0)
      expect(
        nakedDateNow.length,
        `${file} has ${nakedDateNow.length} naked Date.now() call(s): ${nakedDateNow.join(", ")}`
      ).toBe(0)
    }
  })
})
