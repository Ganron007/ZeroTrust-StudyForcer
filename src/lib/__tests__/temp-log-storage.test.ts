import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("../is-tauri", () => ({ IS_TAURI: false }))

import {
  readTempLogs,
  writeTempLogs,
  applyTempLog,
  clearTempLog,
  clearAllTempLogs,
  getTempLogsForDate,
} from "../temp-log-storage"

beforeEach(() => {
  localStorage.clear()
})

describe("temp-log-storage: Phase 3.2 — persisted temp state", () => {
  it("readTempLogs returns empty object on first read", async () => {
    const store = await readTempLogs()
    expect(store).toEqual({})
  })

  it("writeTempLogs persists data that survives readTempLogs", async () => {
    const data = {
      "2026-06-10": {
        "cissp": { pagesRead: 15 },
      },
    }
    await writeTempLogs(data)
    const read = await readTempLogs()
    expect(read).toEqual(data)
  })

  it("applyTempLog creates nested structure and persists", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    const after = await readTempLogs()
    expect(after).toEqual({
      "2026-06-10": { cissp: { pagesRead: 15 } },
    })
  })

  it("applyTempLog overwrites previous entry for same date+course (Rule 6: one action per day)", async () => {
    await applyTempLog("2026-06-10", "cissp", 10)
    await applyTempLog("2026-06-10", "cissp", 15)
    const after = await readTempLogs()
    expect(after["2026-06-10"]["cissp"].pagesRead).toBe(15)
    // Only one entry per date+course
    expect(Object.keys(after["2026-06-10"])).toEqual(["cissp"])
  })

  it("applyTempLog handles multiple courses for same date", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-10", "oscp", 20)
    const after = await readTempLogs()
    expect(after).toEqual({
      "2026-06-10": {
        cissp: { pagesRead: 15 },
        oscp: { pagesRead: 20 },
      },
    })
  })

  it("applyTempLog handles multiple dates", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-11", "cissp", 20)
    const after = await readTempLogs()
    expect(after).toEqual({
      "2026-06-10": { cissp: { pagesRead: 15 } },
      "2026-06-11": { cissp: { pagesRead: 20 } },
    })
  })

  it("clearTempLog removes a specific date's entries", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-11", "cissp", 20)
    await clearTempLog("2026-06-10")
    const after = await readTempLogs()
    expect(after).toEqual({
      "2026-06-11": { cissp: { pagesRead: 20 } },
    })
  })

  it("clearAllTempLogs wipes everything (called on Mark Done)", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-11", "cissp", 20)
    await clearAllTempLogs()
    const after = await readTempLogs()
    expect(after).toEqual({})
  })

  it("getTempLogsForDate returns just one date's entries", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    await applyTempLog("2026-06-11", "cissp", 20)
    const today = await getTempLogsForDate("2026-06-10")
    expect(today).toEqual({ cissp: { pagesRead: 15 } })
  })

  it("getTempLogsForDate returns empty object for unknown date", async () => {
    const unknown = await getTempLogsForDate("1999-01-01")
    expect(unknown).toEqual({})
  })

  it("survives simulated refresh (re-reads from localStorage)", async () => {
    await applyTempLog("2026-06-10", "cissp", 15)
    // Simulate a fresh app load — new "module instance"
    // (in the real app, the module is loaded once but localStorage persists)
    const reloaded = await readTempLogs()
    expect(reloaded).toEqual({
      "2026-06-10": { cissp: { pagesRead: 15 } },
    })
  })

  it("handles corrupt JSON gracefully (returns empty object)", async () => {
    localStorage.setItem("web:temp_logs", "{not valid json")
    const store = await readTempLogs()
    expect(store).toEqual({})
  })

  it("serializes concurrent applyTempLog calls (no lost writes)", async () => {
    // Fire 5 concurrent applyTempLog calls for different courseIds
    await Promise.all([
      applyTempLog("2026-06-10", "cissp", 15),
      applyTempLog("2026-06-10", "oscp", 20),
      applyTempLog("2026-06-10", "secp", 25),
      applyTempLog("2026-06-10", "cbtn", 30),
      applyTempLog("2026-06-10", "ejpt", 35),
    ])
    const after = await readTempLogs()
    // All 5 should be present — no lost writes due to races
    expect(Object.keys(after["2026-06-10"])).toEqual(
      expect.arrayContaining(["cissp", "oscp", "secp", "cbtn", "ejpt"])
    )
    expect(Object.keys(after["2026-06-10"])).toHaveLength(5)
    expect(after["2026-06-10"]["cissp"].pagesRead).toBe(15)
    expect(after["2026-06-10"]["ejpt"].pagesRead).toBe(35)
  })
})
