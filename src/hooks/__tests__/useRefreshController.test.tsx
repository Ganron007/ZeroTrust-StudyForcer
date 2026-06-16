import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRefreshController } from "../useRefreshController"

const mockLoadPlans = vi.fn()
vi.mock("../../../src/lib/plan-store", () => ({
  usePlanStore: (selector: (s: { loadPlans: () => Promise<void> }) => unknown) =>
    selector({ loadPlans: mockLoadPlans }),
}))

/**
 * v2.8.0: Tests for the refresh controller hook.
 *
 * Covers: trigger → loadPlans, spin state, triggerWithToast debounce.
 */

describe("useRefreshController", () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockLoadPlans.mockReset()
  })

  it("starts with tick=0, isRefreshing=false", () => {
    const { result } = renderHook(() => useRefreshController())
    expect(result.current.tick).toBe(0)
    expect(result.current.isRefreshing).toBe(false)
  })

  it("trigger() increments tick and calls loadPlans via the effect", () => {
    mockLoadPlans.mockResolvedValue(undefined)
    const { result } = renderHook(() => useRefreshController())
    act(() => result.current.trigger())
    expect(result.current.tick).toBe(1)
    // Effect runs after render — waitFor isn't strictly needed in this synchronous
    // test environment, but the call is queued.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockLoadPlans).toHaveBeenCalledTimes(1)
        resolve()
      }, 0)
    })
  })

  it("does NOT call loadPlans on the initial tick=0", () => {
    renderHook(() => useRefreshController())
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockLoadPlans).not.toHaveBeenCalled()
        resolve()
      }, 0)
    })
  })

  it("trigger() called N times → loadPlans called N times", () => {
    mockLoadPlans.mockResolvedValue(undefined)
    const { result } = renderHook(() => useRefreshController())
    act(() => result.current.trigger())
    act(() => result.current.trigger())
    act(() => result.current.trigger())
    expect(result.current.tick).toBe(3)
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(mockLoadPlans).toHaveBeenCalledTimes(3)
        resolve()
      }, 0)
    })
  })

  it("triggerWithToast() shows isRefreshing=true and calls the toast fn", () => {
    vi.useFakeTimers()
    mockLoadPlans.mockResolvedValue(undefined)
    const toastFn = vi.fn()
    const { result } = renderHook(() => useRefreshController())
    act(() => result.current.triggerWithToast(toastFn))
    expect(result.current.isRefreshing).toBe(true)
    expect(toastFn).toHaveBeenCalledTimes(1)
    expect(mockLoadPlans).toHaveBeenCalledTimes(1)
    // After 400ms, isRefreshing should reset
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.isRefreshing).toBe(false)
  })
})
