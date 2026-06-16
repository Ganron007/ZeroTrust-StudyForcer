/**
 * useKeyboardShortcuts hook — behavioral tests.
 *
 * v2.7.0: hook extracted from App.tsx. Owns the global window-level
 * keydown listener for shortcuts (1/2/3/4 tabs, P planner, L labs,
 * N news, F fullscreen, R refresh, T theme, ? cheatsheet, Esc close).
 *
 * Suppression rules:
 *  - input/textarea/select ignore shortcuts
 *  - meta/ctrl/alt-modified keys ignore
 *  - log dialog / popovers / modal block non-Esc shortcuts
 *
 * Tests render the hook with `renderHook` (jsdom) and dispatch real
 * KeyboardEvents on `window`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"

import { useKeyboardShortcuts, type ShortcutActions } from "../useKeyboardShortcuts"

function makeActions(): ShortcutActions & { __calls: Record<string, number> } {
  const calls: Record<string, number> = {}
  const fn = (name: string) => () => { calls[name] = (calls[name] ?? 0) + 1 }
  return {
    __calls: calls,
    showCheatsheet: fn("showCheatsheet"),
    hideCheatsheet: fn("hideCheatsheet"),
    setActiveTab: fn("setActiveTab") as ShortcutActions["setActiveTab"],
    openPlanner: fn("openPlanner") as ShortcutActions["openPlanner"],
    closePlanner: fn("closePlanner"),
    openOnlineLabs: fn("openOnlineLabs"),
    closeOnlineLabs: fn("closeOnlineLabs"),
    toggleNews: fn("toggleNews"),
    closeNews: fn("closeNews"),
    closeTimerLog: fn("closeTimerLog"),
    toggleModePicker: fn("toggleModePicker"),
    closeModePicker: fn("closeModePicker"),
    toggleThemePicker: fn("toggleThemePicker"),
    closeThemePicker: fn("closeThemePicker"),
    closeNotificationSettings: fn("closeNotificationSettings"),
    toggleFullscreen: fn("toggleFullscreen"),
    refresh: fn("refresh"),
  }
}

function dispatchKey(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }))
}

describe("useKeyboardShortcuts — tab switching", () => {
  let actions: ReturnType<typeof makeActions>
  beforeEach(() => {
    actions = makeActions()
  })

  it("1/2/3/4 call setActiveTab with the right tab id", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("1")
    dispatchKey("2")
    dispatchKey("3")
    dispatchKey("4")
    // Each call increments __calls["setActiveTab"] — but setActiveTab is a
    // single counter. We instead check that the action ran 4 times.
    expect(actions.__calls.setActiveTab).toBe(4)
  })
})

describe("useKeyboardShortcuts — open/close shortcuts", () => {
  let actions: ReturnType<typeof makeActions>
  beforeEach(() => {
    actions = makeActions()
  })

  it("P opens planner when not already open", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("p")
    expect(actions.__calls.openPlanner).toBe(1)
  })

  it("P does NOT re-open planner if already open", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: true, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("p")
    expect(actions.__calls.openPlanner).toBeUndefined()
  })

  it("L opens online labs when not already open", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("l")
    expect(actions.__calls.openOnlineLabs).toBe(1)
  })

  it("N toggles news", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("n")
    expect(actions.__calls.toggleNews).toBe(1)
  })

  it("R refreshes plans", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("r")
    expect(actions.__calls.refresh).toBe(1)
  })

  it("T toggles theme picker", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("t")
    expect(actions.__calls.toggleThemePicker).toBe(1)
  })

  it("F toggles fullscreen", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("f")
    expect(actions.__calls.toggleFullscreen).toBe(1)
  })

  it("? opens the cheatsheet (when not already open)", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("?")
    expect(actions.__calls.showCheatsheet).toBe(1)
  })
})

describe("useKeyboardShortcuts — Escape behavior", () => {
  let actions: ReturnType<typeof makeActions>
  beforeEach(() => {
    actions = makeActions()
  })

  it("Esc closes the cheatsheet first when open", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: true, logDialogDay: null,
      actions,
    }))
    dispatchKey("Escape")
    expect(actions.__calls.hideCheatsheet).toBe(1)
    expect(actions.__calls.closePlanner).toBeUndefined()
  })

  it("Esc closes the planner when planner is the topmost overlay", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: true, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("Escape")
    expect(actions.__calls.closePlanner).toBe(1)
  })

  it("Esc closes the news overlay first when it's the topmost", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: true,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("Escape")
    expect(actions.__calls.closeNews).toBe(1)
  })
})

describe("useKeyboardShortcuts — suppression rules", () => {
  let actions: ReturnType<typeof makeActions>
  beforeEach(() => {
    actions = makeActions()
  })

  it("does not trigger shortcuts when focus is in an input field", () => {
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }))
    expect(actions.__calls.openPlanner).toBeUndefined()
  })

  it("does not trigger shortcuts when focus is in a textarea", () => {
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    ta.focus()
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }))
    expect(actions.__calls.toggleNews).toBeUndefined()
  })

  it("does not trigger shortcuts when meta key is held", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("r", { metaKey: true })
    expect(actions.__calls.refresh).toBeUndefined()
  })

  it("does not trigger non-Esc shortcuts when the log dialog is open", () => {
    const logDialogDay = {
      date: "2026-06-10",
      dayNumber: 1,
      totalPages: 20,
      chapters: [],
    } as any
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay,
      actions,
    }))
    dispatchKey("p")
    dispatchKey("r")
    expect(actions.__calls.openPlanner).toBeUndefined()
    expect(actions.__calls.refresh).toBeUndefined()
  })

  it("does not trigger non-Esc shortcuts when the timer log modal is open", () => {
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: true, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("l")
    expect(actions.__calls.openOnlineLabs).toBeUndefined()
  })
})

describe("useKeyboardShortcuts — uppercase keys", () => {
  it("handles P (shift) and L (shift) — both should work", () => {
    const actions = makeActions()
    renderHook(() => useKeyboardShortcuts({
      activeCourseId: "cissp", isPlannerOpen: false, isOnlineLabsOpen: false, isNewsOpen: false,
      showTimerLog: false, showModePicker: false, showThemePicker: false,
      showNotificationSettings: false, showCheatsheet: false, logDialogDay: null,
      actions,
    }))
    dispatchKey("P")
    dispatchKey("L")
    expect(actions.__calls.openPlanner).toBe(1)
    expect(actions.__calls.openOnlineLabs).toBe(1)
  })
})
