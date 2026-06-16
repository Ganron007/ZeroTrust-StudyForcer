import { useEffect } from "react"
import type { StudyDay } from "@/lib/cissp-data"

export type Tab = "calendar" | "list" | "progress" | "cert-path"

export type ShortcutActions = {
  showCheatsheet: () => void
  hideCheatsheet: () => void
  setActiveTab: (tab: Tab) => void
  openPlanner: (courseId: string | null) => void
  closePlanner: () => void
  openOnlineLabs: () => void
  closeOnlineLabs: () => void
  toggleNews: () => void
  closeNews: () => void
  closeTimerLog: () => void
  toggleModePicker: () => void
  closeModePicker: () => void
  toggleThemePicker: () => void
  closeThemePicker: () => void
  closeNotificationSettings: () => void
  toggleFullscreen: () => void
  refresh: () => void
}

export type UseKeyboardShortcutsOptions = {
  activeCourseId: string | null
  isPlannerOpen: boolean
  isOnlineLabsOpen: boolean
  isNewsOpen: boolean
  showTimerLog: boolean
  showModePicker: boolean
  showThemePicker: boolean
  showNotificationSettings: boolean
  showCheatsheet: boolean
  logDialogDay: StudyDay | null
  actions: ShortcutActions
}

/**
 * Global keyboard shortcut handler.
 *
 * - 1/2/3/4 switch tabs
 * - P opens planner
 * - L opens labs
 * - N toggles news
 * - F toggles fullscreen
 * - R refreshes plans
 * - T toggles theme picker
 * - ? opens cheatsheet
 * - Esc closes the topmost overlay or cheatsheet
 *
 * Shortcuts are suppressed when the user is typing in a form field or when
 * certain modal/popover state is open.
 */
export function useKeyboardShortcuts({
  activeCourseId,
  isPlannerOpen,
  isOnlineLabsOpen,
  isNewsOpen,
  showTimerLog,
  showModePicker,
  showThemePicker,
  showNotificationSettings,
  showCheatsheet,
  logDialogDay,
  actions,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "?") {
        if (!showCheatsheet) {
          e.preventDefault()
          actions.showCheatsheet()
        }
        return
      }

      if (e.key === "Escape") {
        if (showCheatsheet) {
          e.preventDefault()
          actions.hideCheatsheet()
          return
        }
        if (logDialogDay || showTimerLog || showModePicker || showThemePicker || showNotificationSettings) return
      }

      if (logDialogDay || showTimerLog || showModePicker || showThemePicker || showNotificationSettings || showCheatsheet) {
        return
      }

      switch (e.key) {
        case "1":
          actions.setActiveTab("calendar")
          break
        case "2":
          actions.setActiveTab("list")
          break
        case "3":
          actions.setActiveTab("progress")
          break
        case "4":
          actions.setActiveTab("cert-path")
          break
        case "p":
        case "P":
          if (!isPlannerOpen) actions.openPlanner(activeCourseId)
          break
        case "l":
        case "L":
          if (!isOnlineLabsOpen) actions.openOnlineLabs()
          break
        case "n":
        case "N":
          actions.toggleNews()
          break
        case "Escape":
          if (isNewsOpen) actions.closeNews()
          else if (isOnlineLabsOpen) actions.closeOnlineLabs()
          else if (isPlannerOpen) actions.closePlanner()
          else if (showTimerLog) actions.closeTimerLog()
          else if (showModePicker) actions.closeModePicker()
          else if (showThemePicker) actions.closeThemePicker()
          else if (showNotificationSettings) actions.closeNotificationSettings()
          break
        case "f":
        case "F":
          actions.toggleFullscreen()
          break
        case "r":
        case "R":
          actions.refresh()
          break
        case "t":
        case "T":
          actions.toggleThemePicker()
          break
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    activeCourseId,
    isPlannerOpen,
    isOnlineLabsOpen,
    isNewsOpen,
    showTimerLog,
    showModePicker,
    showThemePicker,
    showNotificationSettings,
    showCheatsheet,
    logDialogDay,
    actions,
  ])
}
