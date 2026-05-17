"use client"

import { useState, useMemo, useCallback } from "react"
import { type StudyDay } from "@/lib/cissp-data"
import { CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-react"

interface ScheduleListProps {
  schedule: StudyDay[]
  dailyLog: Record<string, Record<string, { pagesRead: number }>>
}

export default function ScheduleList({
  schedule,
  dailyLog,
}: ScheduleListProps) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all")
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const toggleExpand = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const dayLogs = useCallback((date: string) => dailyLog[date] ?? {}, [dailyLog])
  const totalPagesRead = useCallback((date: string) => Object.values(dayLogs(date)).reduce((s, l) => s + l.pagesRead, 0), [dayLogs])

  const filtered = useMemo(() => {
    return schedule.filter((day) => {
      const logs = dayLogs(day.date)
      const isDone = Object.keys(logs).length > 0 && Object.values(logs).some(l => l.pagesRead > 0)
      if (filter === "done" && !isDone) return false
      if (filter === "pending" && isDone) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          day.chapters.some(
            (c) =>
              c.chapterTitle.toLowerCase().includes(q) ||
              c.unitName.toLowerCase().includes(q)
          ) ||
          day.date.includes(q) ||
          `day ${day.dayNumber}`.includes(q)
        )
      }
      return true
    })
  }, [schedule, dayLogs, filter, search])

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chapters, domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden bg-card">
          {(["all", "pending", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {schedule.length} days
        {search && ` matching "${search}"`}
      </p>

      {/* Day List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No days found</p>
          </div>
        )}
        {filtered.map((day) => {
          const dateLogs = dayLogs(day.date)
          const isDone = Object.keys(dateLogs).length > 0 && Object.values(dateLogs).some(l => l.pagesRead > 0)
          const isPending = Object.keys(dateLogs).length > 0 && Object.values(dateLogs).every(l => l.pagesRead === 0)
          const isExpanded = expandedDays.has(day.date)
          const dayLog = dailyLog[day.date]

          return (
            <div
              key={day.date}
              className={`border rounded-xl overflow-hidden transition-all ${
                isDone ? "border-green-500/25 bg-green-500/5 dark:bg-green-500/10" : "border-border bg-card"
              }`}
            >
              {/* Day Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${isDone ? "text-green-600 dark:text-green-400" : "text-foreground"}`}
                    >
                      Day {day.dayNumber}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(day.date)}</span>
                    {isPending && (
                      <span className="text-xs text-amber-500 font-medium ml-auto">Pending</span>
                    )}
                    {isDone && (
                      <span className="text-xs text-green-500 font-medium ml-auto">Done</span>
                    )}
                  </div>
                  {day.groups ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      {day.groups.map((g, gi) => (
                        <div key={gi} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                            {g.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {g.totalPages}p · Day {g.dayNumber}
                          </span>
                        </div>
                      ))}
                      {dayLog && (
                        <span className="text-xs text-amber-500 font-medium ml-auto">
                          {totalPagesRead(day.date)}p logged
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {day.chapters.map((ch, ci) => (
                        <div key={`${ch.courseLabel ?? ""}-${ch.chapterId}-${ci}`} className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: ch.color }}
                          />
                          <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                            Ch.{ch.chapterId}
                          </span>
                        </div>
                      ))}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {dayLog
                          ? <span className="text-amber-500 font-medium">{totalPagesRead(day.date)}p logged</span>
                          : `${day.totalPages}p planned`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Log button: Log progress for this day on the list */}
                  {!isDone && (
                    <span className="text-xs text-muted-foreground mr-1">
                      Use calendar to log
                    </span>
                  )}
                  <button
                    onClick={() => toggleExpand(day.date)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Detail — Per-Chapter View */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50 bg-muted/20">
                  <div className="space-y-2 mt-3">
                    {(day.groups ? day.groups.flatMap((g) => g.chapters) : day.chapters).map((ch, ci) => (
                      <div
                        key={`${ch.courseLabel ?? ""}-${ch.chapterId}-${ci}`}
                        className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border/50"
                      >
                        <div
                          className="w-1 self-stretch rounded-full flex-shrink-0"
                          style={{ backgroundColor: ch.color, minHeight: "2rem" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">
                            Unit {ch.unit} · {ch.unitName}
                          </p>
                          <p className="text-sm font-medium text-foreground truncate">
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
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <p className="text-sm font-bold text-foreground">
                            {ch.pagesCount}p
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
