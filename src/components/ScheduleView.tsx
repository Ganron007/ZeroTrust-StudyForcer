"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { type StudyDay } from "@/lib/cissp-data"
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle2, Circle, Settings2 } from "lucide-react"
import type { LogGroup } from "./LogDialog"
import { usePersonality } from "./PersonalityProvider"

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

interface ScheduleViewProps {
  schedule: StudyDay[]
  dailyLog: Record<string, Record<string, { pagesRead: number }>>
  onMarkDone: (date: string) => void
  onLogDay: (day: StudyDay, groups: LogGroup[]) => void
  plansLoggedForDate: (date: string) => boolean
  selectedDate: string | null
  onSelectedDateChange: (date: string | null) => void
}

export default function ScheduleView({
  schedule, dailyLog, onMarkDone, onLogDay,
  plansLoggedForDate, selectedDate, onSelectedDateChange,
}: ScheduleViewProps) {
  const { label } = usePersonality()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const [showLegend, setShowLegend] = useState(() => {
    try { return localStorage.getItem("showCalendarLegend") === "true" }
    catch { return false }
  })

  const isFirstMount = useRef(true)

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    try { localStorage.setItem("showCalendarLegend", showLegend ? "true" : "false") }
    catch { /* ignore */ }
  }, [showLegend])

  const scheduleMap = useMemo(() => {
    const map: Record<string, StudyDay> = {}
    for (const day of schedule) {
      map[day.date] = day
    }
    return map
  }, [schedule])

  const firstDay = new Date(currentMonth.year, currentMonth.month, 1)
  const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7

  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(currentMonth.year, currentMonth.month, d))
  }
  while (cells.length < totalCells) cells.push(null)

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { year: prev.year, month: prev.month - 1 }
    })
  }
  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year, month: 0 }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const selectedDay = selectedDate ? scheduleMap[selectedDate] : null

  // Group chapters by course/plan for the selected day
  const selectedDayGroups = useMemo(() => {
    if (!selectedDay) return []
    const groups = selectedDay.groups ?? [
      { label: "Plan", dayNumber: selectedDay.dayNumber, totalPages: selectedDay.totalPages, chapters: selectedDay.chapters },
    ]
    return groups
  }, [selectedDay])

  const dayLogs = (date: string) => dailyLog[date] ?? {}
  const totalPagesRead = (date: string) => Object.values(dayLogs(date)).reduce((s, l) => s + l.pagesRead, 0)
  const isLogged = (date: string) => {
    const logs = dayLogs(date)
    return Object.keys(logs).length > 0 && Object.values(logs).some(l => l.pagesRead > 0)
  }
  // A74: Centralized isPending — log exists AND all entries have 0 pages
  const isPending = (date: string) => {
    const logs = dayLogs(date)
    return Object.keys(logs).length > 0 && Object.values(logs).every(l => l.pagesRead === 0)
  }

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border rounded-t-xl">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground">
            {MONTHS[currentMonth.month]} {currentMonth.year}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLegend((v) => !v)}
             aria-label={label("howToRead")}
            className={`p-1.5 rounded-lg transition-colors ${
              showLegend
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Day Labels */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const totalCellCount = cells.length
            const totalRows = totalCellCount / 7
            const rowIndex = Math.floor(i / 7)
            const colIndex = i % 7
            const isLastRow = rowIndex === totalRows - 1
            const isLastCol = colIndex === 6

            if (!date) {
              return (
                <div
                  key={`empty-${i}`}
                  className={`min-h-14 border-border/70 bg-muted/20
                    ${!isLastRow ? "border-b" : ""}
                    ${!isLastCol ? "border-r" : ""}
                    ${isLastRow && colIndex === 0 ? "rounded-bl-xl" : ""}
                    ${isLastRow && isLastCol ? "rounded-br-xl" : ""}
                  `}
                />
              )
            }

            const dateStr = formatDate(date)
            const studyDay = scheduleMap[dateStr]
            const isToday = date.toDateString() === today.toDateString()
            const isSelected = dateStr === selectedDate
            const dayIsLogged = isLogged(dateStr)
            const dayIsPending = isPending(dateStr)
            const isPast = date < today && !isToday

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (studyDay) {
                    onSelectedDateChange(isSelected ? null : dateStr)
                  }
                }}
                className={`calendar-cell min-h-14 p-1.5 text-left transition-all relative
                  ${!isLastRow ? "border-b border-border/70" : ""}
                  ${!isLastCol ? "border-r border-border/70" : ""}
                  ${isLastRow && colIndex === 0 ? "rounded-bl-xl" : ""}
                  ${isLastRow && isLastCol ? "rounded-br-xl" : ""}
                  ${studyDay ? "cursor-pointer hover:bg-muted/50" : "cursor-default"}
                  ${isSelected ? "bg-primary/10" : ""}
                  ${isToday && !isSelected ? "bg-primary/5" : ""}
                `}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                    ${isToday ? "bg-primary text-primary-foreground" : ""}
                    ${isPast && !studyDay ? "text-muted-foreground/40" : "text-foreground"}
                    ${isSelected && !isToday ? "text-primary font-bold" : ""}
                  `}
                >
                  {date.getDate()}
                </span>

                {studyDay && (
                  <div className="mt-0.5 space-y-0.5">
                    {dayIsLogged ? (
                      <div className="flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium truncate">{label("done")}</span>
                      </div>
                    ) : dayIsPending ? (
                      <div className="flex items-center gap-0.5">
                        <Circle className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium truncate">{label("pending")}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-0.5">
                        {studyDay.chapters.slice(0, 2).map((ch, i) => (
                          <span
                            key={`${ch.courseLabel ?? ''}-${ch.chapterId}-${i}`}
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: ch.color }}
                            title={ch.chapterTitle}
                          />
                        ))}
                        {studyDay.chapters.length > 2 && (
                          <span className="text-xs text-muted-foreground">+{studyDay.chapters.length - 2}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      {dayIsLogged || dayIsPending ? (
                        <span className="text-xs text-amber-500 font-medium truncate">
                          {totalPagesRead(studyDay.date)}p logged
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{studyDay.totalPages}p</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedDay && (
        <div className="day-detail-inline bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-foreground">
                {label("day")} {selectedDay.dayNumber} —{" "}
                {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {dailyLog[selectedDay.date]
                  ? `${totalPagesRead(selectedDay.date)} ${label("pagesPending")}`
                  : `${selectedDay.totalPages} ${label("pagesPlanned")}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  const groups = selectedDayGroups.map(g => ({
                    label: g.label,
                    courseId: g.chapters[0]?.courseId ?? "",
                    totalPages: g.totalPages,
                  }))
                  onLogDay(selectedDay, groups)
                }}
                disabled={isLogged(selectedDay.date)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                  ${isLogged(selectedDay.date)
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                {label("log")}
              </button>
              <button
                onClick={() => onMarkDone(selectedDay.date)}
                disabled={!plansLoggedForDate(selectedDay.date) || isLogged(selectedDay.date)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                  ${!plansLoggedForDate(selectedDay.date) || isLogged(selectedDay.date)
                    ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {label("markDone")}
              </button>
            </div>
          </div>

          {/* Chapter listing with per-group logging */}
          {selectedDayGroups.map((g, gi) => {
            const dayIsLogged = isLogged(selectedDay.date)
            const dayIsPending = isPending(selectedDay.date)

            return (
              <div key={gi} className="mb-4">
                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/50">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded">
                    {g.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Day {g.dayNumber} · {g.totalPages}p
                  </span>
                </div>

                {/* Chapter list */}
                <div className="space-y-2 mb-3">
                  {g.chapters.map((ch, ci) => (
                    <div
                      key={`${ch.courseLabel ?? ''}-${ch.chapterId}-${ci}`}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 border-border/50"
                    >
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: ch.color, minHeight: "2.5rem" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">
                              Unit {ch.unit} · {ch.unitName}
                            </p>
                            <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
                              Ch. {ch.chapterId}: {ch.chapterTitle}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ch.bookPageStart !== undefined
                                ? `pp. ${ch.bookPageStart}–${ch.bookPageEnd}`
                                : `pp. ${ch.pagesStart}–${ch.pagesEnd}`}
                              {ch.chapterTotalPages !== undefined && (
                                <span className="ml-1.5 text-[10px] opacity-70">({ch.chapterTotalPages} pages total)</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-foreground">
                              {ch.pagesCount}p
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-plan status */}
                {dayIsLogged && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Completed: {totalPagesRead(selectedDay.date)} pages
                    </span>
                  </div>
                )}
                {dayIsPending && !dayIsLogged && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <span className="text-xs text-amber-500 font-medium">
                      {totalPagesRead(selectedDay.date)}p saved
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend — hidden by default, toggled via ⚙ button */}
      {showLegend && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">{label("howToRead")}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>{label("completed")} ({label("markDone")})</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-3.5 h-3.5 text-amber-500" />
              <span>{label("pending")} ({label("log")}ged, not yet committed)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <span className="w-3 h-3 rounded-sm bg-blue-500" />
                <span className="w-3 h-3 rounded-sm bg-purple-600" />
              </div>
              <span>{label("studyOrder")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold" style={{ fontSize: "10px" }}>D</span>
              </div>
              <span>{label("today")}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{label("log")} a day to log progress</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
