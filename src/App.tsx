import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { getTotalPages, mergeSchedules, DEFAULT_STUDY_DAYS, type StudyDay, generateSchedule, getOrderedChapters } from "./lib/cissp-data"
import { planStorage, type StudyPlan, type DailyLog } from "./lib/plan-storage"
import { usePlanStore } from "./lib/plan-store"
import { syncStudyPlan } from "./lib/plan-engine"
import { CourseProvider, useCourse } from "./components/CourseProvider"
import { sanitizeSvg } from "./lib/sanitize-svg"
import ScheduleView from "./components/ScheduleView"
import ScheduleList from "./components/ScheduleList"
import ProgressDashboard from "./components/ProgressDashboard"
import SecurityNewsFeed from "./components/SecurityNewsFeed"
import LabDashboard from "./components/LabDashboard"
import CourseSelector from "./components/CourseSelector"
import PlannerPage from "./components/PlannerPage"
import DailyBriefing from "./components/DailyBriefing"
import SidebarLabsStatus from "./components/SidebarLabsStatus"
import SidebarNewsHighlights from "./components/SidebarNewsHighlights"
import { ThemeProvider, useTheme } from "./components/ThemeProvider"
import StudyTimer from "./components/StudyTimer"
import WallClock from "./components/WallClock"
import NotificationToast, { showToast } from "./components/NotificationToast"
import type { CourseConfig, Chapter } from "./types/course"
import { getUnitColors, computeTotalPages, getTrackingLabels } from "./types/course"
import {
  LayoutGrid, List, BarChart3, Settings,
  Sun, Moon, CalendarCheck,
  Maximize, Minimize, GraduationCap,
  FlaskConical, Check, Palette, RefreshCw,
  Download, Upload, Newspaper, Trash2,
} from "lucide-react"
import { downloadJson, readJsonFile } from "@/lib/export-utils"
import type { Theme } from "./components/ThemeProvider"
import DayDetailDrawer from "./components/DayDetailDrawer"
import LogDialog from "./components/LogDialog"
import type { LogGroup } from "./components/LogDialog"
import TipPopup from "./components/TipPopup"
import { createTipPicker } from "./lib/tips"
import "./variants/adaptive.css"

const THEME_OPTIONS: { id: Theme; label: string; swatch: string }[] = [
  { id: "light", label: "Light", swatch: "#fafafa" },
  { id: "light-grey", label: "Light Grey", swatch: "#cccccc" },
  { id: "dark-grey", label: "Dark Grey", swatch: "#484848" },
  { id: "dark", label: "Dark", swatch: "#0a0a0a" },
]

function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type Tab = "calendar" | "list" | "progress"

function AppContent() {
  const { theme, setTheme } = useTheme()
  const [showThemePicker, setShowThemePicker] = useState(false)
  const {
    activeCourse,
    activeCourseId,
    courses,
    chapters,
    logoSvg,
    switchCourse,
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
  const startDate = primaryPlan?.startDate ?? localToday()
  const pagesPerDay = primaryPlan?.pagesPerDay ?? 20
  const studyDays = primaryPlan?.studyDays ?? DEFAULT_STUDY_DAYS
  const startingChapterId = primaryPlan?.startingChapterId ?? 1
  const chapterStartOverrides = primaryPlan?.chapterStartOverrides ?? {}
  const targetEndDate = primaryPlan?.targetEndDate
  const targetDayCount = primaryPlan?.targetDayCount
  const anchor = primaryPlan?.anchor ?? "pagesPerDay"
  const completedDays = useMemo(
    () => new Set(Object.keys(primaryPlan?.dailyLog ?? {})),
    [primaryPlan],
  )

  const [dailyLog, setDailyLog] = useState<Record<string, Record<string, { pagesRead: number }>>>({})

  const [isFullscreen, setIsFullscreen] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>("calendar")
  const [showTimerLog, setShowTimerLog] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(0)

  // Planner page mode
  const [isPlannerOpen, setIsPlannerOpen] = useState(false)
  const [plannerInitialCourseId, setPlannerInitialCourseId] = useState<string | null>(null)

  // Online Labs full-page mode
  const [isOnlineLabsOpen, setIsOnlineLabsOpen] = useState(false)

  // Security News full-page overlay
  const [isNewsOpen, setIsNewsOpen] = useState(false)

  // Multi-course stats navigation (which course's stats are shown in top bar)
  const [statsViewCourseId, setStatsViewCourseId] = useState<string | null>(null)

  // Refresh tick to force re-fetch of plans
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Build variant (original, adaptive)
  const variant = typeof __BUILD_VARIANT__ !== "undefined" ? __BUILD_VARIANT__ : "original"
  const isAdaptive = variant === "adaptive"

  // Adaptive mode: day detail drawer state
  const [drawerDay, setDrawerDay] = useState<StudyDay | null>(null)

  // Log dialog state
  const [logDialogDay, setLogDialogDay] = useState<StudyDay | null>(null)
  const [logDialogGroups, setLogDialogGroups] = useState<LogGroup[]>([])

  // Calendar selected day — persists across tab/overlay switches
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null)

  // Tip popup state
  const [showTip, setShowTip] = useState(false)
  const [tipPicker] = useState(() => createTipPicker())
  const [currentTip, setCurrentTip] = useState(() => tipPicker.next())

  // Multi-course selector. The set always includes activeCourseId (the editable
  // primary). When .size > 1 the calendar/list show a merged view of every
  // selected course; when .size === 1 the view is single-course.
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set())

  // Other (non-active) selected course ids in stable order.
  const otherSelectedIds = useMemo(
    () => courses.map((c) => c.id).filter((id) => id !== activeCourseId && selectedCourseIds.has(id)),
    [courses, activeCourseId, selectedCourseIds],
  )
  // Merged view only when 2+ courses are selected. Single-course selection
  // is never "view-only" — it's always treated as the active editing target.
  const showMerged = selectedCourseIds.size > 1

  // Auto-activate the sole selected course so single selection always shows stats.
  useEffect(() => {
    if (activeCourseId) return
    if (selectedCourseIds.size !== 1) return
    const id = Array.from(selectedCourseIds)[0]
    if (!courses.some((c) => c.id === id)) return
    switchCourse(id)
  }, [activeCourseId, selectedCourseIds, courses, switchCourse])

  const safeLogoSvg = useMemo(() => (logoSvg ? sanitizeSvg(logoSvg) : null), [logoSvg])

  // ── Boot: load plans from store (single source of truth) ─────────────────
  useEffect(() => {
    if (courseLoading) return
    loadPlans()
  }, [loadPlans, courseLoading])

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

  // ── Notification reminders ─────────────────────────────────────────────────
  const remindedRef = useRef<Set<string>>(new Set())
  const dailyLogRef = useRef(dailyLog)
  dailyLogRef.current = dailyLog
  useEffect(() => {
    if (isLoading || courseLoading) return
    const todayStr = localToday()
    const todayDow = new Date().getDay()

    // Study day reminder: if today is a study day but nothing logged or completed
    if (studyDays.includes(todayDow)) {
      const hasProgress = completedDays.has(todayStr) || Object.keys(dailyLogRef.current[todayStr] ?? {}).length > 0
      if (!hasProgress && !remindedRef.current.has("study-today")) {
        showToast("Today is a study day — don't forget to log your progress!", "info")
        remindedRef.current.add("study-today")
      }
    }

    // At-risk labs reminder (only once per day)
    if (!remindedRef.current.has("labs-today")) {
      import("@/lib/lab-session-storage").then((m) => {
        m.readLabsStorage().then((labs) => {
          const atRisk = m.getAtRiskCount(labs.sessions)
          if (atRisk > 0) {
            showToast(`${atRisk} lab${atRisk > 1 ? "s" : ""} haven't been used in 14+ days. Check Online Labs.`, "info")
          }
        })
      })
      remindedRef.current.add("labs-today")
    }
  }, [isLoading, courseLoading, studyDays, completedDays])

  // ── Auto-save REMOVED — persistence is handled by Zustand store actions ──

  // ── Schedule generation ─────────────────────────────────────────────────────
  // Merge all active plans for the current course into one schedule.
  // Uses anchor-aware generator that derives pages/day at generation time.
  const { baseSchedule, dateToActivePlanId } = useMemo(() => {
    if (!activeCourse) return { baseSchedule: [] as StudyDay[], dateToActivePlanId: new Map<string, string>() }
    const activePlansForCourse = plans.filter(
      (p) => p.courseId === activeCourseId && activePlanIds.includes(p.id),
    )
    const schedule: StudyDay[] = []
    const map = new Map<string, string>()
    const today = localToday()

    for (const plan of activePlansForCourse) {
      const planChapters = getOrderedChapters(activeCourse, plan.unitOrder)
      const params = syncStudyPlan(plan, planChapters, today)
      const result = generateSchedule(plan, planChapters, today, params.pagesPerDay, params.endDate)
      for (const day of result.schedule) {
        schedule.push(day)
        map.set(day.date, plan.id)
      }
    }
    schedule.sort((a, b) => a.date.localeCompare(b.date))
    return { baseSchedule: schedule, dateToActivePlanId: map }
  }, [plans, activeCourseId, activePlanIds, activeCourse, selectedCourseIds])

  // Short label for a course id (shortens the two seed courses; falls back to name).
  const courseLabel = useCallback((id: string) => {
    if (id === "cissp-10th-ed") return "CISSP"
    if (id === "comptia-secai-cy0-001") return "SecAI+"
    return courses.find((c) => c.id === id)?.name ?? id
  }, [courses])

  // For each selected non-active course, merge ALL active plans' schedules.
  // The primary active plan provides logging metadata.
  const otherCoursesInfo = useMemo(() => {
    if (otherSelectedIds.length === 0) return []
    const out: Array<{ courseId: string; courseName: string; schedule: StudyDay[]; chapters: ReturnType<typeof getOrderedChapters> }> = []
    for (const id of otherSelectedIds) {
      const cfg = courses.find((c) => c.id === id)
      const activePlansForCourse = allPlans.filter(
        (p) => p.courseId === id && activePlanIds.includes(p.id)
      )
      if (!cfg || activePlansForCourse.length === 0) continue

      // Merge schedules from all active plans
      const mergedSched: StudyDay[] = []
      const today = localToday()
      for (const plan of activePlansForCourse) {
        const planChapters = getOrderedChapters(cfg, plan.unitOrder)
        const params = syncStudyPlan(plan, planChapters, today)
        const result = generateSchedule(plan, planChapters, today, params.pagesPerDay, params.endDate)
        mergedSched.push(...result.schedule)
      }
      mergedSched.sort((a, b) => a.date.localeCompare(b.date))

      // Primary active plan for logging metadata
      const primaryPlan = activePlansForCourse[0]
      out.push({
        courseId: id,
        courseName: courseLabel(id),
        chapters: getOrderedChapters(cfg, primaryPlan.unitOrder),
        schedule: mergedSched,
      })
    }
    return out
  }, [otherSelectedIds, courses, allPlans, activePlanIds, courseLabel])

  const mergedSchedule = useMemo(() => {
    if (!showMerged || otherCoursesInfo.length === 0) return baseSchedule
    const items = [
      { schedule: baseSchedule, label: courseLabel(activeCourseId ?? ""), courseId: activeCourseId ?? undefined },
      ...otherCoursesInfo.map((o) => ({ schedule: o.schedule, label: o.courseName, courseId: o.courseId })),
    ]
    return mergeSchedules(items)
  }, [showMerged, baseSchedule, otherCoursesInfo, activeCourseId, courseLabel])

  const schedule = showMerged ? mergedSchedule : baseSchedule

  // ── Per-course stats for all selected courses ───────────────────────────────
  type CourseStat = {
    courseId: string
    courseName: string
    color: string
    planName: string
    scheduleLength: number
    totalBookPages: number
    studyPages: number
    totalPages: number
    totalPagesRead: number
    pctDone: number
    pagesPerDay: number
    studyDaysCount: number
    endDate: Date | null
    endDateLabel: string
    weeksAway: string
  }

  const selectedCoursesStats: Record<string, CourseStat> = useMemo(() => {
    const map: Record<string, CourseStat> = {}
    const today = localToday()
    const add = (courseId: string, plan: StudyPlan, cfg: CourseConfig, schedule: StudyDay[], chs: Chapter[], isActive: boolean) => {
      // completedDays = set of dates in dailyLog
      const completed = isActive ? completedDays : new Set(Object.keys(plan.dailyLog))
      const log = isActive ? dailyLog : plan.dailyLog
      const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chs)
      // Stats come from the math engine (logs only = reality-based)
      const today = localToday()
      const params = syncStudyPlan(plan, chs, today)
      const totalPagesRead = params.consumed
      const pctDone = totalPages > 0 ? Math.min(100, Math.round((totalPagesRead / totalPages) * 100)) : 0
      const lastDay = schedule[schedule.length - 1]
      const endDate = lastDay ? new Date(lastDay.date + "T00:00:00") : null
      const endDateLabel = endDate
        ? endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "\u2014"
      const todayMidnight = new Date()
      todayMidnight.setHours(0, 0, 0, 0)
      const daysFromToday = endDate && endDate >= todayMidnight
        ? Math.round((endDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24))
        : null
      const calendarSpan = endDate
        ? Math.round((endDate.getTime() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1
        : 0
      const weeksAway = !endDate
        ? "\u2014"
        : daysFromToday !== null
          ? daysFromToday < 7
            ? `${daysFromToday}d away`
            : `${(daysFromToday / 7).toFixed(1)} wks away`
          : `${(calendarSpan / 7).toFixed(1)} wk span`
      map[courseId] = {
        courseId,
        courseName: cfg.name,
        color: cfg.units[0]?.color ?? "#2563EB",
        planName: plan.name,
        scheduleLength: schedule.length,
        totalBookPages: cfg.totalPages ?? computeTotalPages(cfg),
        studyPages: cfg.studyPages ?? computeTotalPages(cfg),
        totalPages,
        totalPagesRead,
        pctDone,
        pagesPerDay: params.pagesPerDay,
        studyDaysCount: plan.studyDays.length,
        endDate,
        endDateLabel,
        weeksAway,
      }
    }

    // Active course (primary active plan drives the stats). Fall back to the
    // first active plan for the course when primaryActivePlanId is stale —
    // e.g., after a course switch the user hasn't picked a new primary yet.
    if (activeCourseId && activeCourse) {
      const plan = plans.find((p) => p.id === primaryActivePlanId) ?? plans[0]
      if (plan) {
        add(activeCourseId, plan, activeCourse, baseSchedule, getOrderedChapters(activeCourse, plan.unitOrder), true)
      }
    }

    // Other selected courses (primary active plan for stats, merged schedule for display)
    for (const info of otherCoursesInfo) {
      const cfg = courses.find((c) => c.id === info.courseId)
      const activePlansForCourse = allPlans.filter(
        (p) => p.courseId === info.courseId && activePlanIds.includes(p.id)
      )
      const plan = activePlansForCourse[0]
      if (cfg && plan) {
        add(info.courseId, plan, cfg, info.schedule, info.chapters, false)
      }
    }

    return map
  }, [activeCourseId, activeCourse, primaryActivePlanId, plans, baseSchedule, completedDays, dailyLog, otherCoursesInfo, courses, allPlans, activePlanIds])

  // Refresh effect — reload plans from storage into store
  useEffect(() => {
    if (refreshTick === 0) return
    loadPlans()
  }, [refreshTick, loadPlans])

  // Which course's stats to display in the top bar. Chain through ?? so that
  // a missing entry for the active course doesn't leave the stat grid blank —
  // we fall through to any available stat instead of returning undefined.
  const viewedStats =
    (statsViewCourseId ? selectedCoursesStats[statsViewCourseId] : undefined) ??
    (activeCourseId ? selectedCoursesStats[activeCourseId] : undefined) ??
    Object.values(selectedCoursesStats)[0]

  // Tracking labels for the viewed course
  const viewedCourse = courses.find((c) => c.id === (statsViewCourseId ?? activeCourseId))
  const labels = getTrackingLabels(viewedCourse?.trackingMode)

  const tabs: { id: Tab; label: string; Icon: typeof LayoutGrid }[] = [
    { id: "calendar", label: "Calendar", Icon: LayoutGrid },
    { id: "list", label: "Schedule", Icon: List },
    { id: "progress", label: "Progress", Icon: BarChart3 },
  ]

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // 1. Plan-level logging (before Mark Done)
  const handleLogPlan = (date: string, courseId: string, pageValue: number) => {
    // Get the schedule for this course on this day
    const daySchedule = schedule.find(d => d.date === date)
    if (!daySchedule) return
    
    const planChapters = daySchedule.chapters.filter(ch => ch.courseId === courseId)
    if (planChapters.length === 0) return
    
    // Get the book page range for this plan on this day
    const firstCh = planChapters[0]
    const lastCh = planChapters[planChapters.length - 1]
    const scheduleStart = firstCh.bookPageStart ?? firstCh.pagesStart
    const scheduleEnd = lastCh.bookPageEnd ?? lastCh.pagesEnd
    
    let pagesRead = 0
    if (pageValue < scheduleStart) {
      showToast(`Page ${pageValue} is before scheduled range (p.${scheduleStart}). Not saved.`, "break")
      return
    } else if (pageValue > scheduleEnd) {
      pagesRead = pageValue - scheduleStart
      showToast(`Ahead of schedule! Consumed ${pagesRead} pages. Schedule will be adjusted.`, "info")
    } else {
      pagesRead = pageValue - scheduleStart
    }
    
    setDailyLog((prev) => ({
      ...prev,
      [date]: { ...prev[date], [courseId]: { pagesRead } },
    }))
    showToast(`Saved: p.${scheduleStart}–p.${scheduleEnd} → p.${pageValue} (${pagesRead} pages)`, "complete")
  }

  // 2. Plan-level skip (before Mark Done)
  const handleSkipPlan = (date: string, courseId: string) => {
    setDailyLog((prev) => ({
      ...prev,
      [date]: { ...prev[date], [courseId]: { pagesRead: 0 } },
    }))
    showToast(`${courseLabel(courseId)} — skipped (0 pages logged).`, "info")
  }

  // 3. Check if all plans for a date have been logged
  const plansLoggedForDate = useCallback((date: string): boolean => {
    const daySchedule = schedule.find(d => d.date === date)
    if (!daySchedule || daySchedule.chapters.length === 0) return true
    const planIds = new Set(daySchedule.chapters.map(ch => ch.courseId).filter((id): id is string => !!id))
    const dateLogs = dailyLog[date]
    if (!dateLogs) return false
    for (const planId of planIds) {
      if (!(planId in dateLogs)) return false
    }
    return true
  }, [schedule, dailyLog])

  // 4. Mark Done — commits the pending log for a date to plan storage
  const handleMarkDone = async (date: string) => {
    if (!plansLoggedForDate(date)) {
      showToast("Log or Skip all active plans before Marking Done.", "info")
      return
    }
    
    const pendingLogs = dailyLog[date]
    if (!pendingLogs || Object.keys(pendingLogs).length === 0) {
      showToast("No pending log for this date.", "info")
      return
    }
    
    let totalPages = 0
    for (const [courseId, log] of Object.entries(pendingLogs)) {
      totalPages += log.pagesRead
      const plan = allPlans.find(p => p.courseId === courseId && activePlanIds.includes(p.id))
      if (!plan) continue
      
      const updated: StudyPlan = {
        ...plan,
        dailyLog: {
          ...plan.dailyLog,
          [date]: { pagesRead: log.pagesRead },
        },
        updatedAt: new Date().toISOString(),
      }
      
      try {
        await storeUpdatePlan(updated)
      } catch (e) {
        console.error(`Failed to persist Mark Done for plan ${plan.id}:`, e)
        showToast(`${courseLabel(courseId)} — failed to save. Please try again.`, "break")
        return
      }
    }
    
    // Clear pending log for this date
    setDailyLog((prev) => {
      const next = { ...prev }
      delete next[date]
      return next
    })
    
    setRefreshTick(prev => prev + 1)
    showToast(`Mark Done: ${totalPages} pages logged for ${date}.`, "complete")
  }

  // 5. Log dialog handlers
  const handleOpenLogDialog = (day: StudyDay, groups: LogGroup[]) => {
    setLogDialogDay(day)
    setLogDialogGroups(groups)
  }

  const handleLogDialogSave = (date: string, logs: Array<{ courseId: string; pagesRead: number }>) => {
    for (const { courseId, pagesRead } of logs) {
      handleLogPlan(date, courseId, pagesRead)
    }
    setLogDialogDay(null)
    setLogDialogGroups([])
  }

  const handleLogDialogSkip = (date: string, courseId: string) => {
    handleSkipPlan(date, courseId)
    setLogDialogDay(null)
    setLogDialogGroups([])
  }

  const handleTimerLog = (minutes: number) => {
    setTimerMinutes(minutes)
    setShowTimerLog(true)
  }

  const confirmTimerLog = () => {
    const todayStr = localToday()
    const todayDay = schedule.find((d) => d.date === todayStr)
    if (todayDay && timerMinutes > 0) {
      const courseId = primaryActivePlanId
        ? allPlans.find(p => p.id === primaryActivePlanId)?.courseId
        : undefined
      if (courseId) {
        setDailyLog((prev) => ({
          ...prev,
          [todayStr]: {
            ...prev[todayStr],
            [courseId]: { pagesRead: timerMinutes },
          },
        }))
      }
    }
    setShowTimerLog(false)
    setTimerMinutes(0)
  }

  // ── Fullscreen ───────────────────────────────────────────────────────────────
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
      // ignore
    }
  }, [setIsFullscreen])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === "input" || tag === "textarea" || tag === "select") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case "1": setActiveTab("calendar"); break
        case "2": setActiveTab("list"); break
        case "3": setActiveTab("progress"); break
        case "p": case "P":
          if (!isPlannerOpen) { setPlannerInitialCourseId(activeCourseId); setIsPlannerOpen(true); }
          break
        case "l": case "L":
          if (!isOnlineLabsOpen) setIsOnlineLabsOpen(true)
          break
        case "n": case "N":
          setIsNewsOpen((v) => !v)
          break
        case "Escape":
          if (isNewsOpen) setIsNewsOpen(false)
          else if (isOnlineLabsOpen) setIsOnlineLabsOpen(false)
          else if (isPlannerOpen) { setIsPlannerOpen(false); setPlannerInitialCourseId(null); }
          else if (showTimerLog) setShowTimerLog(false)
          else if (showThemePicker) setShowThemePicker(false)
          break
        case "f": case "F":
          toggleFullscreen()
          break
        case "r": case "R":
          setRefreshTick((t) => t + 1)
          break
        case "t": case "T":
          setShowThemePicker((v) => !v)
          break
        case "?":
          showToast("Shortcuts: 1/2/3=tabs, P=planner, L=labs, N=news, F=fullscreen, R=refresh, T=theme, ?=help, Esc=close", "info")
          break
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeCourseId, isPlannerOpen, isOnlineLabsOpen, isNewsOpen, showTimerLog, showThemePicker, toggleFullscreen, setIsNewsOpen])

  if (isLoading || courseLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {safeLogoSvg ? (
            <div dangerouslySetInnerHTML={{ __html: safeLogoSvg }} className="w-16 h-16 animate-pulse" />
          ) : (
            <GraduationCap className="w-16 h-16 text-primary animate-pulse" />
          )}
          <p className="text-muted-foreground text-sm">Loading your study plans...</p>
        </div>
      </div>
    )
  }

  // Online Labs full-page overlay
  if (isOnlineLabsOpen) {
    return <LabDashboard onBack={() => setIsOnlineLabsOpen(false)} />
  }

  // Security News full-page overlay
  if (isNewsOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SecurityNewsFeed onClose={() => setIsNewsOpen(false)} />
      </div>
    )
  }

  // Planner page overlay
  if (isPlannerOpen) {
    return (
      <PlannerPage
        courses={courses}
        activeCourseId={activeCourseId}
        activePlanIds={activePlanIds}
        allPlans={allPlans}
        initialCourseId={plannerInitialCourseId}
        onActivatePlan={async (plan) => {
          const curr = activePlanIds
          const isActive = curr.includes(plan.id)
          if (isActive) {
            const next = curr.filter((id) => id !== plan.id)
            await storeSetActivePlanIds(next)
          } else {
            const next = [...curr, plan.id]
            await storeSetActivePlanIds(next)
            if (plan.courseId === activeCourseId) {
              storeSetPrimaryActivePlanId(plan.id)
            }
          }
          // Stay in planner — user decides when to go back
        }}
        onPlansChanged={async () => {
          await loadPlans()
          showToast("Plan saved and applied.", "info")
        }}
        onBack={() => {
          setIsPlannerOpen(false)
          setPlannerInitialCourseId(null)
        }}
      />
    )
  }

  const appContent = (
    <div
      className={`min-h-screen bg-background flex flex-col ${variant !== "original" ? "" : ""}`}
      data-variant={variant}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="w-full px-4 py-3 flex items-center gap-4">
          {/* Logo + Title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              {safeLogoSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: safeLogoSvg }}
                  className="w-9 h-9"
                  style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
                />
              ) : (
                <GraduationCap className="w-9 h-9 text-primary" />
              )}
            </div>
            <div className="hidden sm:block whitespace-nowrap">
              <h1 className="font-bold text-foreground leading-none whitespace-nowrap text-base">
                CySec CCPTL
                <span className="ml-2 text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v{__APP_VERSION__}</span>
              </h1>
            </div>
          </div>

          {/* Course selector — multi-select with active/edit indicator */}
          {courses.length > 1 && (
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <CourseSelector
                courses={courses}
                activeCourseId={activeCourseId}
                selectedCourseIds={selectedCourseIds}
                onActiveChange={(id) => switchCourse(id)}
                onSelectedChange={setSelectedCourseIds}
                onOpenPlanner={(id) => {
                  setPlannerInitialCourseId(id)
                  setIsPlannerOpen(true)
                }}
              />
            </div>
          )}

          {/* ── PLANNER ZONE (left) ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setPlannerInitialCourseId(activeCourseId)
                setIsPlannerOpen(true)
              }}
              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Planner</span>
            </button>

            <button
              onClick={() => setIsOnlineLabsOpen(true)}
              className="h-9 hidden lg:inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Online Labs</span>
            </button>

            <button
              onClick={() => setIsNewsOpen(true)}
              className={`h-9 hidden lg:inline-flex items-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-all ${isNewsOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
                }`}
            >
              <Newspaper className="w-4 h-4" />
              <span className="hidden sm:inline">News</span>
            </button>
          </div>

          {/* ── Spacer ── */}
          <div className="flex-1" />

          {/* ── CENTER: Timer ── */}
          <div className="flex-shrink-0">
            <StudyTimer onLogTime={handleTimerLog} />
          </div>

          {/* ── Spacer ── */}
          <div className="flex-1" />

          {/* ── APP ZONE (right) ── */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <WallClock />
            <button
              onClick={() => setShowTip((v) => !v)}
              aria-label="Tips"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <span className="text-sm font-bold">?</span>
            </button>
            <button
              onClick={async () => {
                setRefreshing(true)
                setRefreshTick((t) => t + 1)
                showToast("Plans refreshed.", "info")
                setTimeout(() => setRefreshing(false), 400)
              }}
              aria-label="Refresh"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={async () => {
                const all = await planStorage.getAll()
                const courseList = courses
                const labs = await import("@/lib/lab-session-storage").then((m) => m.readLabsStorage())
                const timer = await import("@/lib/timer-storage").then((m) => m.readTimerState())
                downloadJson(`study-planner-backup-${localToday()}.json`, {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  plans: all,
                  courses: courseList,
                  labs,
                  timer,
                })
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Backup all data"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                if (!window.confirm("Reset all data? This clears plans, logs, and course selections. Course configs are preserved.")) return
                await planStorage.clearAll()
                localStorage.removeItem("activeCourseId")
                localStorage.removeItem("selectedCourseIds")
                switchCourse(null)
                setSelectedCourseIds(new Set())
                setRefreshTick((t) => t + 1)
                showToast("All data cleared.", "info")
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-destructive/30 bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
              title="Reset all data"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <label className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Restore from backup"
            >
              <Upload className="w-4 h-4" />
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const data = await readJsonFile(file) as Record<string, unknown>
                    if (data.plans && Array.isArray(data.plans)) {
                      for (const plan of data.plans) {
                        if (typeof plan === "object" && plan && "id" in plan && "courseId" in plan) {
                          await planStorage.save(plan as import("@/lib/plan-storage").StudyPlan)
                        }
                      }
                    }
                    if (data.activePlanIds && Array.isArray(data.activePlanIds)) {
                      await planStorage.setActiveIds(data.activePlanIds.filter((id): id is string => typeof id === "string"))
                    }
                    if (data.labs && typeof data.labs === "object") {
                      const { writeLabsStorage } = await import("@/lib/lab-session-storage")
                      await writeLabsStorage(data.labs as import("@/lib/lab-sessions").LabsStorage)
                    }
                    if (data.timer && typeof data.timer === "object") {
                      const { writeTimerState } = await import("@/lib/timer-storage")
                      await writeTimerState(data.timer as import("@/lib/timer-storage").TimerData)
                    }
                    setRefreshTick((t) => t + 1)
                    showToast("Backup restored successfully", "info")
                  } catch {
                    showToast("Failed to restore backup", "info")
                  }
                  e.target.value = ""
                }}
              />
            </label>
            <div className="relative">
              <button
                onClick={() => setShowThemePicker((v) => !v)}
                aria-label="Choose theme"
                aria-haspopup="menu"
                aria-expanded={showThemePicker}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                {theme === "dark" || theme === "dark-grey" ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </button>
              {showThemePicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemePicker(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 z-50 w-48 bg-card border border-border rounded-lg shadow-lg p-1"
                  >
                    <div className="px-2 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Palette className="w-3.5 h-3.5" />
                      Theme
                    </div>
                    {THEME_OPTIONS.map((opt) => {
                      const active = theme === opt.id
                      return (
                        <button
                          key={opt.id}
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setTheme(opt.id)
                            setShowThemePicker(false)
                          }}
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${active
                              ? "bg-muted font-medium text-foreground"
                              : "text-foreground hover:bg-muted/60"
                            }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                            style={{ backgroundColor: opt.swatch }}
                          />
                          <span className="flex-1 text-left">{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              aria-label="Toggle fullscreen"
              className="w-9 h-9 hidden sm:flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Course title sub-section */}
      <div className="w-full px-4 pt-4 pb-0">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {showMerged ? (
            <>
              <span className="text-sm font-semibold text-foreground">Courses</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {selectedCourseIds.size}
              </span>
            </>
          ) : activeCourse ? (
            <span className="text-sm font-semibold text-foreground">{activeCourse.name}</span>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">No course selected</span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full px-4 py-4">
        <div className="flex gap-6 h-full">
          {/* Daily Briefing sidebar — visible on large screens, takes horizontal space */}
          <aside className="hidden lg:block w-72 flex-shrink-0 self-start">
            <DailyBriefing
              schedule={schedule}
              dailyLog={dailyLog}
              activeCourse={activeCourse}
              completedDays={completedDays}
              onLogToday={handleOpenLogDialog}
            />
            <SidebarLabsStatus onOpenLabs={() => setIsOnlineLabsOpen(true)} />
            <SidebarNewsHighlights onOpenNews={() => setIsNewsOpen(true)} />
          </aside>

          <main className="flex-1 min-w-0">
            {/* Daily Briefing inline — visible on small/medium screens only */}
            <div className="lg:hidden space-y-5">
              <DailyBriefing
                schedule={schedule}
                dailyLog={dailyLog}
                activeCourse={activeCourse}
                completedDays={completedDays}
                onLogToday={handleOpenLogDialog}
              />
              <SidebarLabsStatus onOpenLabs={() => setIsOnlineLabsOpen(true)} />
              <SidebarNewsHighlights onOpenNews={() => setIsNewsOpen(true)} />
            </div>

            {/* Stats Bar */}
            <div className="rounded-xl mb-5 border border-primary/20 bg-primary/5 overflow-hidden">
              {/* Top row: pills on left (multi), finish date always on right */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-primary/15 flex-wrap">
                <CalendarCheck className="w-4 h-4 text-primary flex-shrink-0" />
                {showMerged && (
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {Object.values(selectedCoursesStats).map((s) => (
                      <button
                        key={s.courseId}
                        onClick={() => setStatsViewCourseId(s.courseId)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${statsViewCourseId === s.courseId || (!statsViewCourseId && s.courseId === activeCourseId)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-primary/40"
                          }`}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="whitespace-nowrap">{s.courseName}</span>
                        <span className={`text-[10px] px-1 rounded-full ${statsViewCourseId === s.courseId || (!statsViewCourseId && s.courseId === activeCourseId)
                            ? "bg-primary-foreground/20"
                            : "bg-muted"
                          }`}>
                          {s.pctDone}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                  <span className="text-sm font-medium text-foreground">Finishes:</span>
                  <span className="text-sm font-bold text-primary">{viewedStats?.endDateLabel ?? "\u2014"}</span>
                  <span className="hidden sm:inline-block text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5 bg-background">
                    {viewedStats?.weeksAway ?? "\u2014"}
                  </span>
                </div>
              </div>
              {/* Stats grid */}
              <div className="stats-bar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-primary/10">
                <div className="px-3 py-3 text-center">
                  <p className="text-base font-bold text-foreground leading-tight">{viewedStats?.scheduleLength ?? "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Study Days</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-base font-bold text-foreground leading-tight">{viewedStats ? viewedStats.totalBookPages.toLocaleString() : "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{labels.totalItems}</p>
                </div>
                <div className="px-3 py-3 text-center" title={viewedStats ? `Consumed: ${viewedStats.totalPagesRead.toLocaleString()} / Total: ${viewedStats.totalPages.toLocaleString()}` : ""}>
                  <p className="text-base font-bold text-foreground leading-tight">
                    {viewedStats ? `${viewedStats.totalPagesRead.toLocaleString()}/${viewedStats.totalPages.toLocaleString()}` : "\u2014"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{labels.totalItems}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-base font-bold text-foreground leading-tight">{viewedStats ? viewedStats.pagesPerDay : "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{labels.perDay}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-base font-bold text-foreground leading-tight">{viewedStats ? `${viewedStats.studyDaysCount}d/wk` : "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Frequency</p>
                </div>
                <div className="col-span-2 sm:col-span-1 px-3 py-3 text-center" title={viewedStats ? `${viewedStats.totalPagesRead} of ${viewedStats.totalPages} pages` : ""}>
                  <p className="text-base font-bold text-primary leading-tight">{viewedStats ? `${viewedStats.pctDone}%` : "\u2014"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Progress</p>
                </div>
              </div>
            </div>

            <div className="tab-bar flex gap-1 mb-5 bg-muted rounded-xl p-1">
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
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
              <ScheduleView
                schedule={schedule}
                dailyLog={dailyLog}
                onMarkDone={handleMarkDone}
                onLogDay={handleOpenLogDialog}
                plansLoggedForDate={plansLoggedForDate}
                selectedDate={calendarSelectedDate}
                onSelectedDateChange={setCalendarSelectedDate}
                onSelectDay={isAdaptive ? (day) => setDrawerDay(day) : undefined}
              />
            )}
            {activeTab === "list" && (
              <ScheduleList
                schedule={schedule}
                dailyLog={dailyLog}
                onMarkDone={handleMarkDone}
              />
            )}
            {activeTab === "progress" && (
              <ProgressDashboard selectedCourseIds={Array.from(selectedCourseIds)} />
            )}
          </main>

        </div>
      </div>

      <div className="sm:hidden fixed bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => setIsNewsOpen(true)}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all bg-card border border-border"
        >
          <Newspaper className="w-5 h-5 text-primary" />
        </button>
        <button
          onClick={() => setIsOnlineLabsOpen(true)}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all bg-card border border-border"
        >
          <FlaskConical className="w-5 h-5 text-primary" />
        </button>
        <button
          onClick={() => {
            setPlannerInitialCourseId(activeCourseId)
            setIsPlannerOpen(true)
          }}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all"
          style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>

      {showTimerLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2">Log Study Session</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You studied for <span className="font-semibold text-foreground">{Math.floor(timerMinutes / 60)}h {timerMinutes % 60}m</span>. Log this to today&apos;s daily entry?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTimerLog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
              >
                Skip
              </button>
              <button
                onClick={confirmTimerLog}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
              >
                Log Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adaptive mode: Day detail drawer */}
      {isAdaptive && drawerDay && (
        <DayDetailDrawer
          day={drawerDay}
          dailyLog={dailyLog}
          onClose={() => setDrawerDay(null)}
          onMarkDone={handleMarkDone}
        />
      )}

      <NotificationToast />

      {/* Tip popup */}
      {showTip && (
        <TipPopup
          tip={currentTip}
          tipNumber={tipPicker.currentIndex}
          totalTips={tipPicker.total}
          onNext={() => setCurrentTip(tipPicker.next())}
          onClose={() => setShowTip(false)}
        />
      )}

      {/* Log dialog */}
      {logDialogDay && (
        <LogDialog
          day={logDialogDay}
          groups={logDialogGroups}
          onSave={handleLogDialogSave}
          onSkip={handleLogDialogSkip}
          onClose={() => {
            setLogDialogDay(null)
            setLogDialogGroups([])
          }}
        />
      )}
    </div>
  )

  return appContent
}

export default function App() {
  return (
    <ThemeProvider>
      <CourseProvider>
        <AppContent />
      </CourseProvider>
    </ThemeProvider>
  )
}
