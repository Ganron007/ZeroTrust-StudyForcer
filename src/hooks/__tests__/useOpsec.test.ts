import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOpsec, isOpsecOn, maskText } from "../useOpsec"

/**
 * Phase 0.5.5 — OPSEC mode tests.
 *
 * OPSEC mode masks sensitive info (course names, plan names, page
 * counts) for screen-sharing. Persisted to localStorage.
 */
describe("useOpsec hook", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute("data-opsec")
  })

  it("defaults to off", () => {
    const { result } = renderHook(() => useOpsec())
    expect(result.current.opsec).toBe(false)
  })

  it("setOpsec(true) turns it on and sets the data attribute", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    expect(result.current.opsec).toBe(true)
    expect(document.documentElement.getAttribute("data-opsec")).toBe("1")
  })

  it("setOpsec(false) turns it off and removes the data attribute", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    act(() => {
      result.current.setOpsec(false)
    })
    expect(result.current.opsec).toBe(false)
    expect(document.documentElement.hasAttribute("data-opsec")).toBe(false)
  })

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    expect(localStorage.getItem("ztsf:opsec")).toBe("1")
    act(() => {
      result.current.setOpsec(false)
    })
    expect(localStorage.getItem("ztsf:opsec")).toBeNull()
  })

  it("REGRESSION: setOpsec dispatches a window event for cross-instance sync", () => {
    const { result } = renderHook(() => useOpsec())
    const handler = vi.fn()
    window.addEventListener("ztsf:opsec-change", handler)
    act(() => {
      result.current.setOpsec(true)
    })
    expect(handler).toHaveBeenCalled()
    window.removeEventListener("ztsf:opsec-change", handler)
  })

  it("REGRESSION: setOpsec does NOT dispatch event if value unchanged", () => {
    const { result } = renderHook(() => useOpsec())
    const handler = vi.fn()
    window.addEventListener("ztsf:opsec-change", handler)
    // Initially opsec is false, setOpsec(false) again should not dispatch
    act(() => {
      result.current.setOpsec(false)
    })
    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener("ztsf:opsec-change", handler)
  })

  it("REGRESSION: window event listener syncs other instances", () => {
    const { result: a } = renderHook(() => useOpsec())
    const { result: b } = renderHook(() => useOpsec())
    expect(a.current.opsec).toBe(false)
    expect(b.current.opsec).toBe(false)
    act(() => {
      a.current.setOpsec(true)
    })
    expect(a.current.opsec).toBe(true)
    expect(b.current.opsec).toBe(true)  // synced via event
  })

  it("reads from localStorage on init", () => {
    localStorage.setItem("ztsf:opsec", "1")
    const { result } = renderHook(() => useOpsec())
    expect(result.current.opsec).toBe(true)
  })

  it("mask() returns the original text when OPSEC is off", () => {
    const { result } = renderHook(() => useOpsec())
    expect(result.current.mask("CISSP")).toBe("CISSP")
    expect(result.current.mask("1234 pages")).toBe("1234 pages")
  })

  it("mask() redacts text when OPSEC is on", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    expect(result.current.mask("My Plan")).toBe("█████ █████")
    expect(result.current.mask("Long Course Name")).toBe("█████ █████")
  })

  it("mask() preserves short strings as █████", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    expect(result.current.mask("A")).toBe("█████")
    expect(result.current.mask("AB")).toBe("█████")
    expect(result.current.mask("")).toBe("")
  })

  it("maskCount() returns the number as string when OPSEC is off", () => {
    const { result } = renderHook(() => useOpsec())
    expect(result.current.maskCount(15)).toBe("15")
    expect(result.current.maskCount(0)).toBe("0")
    expect(result.current.maskCount("42")).toBe("42")
  })

  it("maskCount() redacts to ▒▒ when OPSEC is on", () => {
    const { result } = renderHook(() => useOpsec())
    act(() => {
      result.current.setOpsec(true)
    })
    expect(result.current.maskCount(15)).toBe("▒▒")
    expect(result.current.maskCount(0)).toBe("▒▒")
    expect(result.current.maskCount("42")).toBe("▒▒")
  })
})

describe("isOpsecOn (read-only check)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns false when not set", () => {
    expect(isOpsecOn()).toBe(false)
  })

  it("returns true when set", () => {
    localStorage.setItem("ztsf:opsec", "1")
    expect(isOpsecOn()).toBe(true)
  })
})

describe("maskText helper", () => {
  it("redacts long strings to █████ █████", () => {
    expect(maskText("Hello World")).toBe("█████ █████")
  })

  it("redacts short strings to █████", () => {
    expect(maskText("Hi")).toBe("█████")
  })

  it("preserves empty strings", () => {
    expect(maskText("")).toBe("")
  })
})
