import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { getTotalPages, mergeSchedules, DEFAULT_STUDY_DAYS, type StudyDay, generateSchedule, getOrderedChapters, tagChaptersWithCourseId, dedupeScheduleByDate } from "./lib/cissp-data"
import { planStorage, type StudyPlan } from "./lib/plan-storage"
import { usePlanStore } from "./lib/plan-store"
import { syncStudyPlan } from "./lib/plan-engine"
import { CourseProvider, useCourse } from "./components/CourseProvider"
import { sanitizeSvg } from "./lib/sanitize-svg"
import { now, nowDate } from "./lib/clock"
import ScheduleView from "./components/ScheduleView"
import ExamCountdownBand from "./components/ExamCountdownBand"
import ExamAlertBanner from "./components/ExamAlertBanner"
import ScheduleList from "./components/ScheduleList"
import ProgressDashboard from "./components/ProgressDashboard"
import CertPathView from "./components/CertPathView"
import SecurityNewsFeed from "./components/SecurityNewsFeed"
import LabDashboard from "./components/LabDashboard"
import CourseSelector from "./components/CourseSelector"
import PlannerPage from "./components/PlannerPage"
import CourseBuilder from "./components/CourseBuilder"
import DailyBriefing from "./components/DailyBriefing"
import SidebarLabsStatus from "./components/SidebarLabsStatus"
import SidebarNewsHighlights from "./components/SidebarNewsHighlights"
import StreakChip from "./components/StreakChip"
import NotificationSettingsPanel from "./components/NotificationSettingsPanel"
import KeyboardShortcutsCheatsheet from "./components/KeyboardShortcutsCheatsheet"
import { scheduleDaily, loadSettings as loadNotificationSettings, sendNotification } from "./lib/notifications"
import { useFocusTrap } from "./hooks/useFocusTrap"
import { useOpsec } from "./hooks/useOpsec"
import { ThemeProvider, useTheme } from "./components/ThemeProvider"
import StudyTimer from "./components/StudyTimer"
import WallClock from "./components/WallClock"
import NotificationToast, { showToast } from "./components/NotificationToast"
import { PersonalityProvider } from "./components/PersonalityProvider"
import type { CourseConfig, Chapter } from "./types/course"
import { computeTotalPages, getTrackingLabels } from "./types/course"
import { useStudyLogging } from "./hooks/useStudyLogging"
import { useSchedule, type CourseStat } from "./hooks/useSchedule"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"
import {
  LayoutGrid, List, BarChart3, Settings,
  GraduationCap, Award,
  FlaskConical, Newspaper,
} from "lucide-react"
import { downloadJson, readJsonFile } from "@/lib/export-utils"
import type { Theme } from "./components/ThemeProvider"
import LogDialog from "./components/LogDialog"
import TipPopup from "./components/TipPopup"
import { createTipPicker } from "./lib/tips"
import { usePersonality } from "./components/PersonalityProvider"
import { formatStr, type PersonalityMode } from "./lib/personality"
import { runAutoBackup } from "./lib/auto-backup"
import { localToday } from "./lib/date-utils"
import { migrateLegacyKeys, KEYS } from "./lib/storage-keys"
import AppHeader, { type AppHeaderActions } from "./components/AppHeader"
import { StatsBar } from "./components/StatsBar"
import { SprintBanner } from "./components/SprintBanner"
import { PostmortemBanner } from "./components/PostmortemBanner"
import BurnDownView from "./components/BurnDownView"
import { OverlayManager } from "./components/OverlayManager"
import { TimerLogDialog } from "./components/TimerLogDialog"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { useOverlayState } from "./hooks/useOverlayState"
import { useAppViewState, type Tab } from "./hooks/useAppViewState"
import { useTipState } from "./hooks/useTipState"
import { useRefreshController } from "./hooks/useRefreshController"

// X2: Migrate legacy bare localStorage keys to ztsf: prefix on first boot
migrateLegacyKeys()

function AppContent() {
  const { theme, setTheme } = useTheme()
  const { label, toast: tToast, empty, greeting, loading, mode, setMode } = usePersonality()
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [showNotificationSettings, setShowNotificationSettings] = useState(false)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  // Phase 0.5.5: OPSEC mode hook
  const { opsec, setOpsec, mask, maskCount } = useOpsec()

  // Phase 2.5: Focus traps for popovers
  const themePopoverRef = useFocusTrap<HTMLDivElement>({
    active: showThemePicker,
    onEscape: () => setShowThemePicker(false),
  })
  const modePopoverRef = useFocusTrap<HTMLDivElement>({
    active: showModePicker,
    onEscape: () => setShowModePicker(false),
  })
  const notifPopoverRef = useFocusTrap<HTMLDivElement>({
    active: showNotificationSettings,
    onEscape: () => setShowNotificationSettings(false),
  })
  const {
    activeCourse,
    activeCourseId,
    courses,
    logoSvg,
    switchCourse,
    refreshCourses,
    isLoading: courseLoading,
  } = useCourse()

  // ── Zustand store — single source of truth ─────────────────────────────
  const allPlans = usePlanStore(s => s.allPlans)
  const activePlanIds = usePlanStore(s => s.activePlanIds)
  const primaryActivePlanId = usePlanStore(s => s.primaryActivePlanId)
  const isLoading = usePlanStore(s => s.isLoading)
  const loadPlans = usePlanStore(s => s.loadPlans)
  const storeSetActivePlanIds = usePlanStore(s => s.setActivePlanIds)
  const storeSetPrimaryActivePlanId = usePlanStore(s => s.setPrimaryActivePlanId)
  const storeUpdatePlan = usePlanStore(s => s.updatePlan)

  // ── Derived from store ───────────────────────────────────────────────────
  const plans = useMemo(
    () => allPlans.filter(p => p.courseId === activeCourseId && activePlanIds.includes(p.id)),
    [allPlans, activeCourseId, activePlanIds],
  )
  const primaryPlan = useMemo(
    () => allPlans.find(p => p.id === primaryActivePlanId) ?? null,
    [allPlans, primaryActivePlanId],
  )
  const studyDays = primaryPlan?.studyDays ?? DEFAULT_STUDY_DAYS
  const completedDays = useMemo(
    () => new Set(Object.keys(primaryPlan?.dailyLog ?? {})),
    [primaryPlan],
  )

  // v2.8.0: Dialog state machine extracted into hooks.
  // App.tsx no longer owns overlay open/close flags — they're in useOverlayState.
  const view = useAppViewState()
  const {
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
  } = view

  // Five overlay controllers (replaces 5 useState pairs from App.tsx).
  const onlineLabs = useOverlayState<null>(null)
  const news = useOverlayState<null>(null)
  const courseBuilder = useOverlayState<null>(null)
  const planner = useOverlayState<{ initialCourseId: string | null }>({
    initialCourseId: null,
  })
  const timerLog = useOverlayState<{ minutes: number }>({ minutes: 0 })

  // Refresh controller (replaces refreshTick + refreshing + the useEffect).
  const refresh = useRefreshController()

  // Tip popup state (replaces showTip + tipPicker + currentTip).
  const tip = useTipState(mode)

  const safeLogoSvg = useMemo(() => (logoSvg ? sanitizeSvg(logoSvg) : null), [logoSvg])

  // ── Boot: load plans from store (single source of truth) ─────────────────
  useEffect(() => {
    if (courseLoading) return
    loadPlans()
  }, [loadPlans, courseLoading])

  // Phase 2.4: Auto-backup. Snapshot the current plan set to
  // <appData>/backups/YYYY-MM-DD.json on every plan-store mutation.
  // The Rust command is idempotent (no-op if today's file exists), and
  // we throttle to one backup per day. Initial run is triggered after
  // the first plan load completes.
  const initialBackupRanRef = useRef(false)
  useEffect(() => {
    if (allPlans.length === 0 && !initialBackupRanRef.current) {
      // Still loading — wait until we have at least one plan snapshot
      // (or until loadPlans finishes, in which case we backup an empty set).
      return
    }
    if (!initialBackupRanRef.current) {
      // First valid run — back up immediately.
      initialBackupRanRef.current = true
      runAutoBackup().catch((e) => console.warn("[auto-backup] initial run failed:", e))
      return
    }
    // Subsequent runs are throttled inside runAutoBackup (one-per-day).
    runAutoBackup().catch((e) => console.warn("[auto-backup] throttled run failed:", e))
  }, [allPlans, activePlanIds])

  // Reconcile primaryActivePlanId when the active course changes. switchCourse
  // doesn't touch the primary, so after a course switch the primary often points
  // at a plan for the previous course — which makes the stats bar look broken
  // (missing pill + blank grid). Re-point it at the first active plan for the
  // current course whenever it goes stale.
  useEffect(() => {
    if (!activeCourseId) return
    if (plans.length === 0) return
    if (primaryActivePlanId && plans.some((p) => p.id === primaryActivePlanId)) return
    storeSetPrimaryActivePlanId(plans[0].id)
  }, [activeCourseId, plans, primaryActivePlanId, storeSetPrimaryActivePlanId])

  // Phase 2.2: Native OS notification scheduler. Re-arms whenever the
  // user toggles the setting or changes the time. The callback is invoked
  // at the configured daily time, even if the app is in the background.
  useEffect(() => {
    const settings = loadNotificationSettings()
    const cancel = scheduleDaily(settings, async (today) => {
      // If today's already logged, skip the notification.
      const hasLoggedToday = completedDays.has(today)
      if (hasLoggedToday) return
      const sent = await sendNotification(
        label("notificationReminderTitle"),
        formatStr(tToast("notificationReminderBody"), { date: today }),
      )
      if (!sent) {
        // Fall back to in-app toast if native send failed.
        showToast(formatStr(tToast("notificationReminderBody"), { date: today }), "info")
      }
    })
    return cancel
    // Re-arm whenever the settings panel opens (the user may have
    // toggled enabled/time). We also depend on `label` so personality
    // changes re-arm with the new template.
  }, [showNotificationSettings, label, tToast, completedDays])

  // ── Auto-save REMOVED — persistence is handled by Zustand store actions ──

  // Short label for a course id (shortens the two seed courses; falls back to name).
  // Declared before baseSchedule so baseSchedule can call it on first render.
  const courseLabel = useCallback((id: string) => {
    if (id === "cissp-10th-ed") return "CISSP"
    if (id === "comptia-secai-cy0-001") return "SecAI+"
    return courses.find((c) => c.id === id)?.name ?? id
  }, [courses])

  // ── Schedule + stats (derived state) ────────────────────────────────────────
  const { schedule, selectedCoursesStats, showMerged } = useSchedule({
    allPlans,
    activePlanIds,
    activeCourseId,
    activeCourse,
    primaryActivePlanId,
    courses,
    selectedCourseIds,
    courseLabel,
  })

  // Refresh effect — moved into useRefreshController
  // (The hook exposes `refresh.trigger()` and `refresh.triggerWithToast(toastFn)`.)

  // Which course's stats to display in the top bar. Chain through ?? so that
  // a missing entry for the active course doesn't leave the stat grid blank —
  // we fall through to any available stat instead of returning undefined.
  const viewedStats =
    (statsViewCourseId ? selectedCoursesStats[statsViewCourseId] : undefined) ??
    (activeCourseId ? selectedCoursesStats[activeCourseId] : undefined) ??
    Object.values(selectedCoursesStats)[0]

  // Tracking labels for the viewed course — derive from viewedStats so
  // labels always match the stats being shown, even when the third-tier
  // fallback for viewedStats fires (different course than active).
  const viewedCourse = courses.find((c) => c.id === viewedStats?.courseId)
  const labels = getTrackingLabels(viewedCourse?.trackingMode)

  const tabs: { id: Tab; label: string; Icon: typeof LayoutGrid }[] = [
    { id: "calendar", label: label("calendar"), Icon: LayoutGrid },
    { id: "list", label: label("schedule"), Icon: List },
    { id: "progress", label: label("progress"), Icon: BarChart3 },
    { id: "cert-path", label: label("certPath"), Icon: Award },
  ]

  const {
    dailyLog,
    tempLogsLoaded,
    logDialogDay,
    logDialogGroups,
    handleOpenLogDialog,
    handleCloseLogDialog,
    handleLogPlan,
    handleSkipPlan,
    handleLogDialogSave,
    handleLogDialogSkip,
    plansLoggedForDate,
    handleMarkDone,
  } = useStudyLogging({
    schedule,
    courseLabel,
    tToast,
    onAfterMarkDone: refresh.trigger,
  })

  // Yesterday's total pages — checks temp state first (before Mark Done),
  // falls back to committed plan.dailyLog (after Mark Done clears temp).
  const yesterdayTotal = useMemo(() => {
    const d = nowDate()
    d.setDate(d.getDate() - 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const yStr = `${y}-${m}-${day}`
    const tempLogs = dailyLog[yStr]
    if (tempLogs && Object.keys(tempLogs).length > 0) {
      // v2.4.4: Sum temp state per-course (deduped) so multiple plans sharing
      // a course don't double-count, then add committed storage for any
      // courses that aren't in temp state yet.
      const seenCourses = new Set<string>()
      let total = 0
      for (const [courseId, l] of Object.entries(tempLogs)) {
        if (seenCourses.has(courseId)) continue
        seenCourses.add(courseId)
        total += l.pagesRead
      }
      for (const plan of allPlans) {
        if (seenCourses.has(plan.courseId)) continue
        if (plan.dailyLog[yStr]) {
          total += plan.dailyLog[yStr].pagesRead
          seenCourses.add(plan.courseId)
        }
      }
      return total
    }
    // No temp state — committed storage only. Dedupe by courseId.
    const seenCourses = new Set<string>()
    let total = 0
    for (const plan of allPlans) {
      if (seenCourses.has(plan.courseId)) continue
      seenCourses.add(plan.courseId)
      if (plan.dailyLog[yStr]) {
        total += plan.dailyLog[yStr].pagesRead
      }
    }
    return total
  }, [dailyLog, allPlans])

  // ── Notification reminders ─────────────────────────────────────────────────
  const remindedRef = useRef<Set<string>>(new Set())
  const dailyLogRef = useRef(dailyLog)
  // eslint-disable-next-line react-hooks/refs
  dailyLogRef.current = dailyLog
  useEffect(() => {
    if (isLoading || courseLoading) return
    const todayStr = localToday()
    const todayDow = nowDate().getDay()

    // Study day reminder: if today is a study day but nothing logged or completed
    if (studyDays.includes(todayDow)) {
      const hasProgress = completedDays.has(todayStr) || Object.keys(dailyLogRef.current[todayStr] ?? {}).length > 0
      if (!hasProgress && !remindedRef.current.has("study-today")) {
        showToast(tToast("studyReminder"), "info")
        remindedRef.current.add("study-today")
      }
    }

    // At-risk labs reminder (only once per day)
    if (!remindedRef.current.has("labs-today")) {
      import("@/lib/lab-session-storage").then((m) => {
        m.readLabsStorage().then((labs) => {
          const atRisk = m.getAtRiskCount(labs.sessions)
          if (atRisk > 0) {
            showToast(formatStr(tToast("labsReminder"), { count: atRisk, plural: atRisk > 1 ? "s" : "" }), "info")
          }
        }).catch((e) => console.warn("[reminder] lab storage read failed:", e))
      }).catch((e) => console.warn("[reminder] lab-session-storage module load failed:", e))
      remindedRef.current.add("labs-today")
    }
  }, [isLoading, courseLoading, studyDays, completedDays])

  // ── Timer dialog handlers (logic moved into <TimerLogDialog>) ──────────────
  const handleTimerLog = (minutes: number) => {
    timerLog.open({ minutes })
  }

  // ── Fullscreen ───────────────────────────────────────────────────────────────
  // (moved into useAppViewState)

  useKeyboardShortcuts({
    activeCourseId,
    isPlannerOpen: planner.isOpen,
    isOnlineLabsOpen: onlineLabs.isOpen,
    isNewsOpen: news.isOpen,
    showTimerLog: timerLog.isOpen,
    showModePicker,
    showThemePicker,
    showNotificationSettings,
    showCheatsheet,
    logDialogDay,
    actions: {
      showCheatsheet: () => setShowCheatsheet(true),
      hideCheatsheet: () => setShowCheatsheet(false),
      setActiveTab,
      openPlanner: (id) => planner.open({ initialCourseId: id }),
      closePlanner: planner.close,
      openOnlineLabs: onlineLabs.open,
      closeOnlineLabs: onlineLabs.close,
      toggleNews: news.toggle,
      closeNews: news.close,
      closeTimerLog: timerLog.close,
      toggleModePicker: () => setShowModePicker((v) => !v),
      closeModePicker: () => setShowModePicker(false),
      toggleThemePicker: () => setShowThemePicker((v) => !v),
      closeThemePicker: () => setShowThemePicker(false),
      closeNotificationSettings: () => setShowNotificationSettings(false),
      toggleFullscreen,
      refresh: refresh.trigger,
    },
  })

  // ── Backup handler ─────────────────────────────────────────────────────────
  const handleBackup = useCallback(async () => {
    const all = await planStorage.getAll()
    const labs = await import("@/lib/lab-session-storage").then((m) => m.readLabsStorage())
    const timer = await import("@/lib/timer-storage").then((m) => m.readTimerState())
    downloadJson(`study-planner-backup-${localToday()}.json`, {
      version: 1,
      exportedAt: now(),
      plans: all,
      courses,
      labs,
      timer,
    })
  }, [courses])

  // ── Reset handler ──────────────────────────────────────────────────────────
  const handleReset = useCallback(async () => {
    if (!window.confirm(label("confirmResetAll"))) return
    await planStorage.clearAll()
    localStorage.removeItem("activeCourseId")
    localStorage.removeItem(KEYS.SELECTED_COURSES)
    switchCourse(null)
    setSelectedCourseIds(new Set())
    refresh.trigger()
    showToast(tToast("allDataCleared"), "info")
  }, [label, switchCourse, tToast, refresh])

  // ── Restore handler (file → storage) ───────────────────────────────────────
  const handleRestore = useCallback(async (file: File) => {
    try {
      const data = await readJsonFile(file) as Record<string, unknown>

      if (typeof data.version === "number" && data.version > 1) {
        showToast(formatStr(tToast("backupVersionMismatch"), { version: String(data.version) }), "break")
        return
      }

      const errors: string[] = []

      if (data.plans && Array.isArray(data.plans)) {
        try {
          for (const plan of data.plans) {
            if (typeof plan === "object" && plan && "id" in plan && "courseId" in plan) {
              await planStorage.save(plan as StudyPlan)
            }
          }
        } catch { errors.push("plans") }
      }
      if (data.activePlanIds && Array.isArray(data.activePlanIds)) {
        try {
          await planStorage.setActiveIds(data.activePlanIds.filter((id): id is string => typeof id === "string"))
        } catch { errors.push("active plans") }
      }
      if (data.labs && typeof data.labs === "object") {
        try {
          const { writeLabsStorage } = await import("@/lib/lab-session-storage")
          await writeLabsStorage(data.labs as import("@/lib/lab-sessions").LabsStorage)
        } catch { errors.push("labs") }
      }
      if (data.timer && typeof data.timer === "object") {
        try {
          const { writeTimerState } = await import("@/lib/timer-storage")
          await writeTimerState(data.timer as import("@/lib/timer-storage").TimerData)
        } catch { errors.push("timer") }
      }
      if (data.courses && Array.isArray(data.courses)) {
        try {
          const { saveCourse } = await import("@/lib/course-storage")
          for (const course of data.courses) {
            if (typeof course === "object" && course && "id" in course && "name" in course) {
              await saveCourse(course as CourseConfig)
            }
          }
        } catch { errors.push("courses") }
      }
      if (errors.length > 0) {
        showToast(formatStr(tToast("backupPartial"), { sections: errors.join(", ") }), "info")
      }
      refresh.trigger()
      showToast(tToast("backupRestored"), "info")
    } catch {
      showToast(tToast("backupFailed"), "info")
    }
  }, [tToast, refresh])

  // ── AppHeader action bundle (memoized for stable identity) ─────────────────
  const headerActions: AppHeaderActions = useMemo(() => ({
    showTip: tip.showTip.toggle,
    switchCourse,
    setSelectedCourseIds,
    openPlanner: (id) => planner.open({ initialCourseId: id }),
    openOnlineLabs: onlineLabs.open,
    toggleNews: news.toggle,
    logTime: handleTimerLog,
    toggleThemePicker: () => setShowThemePicker((v) => !v),
    closeThemePicker: () => setShowThemePicker(false),
    toggleModePicker: () => setShowModePicker((v) => !v),
    closeModePicker: () => setShowModePicker(false),
    toggleNotificationSettings: () => setShowNotificationSettings((v) => !v),
    closeNotificationSettings: () => setShowNotificationSettings(false),
    toggleFullscreen,
    refresh: () =>
      refresh.triggerWithToast(() => showToast(tToast("plansRefreshed"), "info")),
    backup: handleBackup,
    reset: handleReset,
    restore: handleRestore,
  }), [
    switchCourse,
    handleTimerLog,
    toggleFullscreen,
    refresh,
    handleBackup,
    handleReset,
    handleRestore,
    tToast,
  ])

  if (isLoading || courseLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {safeLogoSvg ? (
            <div dangerouslySetInnerHTML={{ __html: safeLogoSvg }} className="w-16 h-16 animate-pulse" />
          ) : (
            <GraduationCap className="w-16 h-16 text-primary animate-pulse" />
          )}
          <p className="text-muted-foreground text-sm">{loading("loading")}</p>
        </div>
      </div>
    )
  }

  // v2.8.0: All 4 full-page overlays are now rendered by <OverlayManager>.
  // The manager returns null when all overlays are closed, so we must gate
  // the early-return on the actual open flags — a JSX element is always truthy.
  const isOverlayOpen =
    onlineLabs.isOpen || news.isOpen || courseBuilder.isOpen || planner.isOpen

  if (isOverlayOpen) {
    return (
      <OverlayManager
        onlineLabs={onlineLabs}
        news={news}
        courseBuilder={courseBuilder}
        planner={planner}
      />
    )
  }

  const appContent = (
    <div
      className="min-h-screen bg-background flex flex-col"
    >
      {/* Phase 2.5: Skip Link — visible only when focused, lets keyboard
          and screen reader users jump straight to main content. */}
      <a href="#main-content" className="skip-link">
        {label("skipToContent")}
      </a>

      <AppHeader
        safeLogoSvg={safeLogoSvg}
        courses={courses}
        activeCourseId={activeCourseId}
        selectedCourseIds={selectedCourseIds}
        isNewsOpen={news.isOpen}
        isFullscreen={isFullscreen}
        refreshing={refresh.isRefreshing}
        showThemePicker={showThemePicker}
        showModePicker={showModePicker}
        showNotificationSettings={showNotificationSettings}
        themePopoverRef={themePopoverRef as React.RefObject<HTMLDivElement | null>}
        modePopoverRef={modePopoverRef as React.RefObject<HTMLDivElement | null>}
        notifPopoverRef={notifPopoverRef as React.RefObject<HTMLDivElement | null>}
        actions={headerActions}
      />


      {/* Course title sub-section */}
      <div className="w-full px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {showMerged ? (
            <>
              <span className="text-sm font-semibold text-foreground">{label("coursesLabel")}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {selectedCourseIds.size}
              </span>
            </>
          ) : activeCourse ? (
            <span className="text-sm font-semibold text-foreground">{activeCourse.name}</span>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">{label("noCourseSelected")}</span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full px-4 py-4">
        <div className="flex gap-6 h-full">
          {/* Daily Briefing sidebar — visible on large screens, takes horizontal space */}
          <aside
            role="complementary"
            aria-label="Daily briefing sidebar"
            className="hidden lg:block w-72 flex-shrink-0 self-start"
          >
            <DailyBriefing
              schedule={schedule}
              dailyLog={dailyLog}
              activeCourse={activeCourse}
              completedDays={completedDays}
              onLogToday={handleOpenLogDialog}
              yesterdayTotal={yesterdayTotal}
            />
            <SidebarLabsStatus onOpenLabs={onlineLabs.open} />
            <SidebarNewsHighlights onOpenNews={news.open} />
          </aside>

          <main
            id="main-content"
            tabIndex={-1}
            aria-label="Main content"
            className="flex-1 min-w-0 focus:outline-none"
          >
            {/* Daily Briefing inline — visible on small/medium screens only */}
            <div className="lg:hidden space-y-5">
              <DailyBriefing
                schedule={schedule}
                dailyLog={dailyLog}
                activeCourse={activeCourse}
                completedDays={completedDays}
                onLogToday={handleOpenLogDialog}
                yesterdayTotal={yesterdayTotal}
              />
              <SidebarLabsStatus onOpenLabs={onlineLabs.open} />
              <SidebarNewsHighlights onOpenNews={news.open} />
            </div>

            {/* Stats Bar */}
            <StatsBar
              viewedStats={viewedStats}
              showMerged={showMerged}
              selectedCoursesStats={selectedCoursesStats}
              statsViewCourseId={statsViewCourseId}
              setStatsViewCourseId={setStatsViewCourseId}
              activeCourseId={activeCourseId}
              labels={labels}
              pLabel={label}
            />

            {/* Phase 0.5.1: Top-of-app exam-day alert banner.
                Surfaces imminent deadlines (T-3 or less) above the tab strip. */}
            <ExamAlertBanner />

            {/* Phase 0.5.4: Sprint mode banner — shows when any active plan
                has a sprint currently in effect. */}
            <SprintBanner />

            {/* Phase 0.5.8: Postmortem mode — prompts user to write a
                postmortem for plans whose exam date has passed. */}
            <PostmortemBanner />

            {/* Phase 0.5.7: Burn-down view (collapsed by default). */}
            <BurnDownView />

            <div
              role="tablist"
              aria-label="Main content tabs"
              className="tab-bar flex gap-1 mb-5 bg-muted rounded-xl p-1"
            >
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  id={`tab-${id}`}
                  role="tab"
                  aria-selected={activeTab === id}
                  aria-controls={`tabpanel-${id}`}
                  tabIndex={activeTab === id ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {activeTab === "calendar" && (
              <div id="tabpanel-calendar" role="tabpanel" aria-labelledby="tab-calendar" className="space-y-4 focus:outline-none" tabIndex={-1}>
                <ErrorBoundary sectionLabel="Schedule">
                  <ExamCountdownBand />
                  <ScheduleView
                    schedule={schedule}
                    dailyLog={dailyLog}
                    onMarkDone={handleMarkDone}
                    onLogDay={handleOpenLogDialog}
                    plansLoggedForDate={plansLoggedForDate}
                    selectedDate={calendarSelectedDate}
                    onSelectedDateChange={setCalendarSelectedDate}
                  />
                </ErrorBoundary>
              </div>
            )}
            {activeTab === "list" && (
              <div id="tabpanel-list" role="tabpanel" aria-labelledby="tab-list" className="focus:outline-none" tabIndex={-1}>
                <ErrorBoundary sectionLabel="Schedule list">
                  <ScheduleList
                    schedule={schedule}
                    dailyLog={dailyLog}
                  />
                </ErrorBoundary>
              </div>
            )}
            {activeTab === "progress" && (
              <div id="tabpanel-progress" role="tabpanel" aria-labelledby="tab-progress" className="focus:outline-none" tabIndex={-1}>
                <ErrorBoundary sectionLabel="Progress dashboard">
                  <ProgressDashboard selectedCourseIds={Array.from(selectedCourseIds)} />
                </ErrorBoundary>
              </div>
            )}
            {activeTab === "cert-path" && (
              <div id="tabpanel-cert-path" role="tabpanel" aria-labelledby="tab-cert-path" className="focus:outline-none" tabIndex={-1}>
                <ErrorBoundary sectionLabel="Certification paths">
                  <CertPathView />
                </ErrorBoundary>
              </div>
            )}
          </main>

        </div>
      </div>

      <div className="sm:hidden fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => news.open()}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all bg-card border border-border"
        >
          <Newspaper className="w-5 h-5 text-primary" />
        </button>
        <button
          onClick={() => onlineLabs.open()}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all bg-card border border-border"
        >
          <FlaskConical className="w-5 h-5 text-primary" />
        </button>
        <button
          onClick={() => planner.open({ initialCourseId: activeCourseId })}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all"
          style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      <TimerLogDialog
        isOpen={timerLog.isOpen}
        minutes={timerLog.state.minutes}
        onClose={timerLog.close}
      />

      <NotificationToast />

      {/* Phase 2.5: Keyboard shortcuts cheatsheet */}
      <KeyboardShortcutsCheatsheet
        open={showCheatsheet}
        onClose={() => setShowCheatsheet(false)}
      />

      {/* Tip popup */}
      {tip.showTip.isOpen && (
        <TipPopup
          tip={tip.currentTip}
          tipNumber={tip.tipNumber}
          totalTips={tip.totalTips}
          onNext={tip.nextTip}
          onClose={tip.showTip.close}
        />
      )}

      {/* Log dialog — key on date ensures fresh state on every open */}
      {logDialogDay && (
        <LogDialog
          key={logDialogDay.date}
          day={logDialogDay}
          groups={logDialogGroups}
          onSave={handleLogDialogSave}
          onSkip={handleLogDialogSkip}
          onClose={handleCloseLogDialog}
        />
      )}
    </div>
  )

  return appContent
}

export default function App() {
  return (
    <ThemeProvider>
      <PersonalityProvider>
        <CourseProvider>
          <AppContent />
        </CourseProvider>
      </PersonalityProvider>
    </ThemeProvider>
  )
}
