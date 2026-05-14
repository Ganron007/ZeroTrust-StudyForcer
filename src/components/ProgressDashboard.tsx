"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { generateSchedule, getTotalPages, getOrderedChapters, type StudyDay } from "@/lib/cissp-data"
import { syncStudyPlan } from "@/lib/plan-engine"
import { planStorage, type StudyPlan } from "@/lib/plan-storage"
import { useCourse } from "@/components/CourseProvider"
import type { CourseConfig, Chapter } from "@/types/course"
import { getTrackingLabels } from "@/types/course"
import {
  Trophy, Target, Flame, Calendar, TrendingUp, BookOpen, Clock, Info,
} from "lucide-react"

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
  const completedDays = new Set(Object.keys(plan.dailyLog))
  const dailyLog = plan.dailyLog

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
  const estEndDate = new Date(plan.startDate + "T00:00:00")
  estEndDate.setDate(estEndDate.getDate() + totalDays - 1)

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
  for (const day of schedule) {
    for (const ch of day.chapters) {
      const entry = unitProgress[ch.unit]
      if (!entry) continue
      entry.total += ch.pagesCount
      if (completedDays.has(day.date)) {
        entry.completed += ch.pagesCount
      }
    }
  }

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const day of [...schedule].reverse()) {
    const d = new Date(day.date + "T00:00:00")
    if (completedDays.has(day.date)) {
      streak++
    } else if (d < today) {
      break
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
    doneCount,
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
  const { courses, activeCourse, unitWeights } = useCourse()
  const [allPlans, setAllPlans] = useState<StudyPlan[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    planStorage.getAll().then((plans) => {
      if (cancelled) return
      setAllPlans(plans)
    })
    return () => { cancelled = true }
  }, [courses.length])

  const statsMap = useMemo(() => {
    const map: Record<string, CourseStats> = {}
    for (const course of courses) {
      const plan = allPlans.find((p) => p.courseId === course.id)
      if (!plan) continue
      try {
        map[course.id] = computeCourseStats(course, plan)
      } catch (e) {
        console.error("Failed to compute stats for", course.id, e)
      }
    }
    return map
  }, [courses, allPlans])

  // Only show pills for courses that are SELECTED and have stats
  const courseIdsWithStats = useMemo(
    () => selectedCourseIds.filter((id) => statsMap[id]),
    [selectedCourseIds, statsMap]
  )

  // Default to active course if selected, otherwise first selected with stats
  const viewingCourseId = selectedCourseId && statsMap[selectedCourseId]
    ? selectedCourseId
    : activeCourse && selectedCourseIds.includes(activeCourse.id) && statsMap[activeCourse.id]
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
        <p className="text-sm">No courses selected. Select a course from the dropdown to see progress.</p>
      </div>
    )
  }

  if (courseIdsWithStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Info className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Selected courses have no plans yet. Open the Planner to create one.</p>
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
                <h3 className="font-semibold text-foreground">{stats.courseName} — Overall Progress</h3>
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
            <span>{(stats.totalPages - stats.pagesRead).toLocaleString()} {labels.items} remaining</span>
          </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Days Completed",
                value: `${stats.doneCount}/${stats.totalDays}`,
                icon: Calendar,
                iconClass: "text-blue-500",
                bgClass: "bg-blue-500/10",
              },
              {
                label: `${labels.itemsCapital} ${labels.pagesReadShort === "read" ? "Read" : labels.pagesReadShort === "done" ? "Done" : "Owned"}`,
                value: `${stats.pagesRead.toLocaleString()}`,
                icon: BookOpen,
                iconClass: "text-emerald-500",
                bgClass: "bg-emerald-500/10",
                sub: `of ${stats.totalPages.toLocaleString()}`,
              },
              {
                label: "Study Streak",
                value: `${stats.streak}`,
                icon: Flame,
                iconClass: "text-amber-500",
                bgClass: "bg-amber-500/10",
                sub: "days in a row",
              },
              {
                label: "Est. Completion",
                value: formatDate(stats.estEndDate),
                icon: Target,
                iconClass: "text-violet-500",
                bgClass: "bg-violet-500/10",
              },
            ].map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bgClass}`}>
                      <Icon className={`w-4 h-4 ${card.iconClass}`} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground leading-tight">{card.value}</p>
                  {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </div>
              )
            })}
          </div>

          {/* Unit Breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground text-sm">Progress by Unit</h3>
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
                          <span className="text-xs text-muted-foreground">{weight}% exam</span>
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
                  {dp.completed}/{dp.total} {labels.items}
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
              <h3 className="font-semibold text-foreground text-sm">Pace Analysis</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{labels.dailyTarget}</span>
                <span className="text-sm font-semibold text-foreground">{stats.plan.pagesPerDay} {labels.items}</span>
              </div>
              {stats.loggedCount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Actual avg. pace</span>
                  <span className={`text-sm font-semibold ${stats.avgActualPace >= stats.plan.pagesPerDay ? "text-green-500" : "text-amber-500"}`}>
                    {stats.avgActualPace} {labels.paceLabel}
                    {" "}({stats.avgActualPace >= stats.plan.pagesPerDay ? "on track" : "behind"})
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Total study days</span>
                <span className="text-sm font-semibold text-foreground">{stats.totalDays} days</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Days remaining</span>
                <span className="text-sm font-semibold text-foreground">{stats.remainingDays} days</span>
              </div>
              {viewingCourse?.studyEstimate && (
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Avg. mins/day*</span>
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(stats.plan.pagesPerDay * viewingCourse.studyEstimate.minutesPerPage[0])}–
                    {Math.round(stats.plan.pagesPerDay * viewingCourse.studyEstimate.minutesPerPage[1])} min
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Est. finish date</span>
                <span className="text-sm font-bold text-primary">{formatDate(stats.estEndDate)}</span>
              </div>
            </div>
            {viewingCourse?.studyEstimate && (
              <p className="text-xs text-muted-foreground mt-3">
                * Estimated {viewingCourse.studyEstimate.minutesPerPage[0]}–{viewingCourse.studyEstimate.minutesPerPage[1]} min per {labels.item}
              </p>
            )}
          </div>

          {/* Exam Info */}
          {viewingCourse?.examInfo && (
            <div className="rounded-xl p-5 border border-primary/25 bg-primary/5">
              <h3 className="font-semibold text-sm mb-3 text-primary">
                {viewingCourse.name} Exam Overview
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                {viewingCourse.examInfo.format && (
                  <><span className="text-muted-foreground">Format</span><span className="font-medium text-foreground">{viewingCourse.examInfo.format}</span></>
                )}
                {viewingCourse.examInfo.duration && (
                  <><span className="text-muted-foreground">Duration</span><span className="font-medium text-foreground">{viewingCourse.examInfo.duration}</span></>
                )}
                {viewingCourse.examInfo.passingScore && (
                  <><span className="text-muted-foreground">Passing score</span><span className="font-medium text-foreground">{viewingCourse.examInfo.passingScore}</span></>
                )}
                {viewingCourse.examInfo.domainsLabel && (
                  <><span className="text-muted-foreground">Domains</span><span className="font-medium text-foreground">{viewingCourse.examInfo.domainsLabel}</span></>
                )}
                {viewingCourse.examInfo.experienceReq && (
                  <><span className="text-muted-foreground">Experience req.</span><span className="font-medium text-foreground">{viewingCourse.examInfo.experienceReq}</span></>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
