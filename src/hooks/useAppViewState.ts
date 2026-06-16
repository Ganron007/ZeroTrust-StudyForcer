import { useCallback, useEffect, useState } from "react"
import { useCourse } from "../components/CourseProvider"
import { useOverlayState } from "./useOverlayState"

/**
 * App-level view state — anything that's persisted across tab/overlay
 * switches and surfaced via props to multiple components lives here.
 *
 * Replaces the following useStates from App.tsx:
 *  - activeTab
 *  - isFullscreen
 *  - calendarSelectedDate
 *  - statsViewCourseId
 *  - selectedCourseIds (with the localStorage sync useEffect +
 *    auto-activate-on-single-selection useEffect)
 */

export type Tab = "calendar" | "list" | "progress" | "cert-path"

export type AppViewState = {
  activeTab: Tab
  setActiveTab: (t: Tab) => void

  isFullscreen: boolean
  toggleFullscreen: () => Promise<void>

  calendarSelectedDate: string | null
  setCalendarSelectedDate: (d: string | null) => void

  statsViewCourseId: string | null
  setStatsViewCourseId: (id: string | null) => void

  selectedCourseIds: Set<string>
  setSelectedCourseIds: (ids: Set<string>) => void
}

const SELECTED_COURSES_KEY = "ztsf:selected-courses"

function loadSelectedCourseIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SELECTED_COURSES_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((v) => typeof v === "string"))
  } catch {
    return new Set()
  }
}

export function useAppViewState(): AppViewState {
  const { courses, activeCourseId, switchCourse } = useCourse()

  const [activeTab, setActiveTabRaw] = useState<Tab>("calendar")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null)
  const [statsViewCourseId, setStatsViewCourseId] = useState<string | null>(null)
  const [selectedCourseIds, setSelectedCourseIdsRaw] = useState<Set<string>>(
    () => loadSelectedCourseIds(),
  )

  // Persist selectedCourseIds so the multi-course selection survives refreshes.
  useEffect(() => {
    try {
      localStorage.setItem(
        SELECTED_COURSES_KEY,
        JSON.stringify(Array.from(selectedCourseIds)),
      )
    } catch {
      // Non-critical — silently ignore quota errors.
    }
  }, [selectedCourseIds])

  // Auto-activate the sole selected course so single selection always shows stats.
  useEffect(() => {
    if (activeCourseId) return
    if (selectedCourseIds.size !== 1) return
    const id = Array.from(selectedCourseIds)[0]
    if (!courses.some((c) => c.id === id)) return
    switchCourse(id)
  }, [activeCourseId, selectedCourseIds, courses, switchCourse])

  const setActiveTab = useCallback((t: Tab) => setActiveTabRaw(t), [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        setIsFullscreen(false)
      } else {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch {
      // ignore — fullscreen requires user gesture + secure context
    }
  }, [])

  const setSelectedCourseIds = useCallback(
    (ids: Set<string>) => setSelectedCourseIdsRaw(ids),
    [],
  )

  return {
    activeTab,
    setActiveTab,
    isFullscreen,
    toggleFullscreen,
    calendarSelectedDate,
    setCalendarSelectedDate,
    statsViewCourseId,
    setStatsViewCourseId,
    selectedCourseIds,
    setSelectedCourseIds,
  }
}
