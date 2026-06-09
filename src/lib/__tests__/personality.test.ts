import { describe, it, expect, beforeEach, vi } from "vitest"

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

import {
  getLabel,
  getToast,
  getEmpty,
  getGreeting,
  getLoading,
  getTips,
  formatStr,
  getSavedMode,
  saveMode,
  MODE_OPTIONS,
  LABELS,
  TOASTS,
  EMPTY,
  GREETINGS,
  LOADING,
  TIPS,
} from "../personality"
import type { PersonalityMode } from "../personality"

describe("personality — fallback behavior", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it("getLabel returns the raw key for an unknown key in any mode", () => {
    const result = getLabel("standard", "this-key-does-not-exist")
    expect(result).toBe("this-key-does-not-exist")
  })

  it("getLabel returns a non-empty string for known keys", () => {
    expect(getLabel("standard", "appTitle")).toBe("ZeroTrust.StudyForcer")
    expect(getLabel("standard", "calendar")).toBe("Calendar")
    expect(getLabel("standard", "schedule")).toBe("Schedule")
  })

  it("getLabel falls back to standard mode when the active mode is missing a key", () => {
    const result = getLabel("drill-sergeant", "appTitle")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("getToast returns the raw key for an unknown toast key", () => {
    const result = getToast("standard", "fake-toast-key")
    expect(result).toBe("fake-toast-key")
  })

  it("getEmpty returns a non-empty string", () => {
    const result = getEmpty("standard", "noReadingToday")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("getGreeting returns a non-empty string for each time of day", () => {
    for (const time of ["morning", "afternoon", "evening"] as const) {
      const result = getGreeting("standard", time)
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    }
  })

  it("getGreeting falls back to standard mode", () => {
    const result = getGreeting("conspiracy", "morning")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("getLoading returns a non-empty string", () => {
    const result = getLoading("standard", "plans")
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  it("getTips returns an array", () => {
    const tips = getTips("standard")
    expect(Array.isArray(tips)).toBe(true)
    expect(tips.length).toBeGreaterThan(0)
  })

  it("getTips falls back to standard mode for modes that don't override", () => {
    const tips = getTips("influencer")
    expect(Array.isArray(tips)).toBe(true)
    expect(tips.length).toBeGreaterThan(0)
  })
})

describe("personality — formatStr", () => {
  it("replaces {var} placeholders with values from params", () => {
    const result = formatStr("Hello {name}, you read {pages} pages", { name: "Alice", pages: 42 })
    expect(result).toBe("Hello Alice, you read 42 pages")
  })

  it("leaves unknown placeholders as-is", () => {
    const result = formatStr("Hello {name}", {})
    expect(result).toBe("Hello {name}")
  })

  it("handles multiple occurrences of the same placeholder", () => {
    const result = formatStr("{x} + {x} = {y}", { x: 1, y: 2 })
    expect(result).toBe("1 + 1 = 2")
  })

  it("converts numbers to strings", () => {
    const result = formatStr("Page {value}", { value: 0 })
    expect(result).toBe("Page 0")
  })
})

describe("personality — mode persistence", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it("getSavedMode returns 'standard' when no mode is saved", () => {
    expect(getSavedMode()).toBe("standard")
  })

  it("saveMode then getSavedMode round-trips", () => {
    saveMode("drill-sergeant")
    expect(getSavedMode()).toBe("drill-sergeant")
    saveMode("cyberpunk")
    expect(getSavedMode()).toBe("cyberpunk")
  })

  it("getSavedMode returns 'standard' for an invalid saved value", () => {
    localStorageMock.setItem("ztsf:personality-mode", "invalid-mode")
    expect(getSavedMode()).toBe("standard")
  })
})

// E5 fix: use describe.each so per-mode failures are clearly labeled in
// the test output instead of buried in a generic loop.
describe.each(MODE_OPTIONS.map((m) => m.id))("personality — mode '%s' has non-empty data", (mode) => {
  const labelKeys = Object.keys(LABELS["standard"])
  const toastKeys = Object.keys(TOASTS["standard"])
  const emptyKeys = Object.keys(EMPTY["standard"])
  const loadingKeys = Object.keys(LOADING["standard"])

  it("has labels for every standard key (directly or via fallback)", () => {
    for (const key of labelKeys) {
      const val = getLabel(mode, key)
      expect(typeof val).toBe("string")
      expect(val.length).toBeGreaterThan(0)
    }
  })

  it("has toast templates for every standard key", () => {
    for (const key of toastKeys) {
      const val = getToast(mode, key)
      expect(typeof val).toBe("string")
      expect(val.length).toBeGreaterThan(0)
    }
  })

  it("has empty-state messages for every standard key", () => {
    for (const key of emptyKeys) {
      const val = getEmpty(mode, key)
      expect(typeof val).toBe("string")
      expect(val.length).toBeGreaterThan(0)
    }
  })

  it("has at least one override in its own LABELS map", () => {
    const ownKeys = Object.keys(LABELS[mode] ?? {})
    expect(ownKeys.length).toBeGreaterThan(0)
  })

  it("has greetings for all times of day", () => {
    for (const time of ["morning", "afternoon", "evening"] as const) {
      const val = getGreeting(mode, time)
      expect(typeof val).toBe("string")
      expect(val.length).toBeGreaterThan(0)
    }
  })

  it("has a non-empty tips array", () => {
    const tips = getTips(mode)
    expect(tips.length).toBeGreaterThan(0)
  })

  it("has loading messages for every standard key", () => {
    for (const key of loadingKeys) {
      const val = getLoading(mode, key)
      expect(typeof val).toBe("string")
      expect(val.length).toBeGreaterThan(0)
    }
  })
})
