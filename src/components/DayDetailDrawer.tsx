"use client"

import { type StudyDay } from "@/lib/cissp-data"
import { CheckCircle2, X } from "lucide-react"

interface DayDetailDrawerProps {
  day: StudyDay | null
  dailyLog: Record<string, Record<string, { pagesRead: number }>>
  onClose: () => void
  onMarkDone: (date: string) => void
}

export default function DayDetailDrawer({
  day,
  dailyLog,
  onClose,
  onMarkDone,
}: DayDetailDrawerProps) {
  if (!day) return null

  const dateLogs = dailyLog[day.date] ?? {}
  const totalRead = Object.values(dateLogs).reduce((s, l) => s + l.pagesRead, 0)
  const isDone = Object.keys(dateLogs).length > 0 && Object.values(dateLogs).some(l => l.pagesRead > 0)
  const hasAnyLog = Object.keys(dateLogs).length > 0

  return (
    <>
      {/* Overlay */}
      <div
        className="day-detail-drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="day-detail-drawer bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground text-sm">
              Day {day.dayNumber} —{" "}
              {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            {hasAnyLog
              ? `${totalRead} pages logged (${day.totalPages} planned)`
              : `${day.totalPages} pages planned`}
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onMarkDone(day.date)}
              disabled={!hasAnyLog}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isDone
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
                  : hasAnyLog
                    ? "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    : "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
              }`}
            >
              {isDone ? (
                <><CheckCircle2 className="w-3.5 h-3.5" />Completed</>
              ) : (
                <>Mark Done</>
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
          {day.groups ? (
            <div className="space-y-4">
              {day.groups.map((g, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/50">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider bg-muted px-2 py-0.5 rounded">
                      {g.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Day {g.dayNumber} · {g.totalPages}p
                    </span>
                  </div>
                  <div className="space-y-2">
                    {g.chapters.map((ch, ci) => (
                      <div
                        key={`${ch.courseLabel ?? ''}-${ch.chapterId}-${ci}`}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div
                          className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: ch.color, minHeight: "2rem" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground font-medium">
                                Unit {ch.unit} · {ch.unitName}
                              </p>
                              <p className="text-xs font-medium text-foreground leading-snug mt-0.5">
                                Ch. {ch.chapterId}: {ch.chapterTitle}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-xs font-bold text-foreground">
                                {ch.pagesCount}p
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {ch.bookPageStart !== undefined
                                  ? `pp. ${ch.bookPageStart}–${ch.bookPageEnd}`
                                  : `pp. ${ch.pagesStart}–${ch.pagesEnd}`}
                              </p>
                              {ch.chapterTotalPages !== undefined && (
                                <p className="text-[10px] text-muted-foreground opacity-70">
                                  {ch.chapterTotalPages} pages total
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {day.chapters.map((ch, ci) => (
                <div
                  key={`${ch.courseLabel ?? ''}-${ch.chapterId}-${ci}`}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: ch.color, minHeight: "2rem" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">
                          Unit {ch.unit} · {ch.unitName}
                        </p>
                        <p className="text-xs font-medium text-foreground leading-snug mt-0.5">
                          Ch. {ch.chapterId}: {ch.chapterTitle}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-foreground">
                          {ch.pagesCount}p
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {ch.bookPageStart !== undefined
                            ? `pp. ${ch.bookPageStart}–${ch.bookPageEnd}`
                            : `pp. ${ch.pagesStart}–${ch.pagesEnd}`}
                        </p>
                        {ch.chapterTotalPages !== undefined && (
                          <p className="text-[10px] text-muted-foreground opacity-70">
                            {ch.chapterTotalPages} pages total
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
