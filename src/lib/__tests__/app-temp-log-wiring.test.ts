import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * P-2 wiring regression tests (v2.5.0 → refactored into useStudyLogging hook).
 *
 * These tests verify that the temp-log storage module is correctly wired into
 * the component layer. The storage module itself has its own tests
 * (temp-log-storage.test.ts) — this file tests the integration.
 *
 * The hook is the consumer of temp-log-storage; App.tsx delegates to the hook
 * so the wiring semantics are preserved while the implementation moves out of
 * the monolith.
 */

const hookTs = readFileSync(
  resolve(__dirname, "../../hooks/useStudyLogging.ts"),
  "utf8"
)

const appTsx = readFileSync(
  resolve(__dirname, "../../App.tsx"),
  "utf8"
)

describe("P-2 wiring: hook imports temp-log-storage", () => {
  it("useStudyLogging imports readTempLogs, applyTempLog, clearTempLog from temp-log-storage", () => {
    expect(hookTs).toMatch(/import\s+\{[^}]*readTempLogs[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
    expect(hookTs).toMatch(/import\s+\{[^}]*applyTempLog[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
    expect(hookTs).toMatch(/import\s+\{[^}]*clearTempLog[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
  })
})

describe("P-2 wiring: hook loads temp logs on mount (Bug #6 fix)", () => {
  it("useStudyLogging has a useEffect that calls readTempLogs on mount", () => {
    const effectMatch = hookTs.match(/useEffect\(\s*\(\s*\)\s*=>\s*\{[^}]*readTempLogs/s)
    expect(effectMatch, "useEffect calling readTempLogs not found").toBeTruthy()
  })

  it("useStudyLogging gates mutations on a tempLogsLoaded flag (Bug #4/Bug #6 fix)", () => {
    expect(hookTs).toMatch(/const\s+\[tempLogsLoaded,\s*setTempLogsLoaded\]\s*=\s*useState\(false\)/)

    // All three mutators must check the flag
    expect(hookTs).toMatch(/handleLogPlan[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
    expect(hookTs).toMatch(/handleSkipPlan[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
    expect(hookTs).toMatch(/handleMarkDone[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
  })
})

/**
 * Extract a function body from source by name. Naive approach: find
 * `const NAME = (` then track brace nesting until balanced close.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`const ${name} =`)
  if (start === -1) return ""
  const openParen = source.indexOf("(", start)
  if (openParen === -1) return ""
  let depth = 0
  let i = openParen
  let bodyStart = -1
  let bodyEnd = -1
  while (i < source.length) {
    const c = source[i]
    if (c === "{") {
      if (depth === 0 && bodyStart === -1) {
        bodyStart = i
      }
      depth++
    } else if (c === "}") {
      depth--
      if (depth === 0 && bodyStart !== -1) {
        bodyEnd = i
        break
      }
    }
    i++
  }
  if (bodyStart === -1 || bodyEnd === -1) return ""
  return source.substring(bodyStart, bodyEnd + 1)
}

describe("P-2 wiring: hook persists temp logs on Log/Skip (Bug #5 fix)", () => {
  it("handleLogPlan calls applyTempLog from temp-log-storage", () => {
    const body = extractFunction(hookTs, "handleLogPlan")
    expect(body, "handleLogPlan not found").toBeTruthy()
    expect(body).toMatch(/applyTempLogLocal\(/)
  })

  it("applyTempLogLocal calls applyTempLog from temp-log-storage", () => {
    const body = extractFunction(hookTs, "applyTempLogLocal")
    expect(body, "applyTempLogLocal not found").toBeTruthy()
    expect(body).toMatch(/applyTempLog\(/)
  })

  it("handleSkipPlan calls applyTempLog with pagesRead=0", () => {
    const body = extractFunction(hookTs, "handleSkipPlan")
    expect(body, "handleSkipPlan not found").toBeTruthy()
    expect(body).toMatch(/applyTempLog\([^)]*0\)/)
  })
})

describe("P-2 wiring: hook clears storage on Mark Done (Bug #4 fix)", () => {
  it("handleMarkDone awaits clearTempLog (not fire-and-forget)", () => {
    const body = extractFunction(hookTs, "handleMarkDone")
    expect(body, "handleMarkDone not found").toBeTruthy()
    expect(body).toMatch(/await\s+clearTempLog\(/)
    expect(body).not.toMatch(/clearTempLog\([^)]*\)\.catch\(/)
  })

  it("handleMarkDone reports errors when storage clear fails", () => {
    const body = extractFunction(hookTs, "handleMarkDone")
    expect(body).toBeTruthy()
    expect(body).toMatch(/tempLogClearFailed/)
  })
})

describe("P-2 wiring: App.tsx still invokes the hook correctly", () => {
  it("App.tsx imports useStudyLogging", () => {
    expect(appTsx).toMatch(/import\s+\{[^}]*useStudyLogging[^}]*\}\s+from\s+["'].*hooks\/useStudyLogging["']/)
  })

  it("App.tsx calls useStudyLogging and passes handleMarkDone to ScheduleView", () => {
    expect(appTsx).toMatch(/useStudyLogging\(/)
    expect(appTsx).toMatch(/onMarkDone=\{handleMarkDone\}/)
  })
})

describe("P-2 wiring: no naked new Date() in App.tsx (Bug #1 fix)", () => {
  it("App.tsx has zero naked new Date() or Date.now() calls", () => {
    const nakedNewDate = appTsx.match(/new Date\(\s*\)/g) || []
    const nakedDateNow = appTsx.match(/Date\.now\(\s*\)/g) || []
    expect(
      nakedNewDate.length,
      `App.tsx has ${nakedNewDate.length} naked new Date() call(s): ${nakedNewDate.join(", ")}`
    ).toBe(0)
    expect(
      nakedDateNow.length,
      `App.tsx has ${nakedDateNow.length} naked Date.now() call(s): ${nakedDateNow.join(", ")}`
    ).toBe(0)
  })

  it("App.tsx imports from clock.ts", () => {
    expect(appTsx).toMatch(/import\s+\{[^}]*(now|nowDate|nowMs)[^}]*\}\s+from\s+["'].*clock["']/)
  })
})

/**
 * Behavioral tests: the storage layer must actually survive a refresh
 * (the user-facing bug P-2 was supposed to fix).
 */
import "../is-tauri"

describe("P-2 behavior: temp logs survive a simulated refresh", () => {
  it("applyTempLog + readTempLogs round-trips (log persists across 'page reload')", async () => {
    const { applyTempLog, readTempLogs, clearAllTempLogs } = await import("../temp-log-storage")
    await clearAllTempLogs()

    // Simulate the user clicking "Log 15 pages"
    await applyTempLog("2026-06-10", "cissp", 15)

    // Simulate a page refresh: new module load, re-read from storage
    const reloaded = await readTempLogs()
    expect(reloaded).toEqual({
      "2026-06-10": { cissp: { pagesRead: 15 } },
    })
  })

  it("clearTempLog removes only the specified date (Mark Done clears today's temp log)", async () => {
    const { applyTempLog, readTempLogs, clearTempLog } = await import("../temp-log-storage")

    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-11", "cissp", 20)

    // User clicks Mark Done for 2026-06-10
    await clearTempLog("2026-06-10")

    const after = await readTempLogs()
    expect(after).toEqual({
      "2026-06-11": { cissp: { pagesRead: 20 } },
    })
  })
})
