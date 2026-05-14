"use client"

import { useState, useMemo } from "react"
import { type StudyDay, getDayStartBookPage, resolveBookPage } from "@/lib/cissp-data"
import { type DailyLog } from "@/lib/plan-storage"
import { useCourse } from "@/components/CourseProvider"
import { BookOpen, CheckCircle2, X, TrendingUp, TrendingDown, Minus, PenLine, HelpCircle } from "lucide-react"
import { type ChapterCheck } from "@/lib/plan-storage"
import type { Chapter } from "@/types/course"
import { getTrackingLabels } from "@/types/course"

/** Full data needed to render the page-tracking section for one course in the log modal. */
export interface CourseLogEntry {
  courseId: string
  courseName: string
  chapters: Chapter[]
  totalBookPages: number
  unitColors: Record<number, string>
  schedule: StudyDay[]
  dailyLog: Record<string, DailyLog>
  startingChapterId: number
  chapterStartOverrides: Record<number, number>
}

interface DailyLogModalProps {
  day: StudyDay
  schedule: StudyDay[]
  existingLog?: DailyLog
  isCompleted: boolean
  startingChapterId: number
  chapterStartOverrides: Record<number, number>
  dailyLog: Record<string, DailyLog>
  showMerged?: boolean
  /** Original merged-view day (chapters from all selected courses). */
  mergedDay?: StudyDay | null
  /** Each non-active selected course's full data for merged display. */
  otherCourses?: CourseLogEntry[]
  /** Each other plan's existing daily-log entry for this date (keyed by courseId). */
  otherExistingLogs?: Record<string, DailyLog | undefined>
  /** Whether each other plan considers this date completed (keyed by courseId). */
  otherIsCompletedMap?: Record<string, boolean>
  onSave: (
    date: string,
    log: DailyLog,
    markComplete: boolean,
    otherUpdates?: Array<{ courseId: string; log: DailyLog; markComplete: boolean }>,
  ) => void
  onSkipDay?: (date: string, courseId: string) => void
  onClose: () => void
}

export default function DailyLogModal({
  day, schedule, existingLog, isCompleted,
  startingChapterId, chapterStartOverrides, dailyLog,
  showMerged, mergedDay, otherCourses = [], otherExistingLogs = {}, otherIsCompletedMap = {},
  onSave, onSkipDay, onClose,
}: DailyLogModalProps) {
  const { chapters, totalBookPages, unitColors, activeCourse } = useCourse()
  const labels = getTrackingLabels(activeCourse?.trackingMode)

  // ── Active course — dayStartBookPage ──────────────────────────────────────────
  const activeDayStart = useMemo(
    () => getDayStartBookPage(schedule, day.dayNumber, dailyLog, startingChapterId, chapterStartOverrides, chapters),
    [schedule, day.dayNumber, dailyLog, startingChapterId, chapterStartOverrides, chapters]
  )
  const activePlanned = day.totalPages
  const activeDefaultEnd = existingLog
    ? activeDayStart + existingLog.pagesRead - 1
    : activeDayStart + activePlanned - 1

  const [activeInputValue, setActiveInputValue] = useState(String(Math.min(activeDefaultEnd, totalBookPages)))
  const [activeBookPage, setActiveBookPage] = useState(Math.min(activeDefaultEnd, totalBookPages))
  const activePagesRead = Math.max(0, activeBookPage - activeDayStart + 1)

  // ── Other courses — per-courseId derived data ────────────────────────────────
  // Each entry: the StudyDay (or null), its dayStart book page, planned pages,
  // computed default-end book page, and the other plan's existing log if any.
  type OtherDerived = {
    info: CourseLogEntry
    otherDay: StudyDay | null
    dayStart: number
    planned: number
    bookTotal: number
    defaultEnd: number
    existingLog?: DailyLog
    isCompleted: boolean
  }
  const otherDerivedList: OtherDerived[] = useMemo(() => {
    if (!showMerged) return []
    return otherCourses.map((info) => {
      const otherDay = info.schedule.find((d) => d.date === day.date) ?? null
      const dayStart = otherDay
        ? getDayStartBookPage(
            info.schedule, otherDay.dayNumber, info.dailyLog,
            info.startingChapterId, info.chapterStartOverrides, info.chapters,
          )
        : 1
      const planned = otherDay?.totalPages ?? 0
      const bookTotal = info.totalBookPages
      const ex = otherExistingLogs[info.courseId]
      const defaultEnd = otherDay
        ? (ex ? dayStart + ex.pagesRead - 1 : dayStart + planned - 1)
        : 0
      return {
        info,
        otherDay,
        dayStart,
        planned,
        bookTotal,
        defaultEnd,
        existingLog: ex,
        isCompleted: !!otherIsCompletedMap[info.courseId],
      }
    })
  }, [showMerged, otherCourses, day.date, otherExistingLogs, otherIsCompletedMap])

  // Per-courseId mutable state. Initialised from the derived list above and
  // re-initialised whenever the modal mounts for a new day.
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const d of otherDerivedList) {
      out[d.info.courseId] = d.otherDay ? String(Math.min(d.defaultEnd, d.bookTotal)) : "0"
    }
    return out
  })
  const [otherBookPages, setOtherBookPages] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const d of otherDerivedList) {
      out[d.info.courseId] = d.otherDay ? Math.min(d.defaultEnd, d.bookTotal) : 0
    }
    return out
  })
  const [otherDirtyByCourse, setOtherDirtyByCourse] = useState<Record<string, boolean>>({})

  // ── Shared state (note, complete toggle) ──────────────────────
  const [note, setNote] = useState(existingLog?.note ?? "")
  const [markComplete, setMarkComplete] = useState(isCompleted)

  const commitActivePage = (raw: string) => {
    const num = parseInt(raw, 10)
    if (!isNaN(num)) {
      const clamped = Math.min(totalBookPages, Math.max(1, num))
      setActiveBookPage(clamped)
      setActiveInputValue(String(clamped))
    } else {
      setActiveInputValue(String(activeBookPage))
    }
  }
  const setOtherInput = (courseId: string, value: string) => {
    setOtherInputs((prev) => ({ ...prev, [courseId]: value }))
  }
  const commitOtherPage = (courseId: string, bookTotal: number, raw: string) => {
    setOtherDirtyByCourse((prev) => ({ ...prev, [courseId]: true }))
    const current = otherBookPages[courseId] ?? 0
    const num = parseInt(raw, 10)
    if (!isNaN(num)) {
      const clamped = Math.min(bookTotal, Math.max(1, num))
      setOtherBookPages((prev) => ({ ...prev, [courseId]: clamped }))
      setOtherInputs((prev) => ({ ...prev, [courseId]: String(clamped) }))
    } else {
      setOtherInputs((prev) => ({ ...prev, [courseId]: String(current) }))
    }
  }

  // Active course chapter resolution
  const activeResolvedPage = resolveBookPage(activeBookPage, chapters)
  const activeResolvedChapter = activeResolvedPage
    ? chapters.find((c) => c.id === activeResolvedPage.chapterId)
    : null

  const handleSave = () => {
    const otherUpdates: Array<{ courseId: string; log: DailyLog; markComplete: boolean }> = []
    if (showMerged) {
      for (const d of otherDerivedList) {
        const dirty = !!otherDirtyByCourse[d.info.courseId]
        // Skip if there's nothing changed AND no existing data — avoids creating
        // a phantom 0-page log entry that would shift the schedule.
        if (!dirty && !d.existingLog) continue
        const bookPage = otherBookPages[d.info.courseId] ?? d.defaultEnd
        const pagesRead = d.otherDay
          ? Math.max(0, bookPage - d.dayStart + 1)
          : (d.existingLog?.pagesRead ?? 0)
        otherUpdates.push({
          courseId: d.info.courseId,
          log: {
            pagesRead,
            note: d.existingLog?.note,
          },
          markComplete: d.isCompleted,
        })
      }
    }

    onSave(
      day.date,
      {
        pagesRead: activePagesRead,
        note: note.trim() || undefined,
      },
      markComplete,
      otherUpdates.length > 0 ? otherUpdates : undefined,
    )
  }

  // ── Helper: pick "ending today, else last" chapters for activities ─────────────
  function pickActivityChapters(
    dayChs: StudyDay["chapters"],
    courseChs: Chapter[],
  ) {
    const ending = dayChs.filter((ch) => {
      const cd = courseChs.find((c) => c.id === ch.chapterId)
      return cd && ch.pagesEnd >= cd.pages
    })
    return ending.length > 0 ? ending : dayChs.slice(-1)
  }

  // ── Helper: renders one course's page-tracking section ────────────────────────
  function renderCourseBlock(p: {
    label: string
    /** courseId for non-active courses; undefined for the active course. */
    courseId?: string
    dayStartBookPage: number
    planned: number
    bookTotal: number
    inputValue: string
    setInputValue: (v: string) => void
    commitPage: (v: string) => void
    bookPage: number
    pagesRead: number
    resolvedChapter: Chapter | null | undefined
    resolvedPage: ReturnType<typeof resolveBookPage>
    unitColors: Record<number, string>
    // Chapter activities
    activityChs: StudyDay["chapters"]
    activityCourseChs: Chapter[]
    isActive: boolean
  }) {
    const DiffIcon = p.pagesRead > p.planned ? TrendingUp : p.pagesRead < p.planned ? TrendingDown : Minus
    const diffColor = p.pagesRead > p.planned ? "text-green-500" : p.pagesRead < p.planned ? "text-amber-500" : "text-muted-foreground"
    const diff = p.pagesRead - p.planned
    const actChs = pickActivityChapters(p.activityChs, p.activityCourseChs)

    return (
      <div className="space-y-3">
        <div className="px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {p.label}
          </span>
        </div>

        {/* Context */}
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 flex items-center justify-between">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Started on</p>
            <p className="text-base font-bold text-foreground">p.{p.dayStartBookPage}</p>
          </div>
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Planned end</p>
            <p className="text-base font-bold text-foreground">p.{p.dayStartBookPage + p.planned - 1}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Planned</p>
            <p className="text-base font-bold text-foreground">{p.planned}p</p>
          </div>
        </div>

        {/* Main input */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            {labels.logLabel}
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Enter how many {labels.items} you completed today.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono pointer-events-none">
                p.
              </span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={String(p.bookPage)}
                value={p.inputValue}
                onChange={(e) => p.setInputValue(e.target.value)}
                onBlur={(e) => p.commitPage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    p.commitPage(p.inputValue);
                    (e.target as HTMLInputElement).blur()
                  }
                }}
                className="w-full pl-8 pr-3 py-3 border border-primary rounded-lg bg-background text-foreground text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">of</p>
              <p className="text-sm font-semibold text-foreground">{p.bookTotal}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Type the number and press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs font-mono">Enter</kbd> or click away to confirm.
          </p>

          {p.resolvedChapter && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.unitColors[p.resolvedChapter.unitId] }}
              />
              <p className="text-xs text-foreground">
                <span className="font-semibold">Ch. {p.resolvedChapter.id}</span> — {p.resolvedChapter.title}
              </p>
              <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap font-mono">
                local p.{p.resolvedPage!.pageWithinChapter}/{p.resolvedChapter.pages}
              </span>
            </div>
          )}
        </div>

        {/* Items-read summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 border border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Planned</p>
            <p className="text-base font-bold text-foreground">{p.planned}p</p>
          </div>
          <DiffIcon className={`w-5 h-5 ${diffColor}`} />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Read</p>
            <p className={`text-base font-bold ${diffColor}`}>{p.pagesRead}p</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">vs Plan</p>
            <p className={`text-sm font-semibold ${diffColor}`}>
              {diff > 0 ? `+${diff}` : diff}p
            </p>
          </div>
        </div>

        {/* Skip button */}
        {onSkipDay && p.planned > 0 && (
          <button
            onClick={() => onSkipDay(day.date, p.courseId ?? activeCourse!.id)}
            className="w-full py-2 rounded-lg text-xs font-medium border border-dashed border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Skip {p.label} for today — push to next study day
          </button>
        )}

        {/* Chapter activities removed — tracking is now plan-level (pagesRead only) */}
      </div>
    )
  }

  // ── Sources for chapter-activity lists ─────────────────────────────────────────
  function activeActivityChs() {
    if (showMerged && mergedDay && activeCourse) {
      return mergedDay.chapters.filter((c) => c.courseId === activeCourse.id)
    }
    return day.chapters
  }
  function activityChsForCourse(courseId: string): StudyDay["chapters"] {
    if (showMerged && mergedDay) {
      return mergedDay.chapters.filter((c) => c.courseId === courseId)
    }
    return []
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-sm">Log Day {day.dayNumber}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Active course block: page tracking + chapter activities */}
          {renderCourseBlock({
            label: activeCourse?.name ?? "",
            dayStartBookPage: activeDayStart,
            planned: activePlanned,
            bookTotal: totalBookPages,
            inputValue: activeInputValue,
            setInputValue: setActiveInputValue,
            commitPage: commitActivePage,
            bookPage: activeBookPage,
            pagesRead: activePagesRead,
            resolvedChapter: activeResolvedChapter,
            resolvedPage: activeResolvedPage,
            unitColors,
            activityChs: activeActivityChs(),
            activityCourseChs: chapters,
            isActive: true,
          })}

          {/* One block per other selected course (merged view only) */}
          {showMerged && otherDerivedList.map((d) => {
            if (!d.otherDay) return null
            const bookPage = otherBookPages[d.info.courseId] ?? d.defaultEnd
            const inputValue = otherInputs[d.info.courseId] ?? String(bookPage)
            const pagesRead = Math.max(0, bookPage - d.dayStart + 1)
            const resolvedPage = resolveBookPage(bookPage, d.info.chapters)
            const resolvedChapter = resolvedPage
              ? d.info.chapters.find((c) => c.id === resolvedPage.chapterId)
              : null
            return (
              <div key={d.info.courseId}>
                {renderCourseBlock({
                  label: d.info.courseName,
                  courseId: d.info.courseId,
                  dayStartBookPage: d.dayStart,
                  planned: d.planned,
                  bookTotal: d.bookTotal,
                  inputValue,
                  setInputValue: (v) => setOtherInput(d.info.courseId, v),
                  commitPage: (v) => commitOtherPage(d.info.courseId, d.bookTotal, v),
                  bookPage,
                  pagesRead,
                  resolvedChapter,
                  resolvedPage,
                  unitColors: d.info.unitColors,
                  activityChs: activityChsForCourse(d.info.courseId),
                  activityCourseChs: d.info.chapters,
                  isActive: false,
                })}
              </div>
            )
          })}

          {/* Shared note */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Took longer on cryptography section..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Mark complete toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setMarkComplete((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                markComplete ? "bg-green-500" : "bg-border"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  markComplete ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm text-foreground">Mark day as complete</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
