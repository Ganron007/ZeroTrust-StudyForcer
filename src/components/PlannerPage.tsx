"use client"

import { useState, useEffect, useMemo } from "react"
import type { CourseConfig, Chapter } from "@/types/course"
import { getTrackingLabels, computeTotalPages } from "@/types/course"
import { planStorage, defaultPlan, type StudyPlan } from "@/lib/plan-storage"
import { usePlanStore } from "@/lib/plan-store"
import { generateSchedule, getTotalPages, getOrderedChapters, DEFAULT_STUDY_DAYS } from "@/lib/cissp-data"
import { syncStudyPlan } from "@/lib/plan-engine"
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Play, Check, CalendarDays,
  BookOpen, Save, X, GraduationCap, Download, Upload, Target,
  Layers, TrendingUp, Sparkles, Wrench,
} from "lucide-react"
import { downloadJson, readJsonFile } from "@/lib/export-utils"
import { showToast } from "@/components/NotificationToast"
import DatePicker from "./DatePicker"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"

interface PlannerPageProps {
  courses: CourseConfig[]
  activeCourseId: string | null
  activePlanIds: string[]
  allPlans: StudyPlan[]
  initialCourseId?: string | null
  onActivatePlan: (plan: StudyPlan) => void
  onPlansChanged?: (savedPlan?: StudyPlan) => void
  onBack: () => void
  onOpenCourseBuilder?: () => void
}

function flattenChapters(cfg: CourseConfig): Chapter[] {
  return cfg.units.flatMap((u) =>
    u.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      pages: ch.pages,
      unitId: u.id,
      unitName: u.title,
      color: u.color,
    }))
  )
}

function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const DAY_LABELS = [
  { dow: 0, short: "Su", label: "Sunday" },
  { dow: 1, short: "Mo", label: "Monday" },
  { dow: 2, short: "Tu", label: "Tuesday" },
  { dow: 3, short: "We", label: "Wednesday" },
  { dow: 4, short: "Th", label: "Thursday" },
  { dow: 5, short: "Fr", label: "Friday" },
  { dow: 6, short: "Sa", label: "Saturday" },
]

function CircularProgress({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <svg width={size} height={size} className="flex-shrink-0 rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="text-[10px] font-bold fill-foreground"
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

export default function PlannerPage({
  courses,
  activePlanIds,
  allPlans,
  onActivatePlan,
  onPlansChanged,
  onBack,
  onOpenCourseBuilder,
}: PlannerPageProps) {
  const { label, toast: tToast, empty } = usePersonality()
  const [creatingForCourseId, setCreatingForCourseId] = useState<string | null>(null)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editStartDate, setEditStartDate] = useState(localToday())
  const [editPagesPerDay, setEditPagesPerDay] = useState(20)
  const [editStudyDays, setEditStudyDays] = useState<number[]>(DEFAULT_STUDY_DAYS)
  const [editStartingChapterId, setEditStartingChapterId] = useState(1)
  const [editTargetEndDate, setEditTargetEndDate] = useState<string | undefined>(undefined)
  const [editTargetDayCount, setEditTargetDayCount] = useState<number | undefined>(undefined)
  const [editAnchor, setEditAnchor] = useState<import("@/lib/plan-storage").Anchor>("pagesPerDay")
  const [editUnitOrder, setEditUnitOrder] = useState<number[] | undefined>(undefined)

  // Collapse/expand course cards
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("planner:expandedCourses")
      if (raw) return new Set(JSON.parse(raw))
    } catch { /* ignore */ }
    return new Set<string>()
  })

  const toggleCourseExpanded = (courseId: string) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      try {
        localStorage.setItem("planner:expandedCourses", JSON.stringify(Array.from(next)))
      } catch { /* ignore */ }
      return next
    })
  }

  const plansByCourse = useMemo(() => {
    const map: Record<string, StudyPlan[]> = {}
    for (const course of courses) {
      map[course.id] = allPlans.filter((p) => p.courseId === course.id)
    }
    return map
  }, [courses, allPlans])

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    const totalPlans = allPlans.length
    const activeCount = activePlanIds.length
    const avgPct =
      totalPlans === 0
        ? 0
        : Math.round(
            allPlans.reduce((sum, plan) => {
              const cfg = courses.find((c) => c.id === plan.courseId)
              const chapters = cfg ? getOrderedChapters(cfg, plan.unitOrder) : []
              const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chapters)
              const donePages = Object.values(plan.dailyLog).reduce((s, l) => s + Math.max(0, l.pagesRead), 0)
              return sum + (totalPages > 0 ? (donePages / totalPages) * 100 : 0)
            }, 0) / totalPlans
          )
    return { totalPlans, activeCount, courseCount: courses.length, avgPct }
  }, [allPlans, activePlanIds, courses])

  async function handleDeletePlan(id: string) {
    if (!confirm(label("confirmDeletePlan"))) return
    // Use Zustand store deletion which atomically handles store update,
    // active-plan-id cleanup, and persistent storage — instead of directly
    // calling planStorage.delete (which leaves the store out of sync).
    await usePlanStore.getState().deletePlan(id)
    onPlansChanged?.()
    if (editingPlanId === id) {
      setEditingPlanId(null)
    }
  }

  function initEditForm(plan: StudyPlan) {
    setEditName(plan.name)
    setEditStartDate(plan.startDate)
    setEditPagesPerDay(plan.pagesPerDay)
    setEditStudyDays(plan.studyDays)
    setEditStartingChapterId(plan.startingChapterId)
    setEditTargetEndDate(plan.targetEndDate)
    setEditTargetDayCount(plan.targetDayCount)
    setEditAnchor(plan.anchor)
    setEditUnitOrder(plan.unitOrder)
  }

  async function handleSaveEdit(planId: string) {
    const existing = allPlans.find((p) => p.id === planId)
    if (!existing) return

    const hasLoggedDays = Object.keys(existing.dailyLog).length > 0

    const updated: StudyPlan = {
      ...existing,
      name: editName.trim() || existing.name,
      startDate: editStartDate,
      pagesPerDay: Math.max(1, editPagesPerDay),
      studyDays: editStudyDays,
      startingChapterId: editStartingChapterId,
      targetEndDate: editTargetEndDate,
      targetDayCount: editTargetDayCount,
      anchor: editAnchor,
      unitOrder: hasLoggedDays ? existing.unitOrder : editUnitOrder,
    }

    // If anchor is deadline, compute the actual derived pace and store it
    // so the calendar shows consistent values (past days use plan.pagesPerDay).
    if (updated.anchor === "endDate") {
      const cfg = courses.find((c) => c.id === existing.courseId)
      const chs = cfg ? getOrderedChapters(cfg, updated.unitOrder) : []
      const params = syncStudyPlan(updated, chs, localToday())
      updated.pagesPerDay = params.pagesPerDay
      // Fixed Duration: persist the computed end date so it doesn't
      // drift every time the plan is reloaded.
      if (!updated.targetEndDate && updated.targetDayCount) {
        updated.targetEndDate = params.endDate ?? undefined
      }
      // A78: If targetDayCount was set, recompute it from the new end date
      // so subsequent edits don't see a stale day count.
      if (updated.targetDayCount && params.endDate) {
        const start = new Date(updated.startDate + "T00:00:00")
        const end = new Date(params.endDate + "T00:00:00")
        const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
        if (diffDays > 0) updated.targetDayCount = diffDays
      }
    }

    const saved = await planStorage.save(updated)
    onPlansChanged?.(saved)
    setEditingPlanId(null)
  }

  // Initialize form fields when entering create mode
  useEffect(() => {
    if (!creatingForCourseId) return
    const cfg = courses.find(c => c.id === creatingForCourseId)
    const defaults = defaultPlan(creatingForCourseId, {}, cfg?.defaultSettings)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditName("")
    setEditStartDate(defaults.startDate)
    setEditPagesPerDay(defaults.pagesPerDay)
    setEditStudyDays(defaults.studyDays)
    setEditStartingChapterId(defaults.startingChapterId)
    setEditTargetEndDate(defaults.targetEndDate)
    setEditTargetDayCount(defaults.targetDayCount)
    setEditAnchor(defaults.anchor)
    setEditUnitOrder(defaults.unitOrder)
  }, [creatingForCourseId, courses])

  async function handleCreatePlanSave(courseId: string) {
    const cfg = courses.find(c => c.id === courseId)
    if (!cfg) return

    const name = editName.trim() || "New Plan"
    const defaults = defaultPlan(courseId, { name }, cfg.defaultSettings)
    const plan = {
      ...defaults,
      name,
      startDate: editStartDate,
      pagesPerDay: Math.max(1, editPagesPerDay),
      studyDays: editStudyDays,
      startingChapterId: editStartingChapterId,
      targetEndDate: editTargetEndDate,
      targetDayCount: editTargetDayCount,
      anchor: editAnchor,
      unitOrder: editUnitOrder,
    }

    // If deadline anchor, compute the derived pace
    if (plan.anchor === "endDate") {
      const chs = getOrderedChapters(cfg, editUnitOrder)
      const params = syncStudyPlan(plan as StudyPlan, chs, localToday())
      plan.pagesPerDay = params.pagesPerDay
      if (!plan.targetEndDate && plan.targetDayCount) {
        plan.targetEndDate = params.endDate ?? undefined
      }
    }

    const saved = await planStorage.save(plan)
    onPlansChanged?.(saved)
    setCreatingForCourseId(null)
  }

  function handleActivate(plan: StudyPlan) {
    onActivatePlan(plan)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="w-full px-4 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {label("backToView")}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-foreground text-base">{label("appTitle")}</h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {onOpenCourseBuilder && (
              <button
                onClick={() => onOpenCourseBuilder?.()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-all"
                title={label("buildCourse")}
              >
                <Wrench className="w-3.5 h-3.5" />
                {label("buildCourse")}
              </button>
            )}
            <button
              onClick={() => {
                const payload = { plans: allPlans, exportedAt: new Date().toISOString() }
                downloadJson(`study-plans-${localToday()}.json`, payload)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-all"
                title={label("export")}
            >
              <Download className="w-3.5 h-3.5" />
              {label("export")}
            </button>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {label("import")}
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const raw = await readJsonFile(file) as Record<string, unknown>
                    // A79: Validate shape before persisting — reject malformed plans
                    if (!raw.plans || !Array.isArray(raw.plans)) {
                      showToast(tToast("invalidPlanFile"), "info")
                      return
                    }
                    const validPlans: StudyPlan[] = []
                    for (const plan of raw.plans) {
                      if (!plan || typeof plan !== "object") continue
                      const p = plan as Record<string, unknown>
                      if (typeof p.id !== "string" || typeof p.courseId !== "string") continue
                      if (typeof p.startDate !== "string" || typeof p.pagesPerDay !== "number") continue
                      if (!Array.isArray(p.studyDays) || typeof p.dailyLog !== "object") continue
                      validPlans.push(plan as StudyPlan)
                    }
                    for (const plan of validPlans) {
                      await planStorage.save(plan)
                    }
                    onPlansChanged?.()
                    showToast(formatStr(tToast("plansImported"), { count: validPlans.length }), "info")
                  } catch {
                    showToast(tToast("importFailed"), "info")
                  }
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        </div>
      </header>

      {/* Dashboard stats bar */}
      <div className="w-full border-b border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{dashboardStats.totalPlans}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label("totalPlans")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{dashboardStats.activeCount}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label("active")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{dashboardStats.courseCount}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label("coursesLabel")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-card border border-border p-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{dashboardStats.avgPct}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label("avgCompletion")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 w-full px-4 py-6 max-w-5xl mx-auto">
        <div className="space-y-4">
          {courses.map((course) => {
            const coursePlans = plansByCourse[course.id] ?? []
            const isCreating = creatingForCourseId === course.id
            const hasActivePlan = coursePlans.some((p) => activePlanIds.includes(p.id))
            const isExpanded = expandedCourseIds.has(course.id)
            const color = course.units[0]?.color ?? "#2563EB"
            const chapters = flattenChapters(course)
            const labels = getTrackingLabels(course.trackingMode)
            const totalCoursePages = computeTotalPages(course)

            return (
              <div
                key={course.id}
                className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Course header */}
                <button
                  type="button"
                  onClick={() => toggleCourseExpanded(course.id)}
                  className="w-full px-5 py-4 border-b border-border text-left hover:bg-muted/20 transition-colors"
                  style={{ borderLeftWidth: 4, borderLeftColor: color, borderLeftStyle: "solid" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}40, 0 0 0 4px ${color}20` }}
                      />
                      <div>
                        <h2 className="text-base font-bold text-foreground">{course.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {course.units.length} units · {chapters.length} chapters · {totalCoursePages.toLocaleString()} {labels.totalItems.toLowerCase()} · {coursePlans.length} plan{coursePlans.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasActivePlan && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                          {label("hasActivePlan")}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Plans list */}
                {isExpanded && (
                  <div className="divide-y divide-border/50">
                    {coursePlans.length === 0 && !isCreating && (
                      <div className="px-5 py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                          <Sparkles className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">{empty("noPlansYet")}</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">
                          {formatStr(empty("noPlansForCourse"), { course: course.name })}
                        </p>
                        <button
                          onClick={() => setCreatingForCourseId(course.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {label("createFirstPlan")}
                        </button>
                      </div>
                    )}

                    {coursePlans.map((plan) => {
                      const isEditing = editingPlanId === plan.id
                      const isActivePlan = activePlanIds.includes(plan.id)
                      const today = localToday()
                      const planChapters = getOrderedChapters(course, plan.unitOrder)
                      const params = syncStudyPlan(plan, planChapters, today)
                      const result = generateSchedule(plan, planChapters, today, params.pagesPerDay, params.endDate)
                      const sched = result.schedule
                      const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, planChapters)
                       const doneCount = Object.keys(plan.dailyLog).length
                      const planHasLogs = doneCount > 0
                      // Stats come from the math engine (logs only = reality-based)
                      const pct = totalPages > 0
                        ? Math.min(100, Math.round((params.consumed / totalPages) * 100))
                        : 0
                      const lastDay = sched[sched.length - 1]
                      const endDate = lastDay ? lastDay.date : "—"

                      return (
                        <div key={plan.id}>
                          {/* Plan card */}
                          <div
                            className={`px-5 py-4 flex items-center gap-4 ${isActivePlan ? "bg-emerald-500/[0.03]" : ""}`}
                            style={isActivePlan ? { borderLeft: `3px solid ${color}` } : undefined}
                          >
                            <CircularProgress pct={pct} color={color} />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-foreground truncate">{plan.name}</span>
                                {isActivePlan && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" />
                                    Active
                                  </span>
                                )}
                                {plan.anchor === "endDate" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                                    Deadline
                                  </span>
                                )}
                                {plan.unitOrder && plan.unitOrder.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                                    Custom Order
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {plan.startDate} → {endDate}
                                </span>
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {params.pagesPerDay} {labels.paceLabel}
                                  {plan.anchor === "endDate" && (
                                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">(auto)</span>
                                  )}
                                </span>
                                <span>{sched.length} days</span>
                                <span>{doneCount} completed</span>
                                {plan.targetEndDate && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium">
                                    Target: {plan.targetEndDate}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleActivate(plan)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isActivePlan
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                }`}
                              >
                                {isActivePlan ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3" />
                                    {label("activate")}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingPlanId(null)
                                  } else {
                                    setEditingPlanId(plan.id)
                                    initEditForm(plan)
                                  }
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isEditing
                                    ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                                title={isEditing ? label("cancelEdit") : label("edit")}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePlan(plan.id)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                title={label("delete")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Edit form (expands below) */}
                          {isEditing && (
                            <div className="px-5 py-4 bg-muted/20 border-t border-border">
                              <div className="flex items-center gap-2 mb-4">
                                <Pencil className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-semibold text-primary uppercase tracking-wider">{label("editingPlan")}</span>
                              </div>

                              {/* Anchor selector */}
                              <div className="mb-3">
                                <label className="text-xs text-muted-foreground block mb-1.5">{label("planMode")}</label>
                                <div className="flex gap-1.5">
                                  {([
                                    { key: "fixedPace", label: label("fixedPace"), anchor: "pagesPerDay" as const },
                                    { key: "fixedDeadline", label: label("fixedDeadline"), anchor: "endDate" as const },
                                    { key: "fixedDuration", label: label("fixedDuration"), anchor: "endDate" as const },
                                  ]).map((preset) => {
                                    const isActive =
                                      (preset.key === "fixedPace" && editAnchor === "pagesPerDay") ||
                                      (preset.key !== "fixedPace" && editAnchor === "endDate" &&
                                        ((preset.key === "fixedDeadline" && !editTargetDayCount) ||
                                         (preset.key === "fixedDuration" && !!editTargetDayCount)))
                                    return (
                                      <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => {
                                          setEditAnchor(preset.anchor)
                                          if (preset.key === "fixedPace") {
                                            setEditTargetEndDate(undefined)
                                            setEditTargetDayCount(undefined)
                                          } else if (preset.key === "fixedDeadline") {
                                            setEditTargetDayCount(undefined)
                                          } else if (preset.key === "fixedDuration") {
                                            setEditTargetEndDate(undefined)
                                            setEditTargetDayCount(editTargetDayCount ?? 30)
                                          }
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                          isActive
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {editAnchor === "pagesPerDay" && label("planModeDescPace")}
                                  {editAnchor === "endDate" && !editTargetDayCount && label("planModeDescDeadline")}
                                  {editAnchor === "endDate" && !!editTargetDayCount && label("planModeDescDuration")}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">{label("planName")}</label>
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">{label("startDate")}</label>
                                  <DatePicker
                                    value={editStartDate}
                                    onChange={(v) => setEditStartDate(v || localToday())}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    Target end date
                                    {editAnchor === "endDate" && !editTargetDayCount && (
                                      <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                                    )}
                                  </label>
                                  <DatePicker
                                    value={editTargetEndDate}
                                    onChange={(v) => setEditTargetEndDate(v || undefined)}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    {labels.perDay}
                                    {editAnchor === "pagesPerDay" && (
                                      <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                                    )}
                                    {editAnchor === "endDate" && (
                                      <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">(auto)</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={editPagesPerDay}
                                    onChange={(e) => setEditPagesPerDay(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">
                                    Target study days
                                    {editAnchor === "endDate" && !!editTargetDayCount && (
                                      <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={editTargetDayCount ?? ""}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10)
                                      setEditTargetDayCount(isNaN(val) ? undefined : val)
                                    }}
                                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block mb-1">{label("startingChapter")}</label>
                                  <select
                                    value={editStartingChapterId}
                                    onChange={(e) => setEditStartingChapterId(Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  >
                                    {getOrderedChapters(course, editUnitOrder).map((ch) => (
                                      <option key={ch.id} value={ch.id}>
                                        Ch {ch.id}: {ch.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Unit order (drag via arrow buttons) */}
                              <div className="mt-3">
                                {planHasLogs && (
                                  <div className="mb-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                      Unit order is frozen after logging begins. Create a new plan to change the order.
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs text-muted-foreground font-medium">{label("studyOrder")}</label>
                                  {editUnitOrder && editUnitOrder.length > 0 ? (
                                    <button
                                      onClick={() => setEditUnitOrder(undefined)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                                    >
                                      {label("resetToDefault")}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setEditUnitOrder(course.units.map((u) => u.id))}
                                      className="text-[10px] text-primary hover:underline"
                                    >
                                      {label("customizeOrder")}
                                    </button>
                                  )}
                                </div>
                                {editUnitOrder && editUnitOrder.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {editUnitOrder.map((uid, idx) => {
                                      const unit = course.units.find((u) => u.id === uid)
                                      if (!unit) return null
                                      const defaultIdx = course.units.findIndex((u) => u.id === uid)
                                      const domainLabel = defaultIdx >= 0 ? `D${defaultIdx + 1}` : `U${uid}`
                                      return (
                                        <div key={uid} className="flex items-stretch border border-border rounded-lg bg-background overflow-hidden">
                                          <div className="w-1 flex-shrink-0" style={{ backgroundColor: unit.color }} />
                                          <button
                                            disabled={idx === 0}
                                            onClick={() => {
                                              const next = [...editUnitOrder]
                                              ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                              setEditUnitOrder(next)
                                            }}
                                            className={`px-0.5 ${idx === 0 ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted"} transition-colors`}
                                          >
                                            <ChevronLeft className="w-3 h-3" />
                                          </button>
                                          <div className="flex flex-col items-center justify-center px-1.5 py-1 min-w-[34px]">
                                            <span className="text-[11px] font-bold text-foreground leading-tight">{domainLabel}</span>
                                            <span className="text-[9px] text-muted-foreground/50 leading-none">{unit.chapters.length}ch</span>
                                          </div>
                                          <button
                                            disabled={idx === editUnitOrder.length - 1}
                                            onClick={() => {
                                              const next = [...editUnitOrder]
                                              ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                                              setEditUnitOrder(next)
                                            }}
                                            className={`px-0.5 ${idx === editUnitOrder.length - 1 ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted"} transition-colors`}
                                          >
                                            <ChevronRight className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                {editUnitOrder && editUnitOrder.length > 0 && (
                                  <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                                    Starting Chapter dropdown above follows this same order — pick the first chapter you want to study from.
                                  </p>
                                )}
                              </div>

                              {/* Live derivation preview */}
                              {(() => {
                                const planChs = getOrderedChapters(course, editUnitOrder)
                                const previewPlan: StudyPlan = {
                                  ...plan,
                                  name: editName,
                                  startDate: editStartDate,
                                  pagesPerDay: editPagesPerDay,
                                  studyDays: editStudyDays,
                                  startingChapterId: editStartingChapterId,
                                  targetEndDate: editTargetEndDate,
                                  targetDayCount: editTargetDayCount,
                                  anchor: editAnchor,
                                }
                                const params = syncStudyPlan(previewPlan, planChs, localToday())
                                return (
                                  <div className="mb-3 p-2.5 rounded-lg bg-background border border-border">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                      <span className="text-muted-foreground">{label("derivedPace")}</span>
                                      <span className="font-semibold text-foreground">{params.pagesPerDay} {labels.perDay.toLowerCase()}</span>
                                      <span className="text-muted-foreground">{label("endDate")}</span>
                                      <span className="font-semibold text-foreground">{params.endDate ?? "—"}</span>
                                      {params.warnings.length > 0 && (
                                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{params.warnings[0]}</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}
                              <div className="mb-3">
                                  <label className="text-xs text-muted-foreground block mb-1">{label("studyDaysLabel")}</label>
                                <div className="flex gap-1 max-w-sm">
                                  {DAY_LABELS.map(({ dow, short }) => {
                                    const active = editStudyDays.includes(dow)
                                    return (
                                      <button
                                        key={dow}
                                        type="button"
                                        onClick={() => {
                                          const next = active
                                            ? editStudyDays.filter((d) => d !== dow)
                                            : [...editStudyDays, dow].sort()
                                          if (next.length > 0) setEditStudyDays(next)
                                        }}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                          active
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-muted-foreground border-border"
                                        }`}
                                      >
                                        {short}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEdit(plan.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                                >
                                  <Save className="w-3 h-3" />
                                  {label("saveChanges")}
                                </button>
                                <button
                                  onClick={() => setEditingPlanId(null)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                  {label("cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add another plan button */}
                    {coursePlans.length > 0 && !isCreating && (
                      <div className="px-5 py-3 border-t border-border">
                        <button
                          onClick={() => setCreatingForCourseId(course.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {label("addAnotherPlan")}
                        </button>
                      </div>
                    )}

                    {/* Create plan inline — full settings form */}
                    {isCreating && (
                      <div className="px-5 py-4 bg-primary/[0.03] border-t border-border">
                        <div className="flex items-center gap-2 mb-4">
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">{label("newPlanSettings")}</span>
                        </div>

                        {/* Anchor selector */}
                        <div className="mb-3">
                            <label className="text-xs text-muted-foreground block mb-1.5">{label("planMode")}</label>
                          <div className="flex gap-1.5">
                            {([
                              { key: "fixedPace", label: "Fixed Pace", anchor: "pagesPerDay" as const },
                              { key: "fixedDeadline", label: "Fixed Deadline", anchor: "endDate" as const },
                              { key: "fixedDuration", label: "Fixed Duration", anchor: "endDate" as const },
                            ]).map((preset) => {
                              const isActive =
                                (preset.key === "fixedPace" && editAnchor === "pagesPerDay") ||
                                (preset.key !== "fixedPace" && editAnchor === "endDate" &&
                                  ((preset.key === "fixedDeadline" && !editTargetDayCount) ||
                                   (preset.key === "fixedDuration" && !!editTargetDayCount)))
                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => {
                                    setEditAnchor(preset.anchor)
                                    if (preset.key === "fixedPace") {
                                      setEditTargetEndDate(undefined)
                                      setEditTargetDayCount(undefined)
                                    } else if (preset.key === "fixedDeadline") {
                                      setEditTargetDayCount(undefined)
                                    } else if (preset.key === "fixedDuration") {
                                      setEditTargetEndDate(undefined)
                                      setEditTargetDayCount(editTargetDayCount ?? 30)
                                    }
                                  }}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    isActive
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {editAnchor === "pagesPerDay" && "You set the daily pace. End date is calculated automatically."}
                            {editAnchor === "endDate" && !editTargetDayCount && "You set the finish date. Daily pace is calculated automatically."}
                            {editAnchor === "endDate" && !!editTargetDayCount && "You set the number of study days. Pace and end date are calculated automatically."}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Plan name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="New Plan"
                              className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Start date</label>
                            <DatePicker
                              value={editStartDate}
                              onChange={(v) => setEditStartDate(v || localToday())}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">
                              Target end date
                              {editAnchor === "endDate" && !editTargetDayCount && (
                                <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                              )}
                            </label>
                            <DatePicker
                              value={editTargetEndDate}
                              onChange={(v) => setEditTargetEndDate(v || undefined)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">
                              {labels.perDay}
                              {editAnchor === "pagesPerDay" && (
                                <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                              )}
                              {editAnchor === "endDate" && (
                                <span className="ml-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold">(auto)</span>
                              )}
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={editPagesPerDay}
                              onChange={(e) => setEditPagesPerDay(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">
                              Target study days
                              {editAnchor === "endDate" && !!editTargetDayCount && (
                                <span className="ml-1 text-[10px] text-primary font-semibold">(anchor)</span>
                              )}
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={editTargetDayCount ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                setEditTargetDayCount(isNaN(val) ? undefined : val)
                              }}
                              className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Starting chapter</label>
                            <select
                              value={editStartingChapterId}
                              onChange={(e) => setEditStartingChapterId(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              {getOrderedChapters(course, editUnitOrder).map((ch) => (
                                <option key={ch.id} value={ch.id}>
                                  Ch {ch.id}: {ch.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Unit order */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-muted-foreground font-medium">Study Order</label>
                            {editUnitOrder && editUnitOrder.length > 0 ? (
                              <button
                                onClick={() => setEditUnitOrder(undefined)}
                                className="text-[10px] text-muted-foreground hover:text-foreground underline"
                              >
                                Reset to Default
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditUnitOrder(course.units.map((u) => u.id))}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Customize Order
                              </button>
                            )}
                          </div>
                          {editUnitOrder && editUnitOrder.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {editUnitOrder.map((uid, idx) => {
                                const unit = course.units.find((u) => u.id === uid)
                                if (!unit) return null
                                const defaultIdx = course.units.findIndex((u) => u.id === uid)
                                const domainLabel = defaultIdx >= 0 ? `D${defaultIdx + 1}` : `U${uid}`
                                return (
                                  <div key={uid} className="flex items-stretch border border-border rounded-lg bg-background overflow-hidden">
                                    <div className="w-1 flex-shrink-0" style={{ backgroundColor: unit.color }} />
                                    <button
                                      disabled={idx === 0}
                                      onClick={() => {
                                        const next = [...editUnitOrder]
                                        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                        setEditUnitOrder(next)
                                      }}
                                      className={`px-0.5 ${idx === 0 ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted"} transition-colors`}
                                    >
                                      <ChevronLeft className="w-3 h-3" />
                                    </button>
                                    <div className="flex flex-col items-center justify-center px-1.5 py-1 min-w-[34px]">
                                      <span className="text-[11px] font-bold text-foreground leading-tight">{domainLabel}</span>
                                      <span className="text-[9px] text-muted-foreground/50 leading-none">{unit.chapters.length}ch</span>
                                    </div>
                                    <button
                                      disabled={idx === editUnitOrder.length - 1}
                                      onClick={() => {
                                        const next = [...editUnitOrder]
                                        ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                                        setEditUnitOrder(next)
                                      }}
                                      className={`px-0.5 ${idx === editUnitOrder.length - 1 ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted"} transition-colors`}
                                    >
                                      <ChevronRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          {editUnitOrder && editUnitOrder.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                              Starting Chapter dropdown above follows this same order — pick the first chapter you want to study from.
                            </p>
                          )}
                        </div>

                        {/* Live derivation preview */}
                        {(() => {
                          const planChs = getOrderedChapters(course, editUnitOrder)
                          const previewPlan: StudyPlan = {
                            id: "__preview__",
                            courseId: course.id,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            name: editName.trim() || "New Plan",
                            startDate: editStartDate,
                            pagesPerDay: Math.max(1, editPagesPerDay),
                            studyDays: editStudyDays,
                            startingChapterId: editStartingChapterId,
                            chapterStartOverrides: {},
                            targetEndDate: editTargetEndDate,
                            targetDayCount: editTargetDayCount,
                            anchor: editAnchor,
                            dailyLog: {},
                            skippedDays: [],
                            unitOrder: editUnitOrder,
                          }
                          const params = syncStudyPlan(previewPlan, planChs, localToday())
                          return (
                            <div className="mb-3 mt-3 p-2.5 rounded-lg bg-background border border-border">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <span className="text-muted-foreground">Derived pace:</span>
                                <span className="font-semibold text-foreground">{params.pagesPerDay} {labels.perDay.toLowerCase()}</span>
                                <span className="text-muted-foreground">End date:</span>
                                <span className="font-semibold text-foreground">{params.endDate ?? "—"}</span>
                                {params.warnings.length > 0 && (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{params.warnings[0]}</span>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                        {/* Study days */}
                        <div className="mb-3">
                          <label className="text-xs text-muted-foreground block mb-1">Study days</label>
                          <div className="flex gap-1 max-w-sm">
                            {DAY_LABELS.map(({ dow, short }) => {
                              const active = editStudyDays.includes(dow)
                              return (
                                <button
                                  key={dow}
                                  type="button"
                                  onClick={() => {
                                    const next = active
                                      ? editStudyDays.filter((d) => d !== dow)
                                      : [...editStudyDays, dow].sort()
                                    if (next.length > 0) setEditStudyDays(next)
                                  }}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    active
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border"
                                  }`}
                                >
                                  {short}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreatePlanSave(course.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {label("createPlan")}
                          </button>
                          <button
                            onClick={() => setCreatingForCourseId(null)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            {label("cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
