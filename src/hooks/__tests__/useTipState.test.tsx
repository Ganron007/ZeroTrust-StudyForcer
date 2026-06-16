import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTipState } from "../useTipState"
import type { PersonalityMode } from "../../lib/personality"

/**
 * v2.8.0: Tests for the tip popup state hook.
 *
 * Covers: tip show/hide, tip round-robin, current tip tracking,
 * mode-change re-seed.
 */

describe("useTipState", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts with the tip popup closed", () => {
    const { result } = renderHook(() => useTipState("standard"))
    expect(result.current.showTip.isOpen).toBe(false)
    expect(result.current.tipNumber).toBeGreaterThanOrEqual(1)
    expect(result.current.totalTips).toBeGreaterThan(0)
    expect(result.current.currentTip).toBeTruthy()
  })

  it("open() sets isOpen=true on the showTip controller", () => {
    const { result } = renderHook(() => useTipState("standard"))
    act(() => result.current.showTip.open())
    expect(result.current.showTip.isOpen).toBe(true)
  })

  it("close() resets the controller and isOpen=false", () => {
    const { result } = renderHook(() => useTipState("standard"))
    act(() => result.current.showTip.open())
    act(() => result.current.showTip.close())
    expect(result.current.showTip.isOpen).toBe(false)
  })

  it("nextTip() advances the tip round-robin", () => {
    const { result } = renderHook(() => useTipState("standard"))
    const first = result.current.currentTip
    const firstNum = result.current.tipNumber
    act(() => result.current.nextTip())
    const secondNum = result.current.tipNumber
    // tipNumber should advance (cycling past total)
    const advanced = firstNum === result.current.totalTips
      ? secondNum === 1
      : secondNum === firstNum + 1
    expect(advanced).toBe(true)
    // And the current tip should be a string (don't assert specific content — it's random)
    expect(typeof result.current.currentTip).toBe("string")
    // At least one of them should be a non-empty string
    expect(first.length).toBeGreaterThan(0)
  })

  it("re-seeds the tip pool when the mode changes", () => {
    // Different modes have different tip sets in personality.ts. Just verify
    // the hook doesn't throw and the current tip stays a non-empty string
    // after a mode change.
    const { result, rerender } = renderHook(
      ({ mode }: { mode: PersonalityMode }) => useTipState(mode),
      { initialProps: { mode: "standard" as PersonalityMode } },
    )
    const beforeModeSwitch = result.current.currentTip
    expect(beforeModeSwitch).toBeTruthy()

    rerender({ mode: "drill-sergeant" as PersonalityMode })
    // After mode change, the tip is freshly picked from the new mode's set
    expect(result.current.currentTip).toBeTruthy()
  })
})
