"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { generateSchedule, getTotalPages, getOrderedChapters, type StudyDay } from "@/lib/cissp-data"
import { syncStudyPlan } from "@/lib/plan-engine"
import type { StudyPlan } from "@/lib/plan-storage"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "@/components/CourseProvider"
import type { CourseConfig, Chapter } from "@/types/course"
import { getTrackingLabels } from "@/types/course"
import {
  Trophy, Target, Flame, Calendar, TrendingUp, BookOpen, Clock, Info,
} from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"

interface CourseStats {
  courseId: string
  courseName: string
  color: string
  plan: StudyPlan
  schedule: StudyDay[]
  chapters: Chapter[]
  totalPages: number
  totalDays: number
  doneCount: number
  pagesRead: number
  pctDone: number
  estEndDate: Date
  unitProgress: Record<number, { completed: number; total: number; name: string; color: string; unitId: number }>
  streak: number
  remainingDays: number
  avgActualPace: number
  loggedCount: number
}

function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function computeCourseStats(cfg: CourseConfig, plan: StudyPlan): CourseStats {
  const chapters = getOrderedChapters(cfg, plan.unitOrder)
  const params = syncStudyPlan(plan, chapters, localToday())
  const result = generateSchedule(plan, chapters, localToday(), params.pagesPerDay, params.endDate)
  const schedule = result.schedule
  const dailyLog = plan.dailyLog

  // C1: Only count days with pagesRead > 0 as "completed"
  const completedDays = new Set(
    Object.entries(dailyLog)
      .filter(([, log]) => log.pagesRead > 0)
      .map(([date]) => date)
  )

  const totalDays = schedule.length
  const doneCount = completedDays.size
  const totalPages = getTotalPages(plan.chapterStartOverrides, plan.startingChapterId, chapters)

  // Stats come from the math engine (logs only = reality-based)
  const pagesRead = params.consumed

  const loggedDays = Object.values(dailyLog)
  const avgActualPace =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, l) => s + l.pagesRead, 0) / loggedDays.length)
      : plan.pagesPerDay
  const pctDone = totalPages > 0 ? Math.min(100, Math.round((pagesRead / totalPages) * 100)) : 0

  const remainingDays = totalDays - doneCount
  // C5: Guard against undefined startDate
  const estEndDate = (() => {
    try {
      const d = new Date((plan.startDate || localToday()) + "T00:00:00")
      d.setDate(d.getDate() + totalDays - 1)
      return d
    } catch {
      return new Date()
    }
  })()

  const unitProgress: Record<number, { completed: number; total: number; name: string; color: string; unitId: number }> = {}
  for (const u of cfg.units) {
    unitProgress[u.id] = {
      completed: 0,
      total: 0,
      name: u.title,
      color: u.color,
      unitId: u.id,
    }
  }

  // A50: Scale per-day completion by pagesRead / day.totalPages to prevent
  // partial-log days from counting as fully completed
  for (const day of schedule) {
    const dayPagesRead = dailyLog[day.date]?.pagesRead ?? 0
    const completedFraction = day.totalPages > 0 ? Math.min(dayPagesRead / day.totalPages, 1) : 0
    for (const ch of day.chapters) {
      const entry = unitProgress[ch.unit]
      if (!entry) continue
      entry.total += ch.pagesCount
      if (completedDays.has(day.date)) {
        entry.completed += ch.pagesCount * completedFraction
      }
    }
  }

  // A51: Count streak from today backward, not from schedule end
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check today first
  const todayStr = localToday()
  if (completedDays.has(todayStr)) {
    streak = 1
  } else {
    // Check yesterday — if yesterday wasn't completed, streak is 0
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
    if (!completedDays.has(yStr)) {
      streak = 0
    } else {
      streak = 1
    }
  }

  // Walk backward from yesterday (or today if today was completed)
  if (streak > 0) {
    const walkDate = new Date(today)
    walkDate.setDate(walkDate.getDate() - 1)
    while (true) {
      const dStr = `${walkDate.getFullYear()}-${String(walkDate.getMonth() + 1).padStart(2, "0")}-${String(walkDate.getDate()).padStart(2, "0")}`
      if (completedDays.has(dStr)) {
        streak++
        walkDate.setDate(walkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  return {
    courseId: cfg.id,
    courseName: cfg.name,
    color: cfg.units[0]?.color ?? "#2563EB",
    plan,
    schedule,
    chapters,
    totalPages,
    totalDays,
    doneCount: completedDays.size,
    pagesRead,
    pctDone,
    estEndDate,
    unitProgress,
    streak,
    remainingDays,
    avgActualPace,
    loggedCount: loggedDays.length,
  }
}

interface ProgressDashboardProps {
  selectedCourseIds?: string[]
}

export default function ProgressDashboard({ selectedCourseIds = [] }: ProgressDashboardProps) {
  const { label, empty } = usePersonality()
  const { courses, activeCourse, unitWeights } = useCourse()

  // A49: Consume Zustand store instead of planStorage.getAll directly
  const allPlans = usePlanStore(s => s.allPlans)
  const activePlanIds = usePlanStore(s => s.activePlanIds)
  const primaryActivePlanId = usePlanStore(s => s.primaryActivePlanId)

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // A49: For each selected course, pick the active plan (preferring the primary
  // active plan for the course, falling back to any active plan, then any plan).
  const statsMap = useMemo(() => {
    const map: Record<string, CourseStats> = {}
    for (const courseId of selectedCourseIds.length > 0 ? selectedCourseIds : courses.map(c => c.id)) {
      const cfg = courses.find((c) => c.id === courseId)
      if (!cfg) continue

      // Find active plans for this course
      const courseActivePlans = allPlans.filter(
        (p) => p.courseId === courseId && activePlanIds.includes(p.id)
      )
      // Prefer primary, fall back to first active, fall back to first overall
      const plan = courseActivePlans.find((p) => p.id === primaryActivePlanId)
        ?? courseActivePlans[0]
        ?? allPlans.find((p) => p.courseId === courseId)

      if (!plan || plan.dailyLog === undefined) continue
      try {
        map[courseId] = computeCourseStats(cfg, plan)
      } catch (e) {
        console.error("Failed to compute stats for", courseId, e)
      }
    }
    return map
  }, [courses, allPlans, activePlanIds, primaryActivePlanId, selectedCourseIds])

  // Only show pills for courses that have stats
  const courseIdsWithStats = useMemo(
    () => Object.keys(statsMap),
    [statsMap]
  )

  // Default to active course if selected, otherwise first with stats
  const viewingCourseId = selectedCourseId && statsMap[selectedCourseId]
    ? selectedCourseId
    : activeCourse && statsMap[activeCourse.id]
    ? activeCourse.id
    : courseIdsWithStats[0] ?? null

  const stats = viewingCourseId ? statsMap[viewingCourseId] : null
  const viewingCourse = courses.find((c) => c.id === viewingCourseId)
  const labels = getTrackingLabels(viewingCourse?.trackingMode)

  const formatDate = useCallback((d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  , [])

  if (selectedCourseIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Info className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">{label("noCoursesSelected")}</p>
      </div>
    )
  }

  if (courseIdsWithStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Info className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">{label("noPlansForStats")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Course selector pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {courseIdsWithStats.map((id) => {
          const s = statsMap[id]
          const isActive = id === viewingCourseId
          return (
            <button
              key={id}
              onClick={() => setSelectedCourseId(id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="whitespace-nowrap">{s.courseName}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {s.pctDone}%
              </span>
            </button>
          )
        })}
      </div>

      {!stats || !viewingCourse ? null : (
        <>
          {/* Overall Progress */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-foreground">{stats.courseName} — {label("overallProgress")}</h3>
              </div>
              <span className="text-2xl font-bold text-primary">{stats.pctDone}%</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${stats.pctDone}%`,
                  background: `linear-gradient(90deg, #2563EB, #7C3AED)`,
                }}
              />
            </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.pagesRead.toLocaleString()} {labels.pagesRead}</span>
            <span>{(stats.totalPages - stats.pagesRead).toLocaleString()} {label("remaining")}</span>
          </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                labelKey: "daysCompleted",
                value: `${stats.doneCount}/${stats.totalDays}`,
                icon: Calendar,
                iconClass: "text-blue-500",
                bgClass: "bg-blue-500/10",
              },
              {
                labelKey: labels.pagesReadShort === "read" ? "readStatus" : labels.pagesReadShort === "done" ? "doneStatus" : "ownedStatus",
                value: `${stats.pagesRead.toLocaleString()}`,
                icon: BookOpen,
                iconClass: "text-emerald-500",
                bgClass: "bg-emerald-500/10",
                sub: label("ofTotal") + ` ${stats.totalPages.toLocaleString()}`,
              },
              {
                labelKey: "studyStreak",
                value: `${stats.streak}`,
                icon: Flame,
                iconClass: "text-amber-500",
                bgClass: "bg-amber-500/10",
                sub: label("daysInARow"),
              },
              {
                labelKey: "estCompletion",
                value: formatDate(stats.estEndDate),
                icon: Target,
                iconClass: "text-violet-500",
                bgClass: "bg-violet-500/10",
              },
            ].map((card) => {
              const Icon = card.icon
              return (
                <div key={card.labelKey} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bgClass}`}>
                      <Icon className={`w-4 h-4 ${card.iconClass}`} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground leading-tight">{card.value}</p>
                  {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{label(card.labelKey)}</p>
                </div>
              )
            })}
          </div>

          {/* Unit Breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-sm">{label("progressByUnit")}</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(stats.unitProgress).map(([key, dp]) => {
                const pct = dp.total > 0 ? Math.round((dp.completed / dp.total) * 100) : 0
                const weight = unitWeights[dp.unitId]
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dp.color }} />
                        <span className="text-xs font-medium text-foreground truncate">{dp.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {weight > 0 && (
                          <span className="text-xs text-muted-foreground">{label("examWeight")}: {weight}%</span>
                        )}
                        <span className="text-xs font-bold text-foreground">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: dp.color }}
                      />
                    </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Math.round(dp.completed)}/{dp.total} {labels.items}
                </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pace Analysis */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-sm">{label("paceAnalysis")}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{labels.dailyTarget}</span>
                <span className="text-sm font-semibold text-foreground">{stats.plan.pagesPerDay} {labels.items}</span>
              </div>
              {stats.loggedCount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">{label("actualAvgPace")}</span>
                  <span className={`text-sm font-semibold ${stats.avgActualPace >= stats.plan.pagesPerDay ? "text-green-500" : "text-amber-500"}`}>
                    {stats.avgActualPace} {labels.paceLabel}
                    {" "}({stats.avgActualPace >= stats.plan.pagesPerDay ? label("onTrack") : label("behind")})
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{label("totalStudyDays")}</span>
                <span className="text-sm font-semibold text-foreground">{stats.totalDays} {label("days")}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{label("daysRemaining")}</span>
                <span className="text-sm font-semibold text-foreground">{stats.remainingDays} {label("days")}</span>
              </div>
              {viewingCourse?.studyEstimate && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">{label("avgMinsPerDay")}</span>
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(stats.plan.pagesPerDay * viewingCourse.studyEstimate.minutesPerPage[0])}–
                    {Math.round(stats.plan.pagesPerDay * viewingCourse.studyEstimate.minutesPerPage[1])} min
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">{label("estFinishDate")}</span>
                <span className="text-sm font-bold text-primary">{formatDate(stats.estEndDate)}</span>
              </div>
            </div>
            {viewingCourse?.studyEstimate && (
              <p className="text-xs text-muted-foreground mt-3">
                * {label("estimatedStudyNote")}
              </p>
            )}
          </div>

          {/* Exam Info */}
          {viewingCourse?.examInfo && (
            <div className="rounded-xl p-5 border border-primary/25 bg-primary/5">
              <h3 className="font-semibold text-sm mb-3 text-primary">
                {formatStr(label("examOverview"), { name: viewingCourse.name })}
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                {viewingCourse.examInfo.format && (
                  <><span className="text-muted-foreground">{label("examFormat")}</span><span className="font-medium text-foreground">{viewingCourse.examInfo.format}</span></>
                )}
                {viewingCourse.examInfo.duration && (
                  <><span className="text-muted-foreground">{label("examDuration")}</span><span className="font-medium text-foreground">{viewingCourse.examInfo.duration}</span></>
                )}
                {viewingCourse.examInfo.passingScore && (
                  <><span className="text-muted-foreground">{label("examPassingScore")}</span><span className="font-medium text-foreground">{viewingCourse.examInfo.passingScore}</span></>
                )}
                {viewingCourse.examInfo.domainsLabel && (
                  <><span className="text-muted-foreground">{label("examDomains")}</span><span className="font-medium text-foreground">{viewingCourse.examInfo.domainsLabel}</span></>
                )}
                {viewingCourse.examInfo.experienceReq && (
                  <><span className="text-muted-foreground">{label("examExperienceReq")}</span><span className="font-medium text-foreground">{viewingCourse.examInfo.experienceReq}</span></>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
