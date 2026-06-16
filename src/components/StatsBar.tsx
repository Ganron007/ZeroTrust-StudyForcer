"use client"

import { CalendarCheck } from "lucide-react"
import type { CourseStat } from "@/hooks/useSchedule"

export type StatsBarProps = {
  /** Stats for the currently viewed course. */
  viewedStats: CourseStat | undefined
  /** True when multiple courses are selected and pill row should show. */
  showMerged: boolean
  /** All selected courses' stats (for the pill row in merged mode). */
  selectedCoursesStats: Record<string, CourseStat>
  /** Currently-pinned course id in the pill row, if any. */
  statsViewCourseId: string | null
  /** Setter for statsViewCourseId. */
  setStatsViewCourseId: (id: string | null) => void
  /** Active course id — used to highlight the default pill. */
  activeCourseId: string | null
  /** Label keys, derived from the viewed course's tracking mode. */
  labels: { totalItems: string; perDay: string }
  /** Localized labels from the personality layer. */
  pLabel: (key: string) => string
  /** Em dash for missing values. */
  dash?: string
}

/**
 * Top-of-app stats bar — finish date + 6-cell grid (study days, total,
 * read/total, pages-per-day, frequency, % done).
 *
 * Renders a pill row in merged mode to let the user pin which course's
 * stats are displayed. Extracted from App.tsx in v2.7.0 to reduce the
 * view component's surface area.
 */
export function StatsBar({
  viewedStats,
  showMerged,
  selectedCoursesStats,
  statsViewCourseId,
  setStatsViewCourseId,
  activeCourseId,
  labels,
  pLabel,
  dash = "\u2014",
}: StatsBarProps) {
  return (
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
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="whitespace-nowrap">{s.courseName}</span>
                <span
                  className={`text-[10px] px-1 rounded-full ${statsViewCourseId === s.courseId || (!statsViewCourseId && s.courseId === activeCourseId)
                      ? "bg-primary-foreground/20"
                      : "bg-muted"
                    }`}
                >
                  {s.pctDone}%
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <span className="text-sm font-medium text-foreground">{pLabel("finishes")}</span>
          <span className="text-sm font-bold text-primary">{viewedStats?.endDateLabel ?? dash}</span>
          <span className="hidden sm:inline-block text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5 bg-background">
            {viewedStats?.weeksAway ?? dash}
          </span>
        </div>
      </div>
      {/* Stats grid */}
      <div className="stats-bar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-primary/10">
        <div className="px-3 py-3 text-center">
          <p className="text-base font-bold text-foreground leading-tight">{viewedStats?.scheduleLength ?? dash}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{pLabel("studyDays")}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-base font-bold text-foreground leading-tight">
            {viewedStats ? viewedStats.totalBookPages.toLocaleString() : dash}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{labels.totalItems}</p>
        </div>
        <div
          className="px-3 py-3 text-center"
          title={
            viewedStats
              ? `Consumed: ${viewedStats.totalPagesRead.toLocaleString()} / Total: ${viewedStats.totalPages.toLocaleString()}`
              : ""
          }
        >
          <p className="text-base font-bold text-foreground leading-tight">
            {viewedStats
              ? `${viewedStats.totalPagesRead.toLocaleString()}/${viewedStats.totalPages.toLocaleString()}`
              : dash}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{labels.totalItems}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-base font-bold text-foreground leading-tight">{viewedStats ? viewedStats.pagesPerDay : dash}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{labels.perDay}</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-base font-bold text-foreground leading-tight">
            {viewedStats ? `${viewedStats.studyDaysCount}d/wk` : dash}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{pLabel("frequency")}</p>
        </div>
        <div
          className="col-span-2 sm:col-span-1 px-3 py-3 text-center"
          title={viewedStats ? `${viewedStats.totalPagesRead} of ${viewedStats.totalPages} pages` : ""}
        >
          <p className="text-base font-bold text-primary leading-tight">
            {viewedStats ? `${viewedStats.pctDone}%` : dash}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{pLabel("finishLabel")}</p>
        </div>
      </div>
    </div>
  )
}
