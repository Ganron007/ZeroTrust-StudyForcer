import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOverlayState } from "../useOverlayState"

/**
 * v2.8.0: Tests for the generic overlay state hook.
 *
 * The hook is the foundation of the dialog state machine extraction —
 * every "this overlay can be open with optional state" pattern in
 * App.tsx now lives here.
 */

describe("useOverlayState", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("starts closed with the initial state", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    expect(result.current.isOpen).toBe(false)
    expect(result.current.state).toEqual({ courseId: null })
  })

  it("open() sets isOpen=true and preserves initial state when no args passed", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
    expect(result.current.state).toEqual({ courseId: null })
  })

  it("open(args) replaces state with the passed args", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    act(() => result.current.open({ courseId: "cissp-10th-ed" }))
    expect(result.current.isOpen).toBe(true)
    expect(result.current.state).toEqual({ courseId: "cissp-10th-ed" })
  })

  it("close() flips isOpen to false and resets state to initial", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    act(() => result.current.open({ courseId: "sec-301" }))
    expect(result.current.state.courseId).toBe("sec-301")

    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.state).toEqual({ courseId: null })
  })

  it("toggle() flips the open state and resets state on close", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.open({ courseId: "oscp" }))
    expect(result.current.state.courseId).toBe("oscp")
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.state).toEqual({ courseId: null })
  })

  it("setState() replaces state without changing open status", () => {
    const { result } = renderHook(() =>
      useOverlayState<{ courseId: string | null }>({ courseId: null }),
    )
    act(() => result.current.setState({ courseId: "a" }))
    expect(result.current.isOpen).toBe(false)
    expect(result.current.state.courseId).toBe("a")

    act(() => result.current.setState((prev) => ({ courseId: prev.courseId + "b" })))
    expect(result.current.state.courseId).toBe("ab")
  })

  it("two independent instances do not share state", () => {
    const a = renderHook(() => useOverlayState<{ n: number }>({ n: 0 }))
    const b = renderHook(() => useOverlayState<{ n: number }>({ n: 0 }))
    act(() => a.result.current.open({ n: 1 }))
    act(() => b.result.current.toggle())
    expect(a.result.current.isOpen).toBe(true)
    expect(a.result.current.state.n).toBe(1)
    expect(b.result.current.isOpen).toBe(true)
    expect(b.result.current.state.n).toBe(0) // initial — b never received args

    act(() => a.result.current.close())
    expect(a.result.current.isOpen).toBe(false)
    expect(b.result.current.isOpen).toBe(true) // independent
  })

  it("action callbacks have stable identity across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useOverlayState<{ n: number }>({ n: 0 }),
    )
    const openBefore = result.current.open
    const closeBefore = result.current.close
    const toggleBefore = result.current.toggle
    act(() => result.current.open({ n: 1 }))
    rerender()
    // After re-render, identity should be the same (useCallback deps are [])
    expect(result.current.open).toBe(openBefore)
    expect(result.current.close).toBe(closeBefore)
    expect(result.current.toggle).toBe(toggleBefore)
  })
})
