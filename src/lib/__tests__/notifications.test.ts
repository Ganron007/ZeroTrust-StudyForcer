import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  loadSettings,
  saveSettings,
  isNativeAvailable,
  sendNotification,
  scheduleDaily,
  type NotificationSettings,
} from "../notifications"

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe("notifications — settings persistence", () => {
  it("returns defaults when localStorage is empty", () => {
    const s = loadSettings()
    expect(s.enabled).toBe(false)
    expect(s.dailyTime).toBe("18:00")
    expect(s.labsAlert).toBe(true)
  })

  it("round-trips settings through localStorage", () => {
    const custom: NotificationSettings = { enabled: true, dailyTime: "09:30", labsAlert: false }
    saveSettings(custom)
    const loaded = loadSettings()
    expect(loaded).toEqual(custom)
  })

  it("merges with defaults for partial overrides", () => {
    localStorage.setItem("ztsf:notification-settings", JSON.stringify({ enabled: true }))
    const s = loadSettings()
    expect(s.enabled).toBe(true)
    expect(s.dailyTime).toBe("18:00") // default
    expect(s.labsAlert).toBe(true) // default
  })

  it("returns defaults if localStorage contains garbage", () => {
    localStorage.setItem("ztsf:notification-settings", "{ not valid json")
    const s = loadSettings()
    expect(s).toEqual({ enabled: false, dailyTime: "18:00", labsAlert: true })
  })
})

describe("notifications — isNativeAvailable", () => {
  it("returns false in test environment (no TAURI internals)", () => {
    expect(isNativeAvailable()).toBe(false)
  })
})

describe("notifications — sendNotification", () => {
  it("returns false in non-Tauri environment without throwing", async () => {
    const result = await sendNotification("Test", "Body")
    expect(result).toBe(false)
  })
})

describe("notifications — scheduleDaily", () => {
  it("returns a no-op cancel function when disabled", () => {
    const cancel = scheduleDaily({ enabled: false, dailyTime: "18:00", labsAlert: true }, () => {})
    expect(cancel).toBeInstanceOf(Function)
    cancel() // should not throw
  })

  it("returns a cancel function that can be called", () => {
    vi.useFakeTimers()
    const onFire = vi.fn()
    const cancel = scheduleDaily({ enabled: true, dailyTime: "18:00", labsAlert: true }, onFire)
    expect(cancel).toBeInstanceOf(Function)
    cancel()
    vi.advanceTimersByTime(1000 * 60 * 60 * 24) // 24h
    expect(onFire).not.toHaveBeenCalled()
  })

  it("does not fire before the configured time", () => {
    vi.useFakeTimers()
    // Set time to 2026-04-01 17:59:00 (1 minute before 18:00)
    const now = new Date("2026-04-01T17:59:00")
    vi.setSystemTime(now)
    const onFire = vi.fn()
    const cancel = scheduleDaily({ enabled: true, dailyTime: "18:00", labsAlert: true }, onFire)
    // Advance 30 seconds — still before 18:00
    vi.advanceTimersByTime(30_000)
    expect(onFire).not.toHaveBeenCalled()
    cancel()
  })
})
