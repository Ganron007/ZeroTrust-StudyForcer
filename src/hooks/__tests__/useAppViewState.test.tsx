import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

// Mock CourseProvider — the hook depends on it for auto-activation.
const mockSwitchCourse = vi.fn()
const mockCourses = [
  { id: "cissp-10th-ed", name: "CISSP" },
  { id: "comptia-secai-cy0-001", name: "SecAI+" },
  { id: "oscp", name: "OSCP" },
]
vi.mock("../../../src/components/CourseProvider", () => ({
  useCourse: () => ({
    courses: mockCourses,
    activeCourseId: "cissp-10th-ed",
    switchCourse: mockSwitchCourse,
  }),
}))

import { useAppViewState } from "../useAppViewState"

const SELECTED_KEY = "ztsf:selected-courses"

/**
 * v2.8.0: Tests for the app view state hook.
 *
 * Covers the 5 concerns this hook consolidates: activeTab, fullscreen,
 * calendarSelectedDate, statsViewCourseId, and selectedCourseIds
 * (with its localStorage sync + auto-activate-on-single-selection).
 */

describe("useAppViewState — selectedCourseIds", () => {
  beforeEach(() => {
    localStorage.clear()
    mockSwitchCourse.mockClear()
  })

  it("starts with an empty set when no localStorage value", () => {
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.selectedCourseIds).toEqual(new Set())
  })

  it("hydrates from localStorage on mount", () => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(["cissp-10th-ed", "oscp"]))
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.selectedCourseIds).toEqual(new Set(["cissp-10th-ed", "oscp"]))
  })

  it("ignores malformed JSON in localStorage", () => {
    localStorage.setItem(SELECTED_KEY, "{not valid json")
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.selectedCourseIds).toEqual(new Set())
  })

  it("persists to localStorage when set", () => {
    const { result } = renderHook(() => useAppViewState())
    act(() => {
      result.current.setSelectedCourseIds(new Set(["cissp-10th-ed"]))
    })
    expect(JSON.parse(localStorage.getItem(SELECTED_KEY) ?? "[]")).toEqual(["cissp-10th-ed"])
  })

  it("filters out non-string values when hydrating", () => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(["a", 1, null, "b", true]))
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.selectedCourseIds).toEqual(new Set(["a", "b"]))
  })
})

describe("useAppViewState — activeTab + fullscreen", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("starts on calendar tab", () => {
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.activeTab).toBe("calendar")
  })

  it("setActiveTab switches tab", () => {
    const { result } = renderHook(() => useAppViewState())
    act(() => result.current.setActiveTab("progress"))
    expect(result.current.activeTab).toBe("progress")
  })

  it("starts not in fullscreen", () => {
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.isFullscreen).toBe(false)
  })

  it("toggleFullscreen calls requestFullscreen when not in fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.documentElement.requestFullscreen = requestFullscreen
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true })

    const { result } = renderHook(() => useAppViewState())
    await act(async () => {
      await result.current.toggleFullscreen()
    })
    expect(requestFullscreen).toHaveBeenCalled()
    expect(result.current.isFullscreen).toBe(true)
  })

  it("toggleFullscreen calls exitFullscreen when in fullscreen", async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = exitFullscreen
    Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true })

    const { result } = renderHook(() => useAppViewState())
    await act(async () => {
      await result.current.toggleFullscreen()
    })
    expect(exitFullscreen).toHaveBeenCalled()
    expect(result.current.isFullscreen).toBe(false)
  })

  it("toggleFullscreen swallows errors (no user gesture, secure context, etc.)", async () => {
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error("not allowed"))
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true })
    const { result } = renderHook(() => useAppViewState())
    await act(async () => {
      await result.current.toggleFullscreen()
    })
    // No throw — state stays at false since the API call rejected
    expect(result.current.isFullscreen).toBe(false)
  })
})

describe("useAppViewState — calendar + stats", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("calendarSelectedDate starts as null", () => {
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.calendarSelectedDate).toBeNull()
  })

  it("setCalendarSelectedDate accepts a YYYY-MM-DD string", () => {
    const { result } = renderHook(() => useAppViewState())
    act(() => result.current.setCalendarSelectedDate("2026-06-15"))
    expect(result.current.calendarSelectedDate).toBe("2026-06-15")
  })

  it("statsViewCourseId starts as null", () => {
    const { result } = renderHook(() => useAppViewState())
    expect(result.current.statsViewCourseId).toBeNull()
  })

  it("setStatsViewCourseId accepts a course id", () => {
    const { result } = renderHook(() => useAppViewState())
    act(() => result.current.setStatsViewCourseId("oscp"))
    expect(result.current.statsViewCourseId).toBe("oscp")
  })
})
