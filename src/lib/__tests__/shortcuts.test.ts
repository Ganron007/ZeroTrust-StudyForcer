import { describe, it, expect } from "vitest"
import { SHORTCUTS, groupedShortcuts } from "../shortcuts"

describe("shortcuts catalog (Phase 2.5)", () => {
  it("has at least 10 shortcuts defined", () => {
    expect(SHORTCUTS.length).toBeGreaterThanOrEqual(10)
  })

  it("every shortcut has a key, description, and category", () => {
    for (const s of SHORTCUTS) {
      expect(s.key).toBeTruthy()
      expect(s.description).toBeTruthy()
      expect(["navigation", "overlays", "view", "help"]).toContain(s.category)
    }
  })

  it("contains the standard navigation shortcuts (1, 2, 3, 4)", () => {
    const keys = SHORTCUTS.map((s) => s.key)
    expect(keys).toContain("1")
    expect(keys).toContain("2")
    expect(keys).toContain("3")
    expect(keys).toContain("4")
  })

  it("contains the ? shortcut for the cheatsheet", () => {
    const cheatsheet = SHORTCUTS.find((s) => s.key === "?")
    expect(cheatsheet).toBeDefined()
    expect(cheatsheet?.description).toMatch(/cheatsheet|shortcut/i)
  })

  it("contains the Esc shortcut", () => {
    const esc = SHORTCUTS.find((s) => s.key === "Escape")
    expect(esc).toBeDefined()
  })

  it("no duplicate keys", () => {
    const keys = SHORTCUTS.map((s) => s.key)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })

  it("groupedShortcuts groups by category", () => {
    const grouped = groupedShortcuts()
    expect(grouped.navigation.length).toBeGreaterThan(0)
    expect(grouped.overlays.length).toBeGreaterThan(0)
    expect(grouped.view.length).toBeGreaterThan(0)
    // help is empty unless explicitly added
    expect(grouped.help).toBeInstanceOf(Array)
  })

  it("every shortcut appears in exactly one group", () => {
    const grouped = groupedShortcuts()
    const groupedCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)
    expect(groupedCount).toBe(SHORTCUTS.length)
  })
})
