import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * P-2 wiring regression tests (v2.5.0).
 *
 * These tests verify that the temp-log storage module is correctly
 * wired into App.tsx. The storage module itself has its own tests
 * (temp-log-storage.test.ts) — this file tests the integration.
 *
 * Why source-code tests instead of React component tests?
 * - App.tsx is a 1600-line monolith with many dependencies (Zustand,
 *   Tauri, course storage, plan engine, personality layer, focus traps).
 *   Mounting it in jsdom requires extensive mocking.
 * - The wiring we care about is the *relationship* between App.tsx and
 *   temp-log-storage: imports, calls, guards. Source-code tests are
 *   the right tool for this — they survive refactors that don't
 *   change the wiring semantics.
 *
 * The user-facing bug these tests prevent: "I logged 15 pages, then
 * refreshed, and my log was gone." v2.4.11.Phase 3.2 created the
 * storage module but didn't wire it. v2.5.0.P-2 wired it. v2.5.0
 * audit found the wiring had race conditions. These tests catch
 * regressions of all three.
 */

const appTsx = readFileSync(
  resolve(__dirname, "../../App.tsx"),
  "utf8"
)

describe("P-2 wiring: App.tsx imports temp-log-storage", () => {
  it("App.tsx imports readTempLogs, applyTempLog, clearTempLog from temp-log-storage", () => {
    // Must import these three for the wiring to work
    expect(appTsx).toMatch(/import\s+\{[^}]*readTempLogs[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
    expect(appTsx).toMatch(/import\s+\{[^}]*applyTempLog[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
    expect(appTsx).toMatch(/import\s+\{[^}]*clearTempLog[^}]*\}\s+from\s+["'].*temp-log-storage["']/)
  })

  it("App.tsx renames applyTempLog on import to avoid collision with local function", () => {
    // App.tsx defines a local `applyTempLog` function (which does the
    // schedule lookup, validation, React state update, and toast). To
    // use the storage module's applyTempLog, it must be imported with
    // an alias like `applyTempLogToStorage`.
    expect(appTsx).toMatch(/applyTempLog\s+as\s+applyTempLogToStorage/)
    expect(appTsx).toMatch(/clearTempLog\s+as\s+clearTempLogFromStorage/)
  })
})

describe("P-2 wiring: App.tsx loads temp logs on mount (Bug #6 fix)", () => {
  it("App.tsx has a useEffect that calls readTempLogs on mount", () => {
    // The useEffect must call readTempLogs and setDailyLog on mount.
    // Without this, temp logs are lost on refresh.
    const effectMatch = appTsx.match(/useEffect\(\s*\(\s*\)\s*=>\s*\{[^}]*readTempLogs/s)
    expect(effectMatch, "useEffect calling readTempLogs not found").toBeTruthy()
  })

  it("App.tsx gates mutations on a tempLogsLoaded flag (Bug #4/Bug #6 fix)", () => {
    // v2.5.0 audit found: if Mark Done / Skip / Log fire before the
    // useEffect callback runs, the empty React state is committed
    // and the stale storage data overwrites the cleared state. Fix:
    // gate all mutators on tempLogsLoaded flag.
    expect(appTsx).toMatch(/const\s+\[tempLogsLoaded,\s*setTempLogsLoaded\]\s*=\s*useState\(false\)/)

    // All three mutators must check the flag
    expect(appTsx).toMatch(/applyTempLog[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
    expect(appTsx).toMatch(/handleSkipPlan[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
    expect(appTsx).toMatch(/handleMarkDone[\s\S]{0,500}if\s*\(\s*!\s*tempLogsLoaded\s*\)/)
  })
})

/**
 * Extract a function body from App.tsx by name. Naive approach: find
 * `const NAME = (` then track brace nesting until balanced close.
 * Good enough for App.tsx which has no nested function expressions
 * with the same name.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`const ${name} =`)
  if (start === -1) return ""
  const openParen = source.indexOf("(", start)
  if (openParen === -1) return ""
  // Walk from openParen, track braces and parens
  let depth = 0
  let i = openParen
  let bodyStart = -1
  let bodyEnd = -1
  // Find the body's opening brace (after the parameters)
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

describe("P-2 wiring: App.tsx persists temp logs on Log/Skip (Bug #5 fix)", () => {
  it("applyTempLog calls applyTempLogToStorage", () => {
    // The local applyTempLog function must persist to storage after
    // updating React state. Without this, refresh loses the log.
    const body = extractFunction(appTsx, "applyTempLog")
    expect(body, "local applyTempLog function not found").toBeTruthy()
    expect(body).toMatch(/applyTempLogToStorage\(/)
  })

  it("handleSkipPlan calls applyTempLogToStorage with pagesRead=0", () => {
    const body = extractFunction(appTsx, "handleSkipPlan")
    expect(body, "handleSkipPlan not found").toBeTruthy()
    expect(body).toMatch(/applyTempLogToStorage\([^)]*0\)/)
  })
})

describe("P-2 wiring: App.tsx clears storage on Mark Done (Bug #4 fix)", () => {
  it("handleMarkDone awaits clearTempLogFromStorage (not fire-and-forget)", () => {
    // v2.5.0 audit found: clearTempLogFromStorage was fire-and-forget.
    // If the clear failed, the user saw a phantom pending log on next mount.
    // Fix: await it and report errors.
    const body = extractFunction(appTsx, "handleMarkDone")
    expect(body, "handleMarkDone not found").toBeTruthy()
    // Must use await (not just .then/.catch)
    expect(body).toMatch(/await\s+clearTempLogFromStorage\(/)
    // Must NOT be fire-and-forget
    expect(body).not.toMatch(/clearTempLogFromStorage\([^)]*\)\.catch\(/)
  })

  it("handleMarkDone reports errors when storage clear fails", () => {
    const body = extractFunction(appTsx, "handleMarkDone")
    expect(body).toBeTruthy()
    // Should show a "break" toast on failure
    expect(body).toMatch(/tempLogClearFailed/)
  })
})

describe("P-2 wiring: no naked new Date() in App.tsx (Bug #1 fix)", () => {
  it("App.tsx has zero naked new Date() or Date.now() calls", () => {
    // The v2.5.0 release said components were migrated but missed
    // App.tsx itself. This test catches a regression of that mistake.
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
 * Behavioral tests: the storage layer App.tsx uses must actually
 * survive a refresh (the user-facing bug P-2 was supposed to fix).
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
