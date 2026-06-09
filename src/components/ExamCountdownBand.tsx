import { useMemo } from "react"
import { Calendar, Target, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { syncStudyPlan } from "@/lib/plan-engine"
import { getOrderedChapters } from "@/lib/cissp-data"
import type { StudyPlan } from "@/lib/plan-storage"
import type { CourseConfig } from "@/types/course"
import { localToday } from "@/lib/date-utils"

interface PlanSummary {
  planId: string
  planName: string
  courseName: string
  courseColor: string
  daysRemaining: number | null
  pctDone: number
  paceRatio: number
  /** D4 fix: number of days with pagesRead > 0. Used to distinguish
   *  "no logs yet" (don't show misleading 0% pace) from "logging at <100% pace". */
  loggedDays: number
  status: "on-track" | "behind" | "critical" | "no-deadline"
}

function summarizePlan(
  plan: StudyPlan,
  course: CourseConfig,
  today: string,
): PlanSummary {
  const daysRemaining = plan.targetEndDate
    ? Math.round(
        (new Date(plan.targetEndDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null

  const chapters = getOrderedChapters(course, plan.unitOrder)
  const params = syncStudyPlan(plan, chapters, today)

  const totalPages = chapters.reduce((s, c) => s + c.pages, 0)
  const pagesRead = params.consumed
  const pctDone = totalPages > 0 ? Math.min(1, pagesRead / totalPages) : 0

  const loggedDays = Object.values(plan.dailyLog).filter((l) => l.pagesRead > 0)
  const actualPace =
    loggedDays.length > 0
      ? loggedDays.reduce((s, l) => s + l.pagesRead, 0) / loggedDays.length
      : 0
  const paceRatio = plan.pagesPerDay > 0 ? actualPace / plan.pagesPerDay : 1

  let status: PlanSummary["status"] = "no-deadline"
  if (daysRemaining !== null) {
    const pagesRemaining = totalPages - pagesRead
    // C2 fix: when daysRemaining === 0 (today IS the deadline) and there
    // are still pages left, there's no time to "catch up" — this is critical,
    // not behind. The pace threshold only makes sense when days > 0.
    if (daysRemaining <= 0) {
      status = pagesRemaining > 0 ? "critical" : "on-track"
    } else {
      const requiredPace = pagesRemaining / daysRemaining
      status = requiredPace > plan.pagesPerDay * 1.2 ? "behind" : "on-track"
    }
  }

  return {
    planId: plan.id,
    planName: plan.name,
    courseName: course.name,
    courseColor: course.units[0]?.color ?? "#2563EB",
    daysRemaining,
    pctDone,
    loggedDays: loggedDays.length,
    paceRatio,
    status,
  }
}

interface ExamCountdownBandProps {
  className?: string
}

export default function ExamCountdownBand({ className = "" }: ExamCountdownBandProps) {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)

  const summaries = useMemo<PlanSummary[]>(() => {
    const today = localToday()
    const result: PlanSummary[] = []
    for (const plan of allPlans) {
      if (!activePlanIds.includes(plan.id)) continue
      const course = courses.find((c) => c.id === plan.courseId)
      if (!course) continue
      result.push(summarizePlan(plan, course, today))
    }
    return result.sort((a, b) => {
      const aDays = a.daysRemaining ?? Number.MAX_SAFE_INTEGER
      const bDays = b.daysRemaining ?? Number.MAX_SAFE_INTEGER
      return aDays - bDays
    })
  }, [allPlans, activePlanIds, courses])

  if (summaries.length === 0) return null

  return (
    <div
      data-testid="exam-countdown-band"
      className={`bg-card border border-border rounded-xl p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{label("countdownTitle")}</h3>
      </div>

      <div className="space-y-2">
        {summaries.map((s) => {
          const StatusIcon =
            s.status === "on-track"
              ? CheckCircle
              : s.status === "behind"
              ? TrendingDown
              : s.status === "critical"
              ? AlertCircle
              : Calendar

          const statusClass =
            s.status === "on-track"
              ? "text-green-500"
              : s.status === "behind"
              ? "text-amber-500"
              : s.status === "critical"
              ? "text-red-500"
              : "text-muted-foreground"

          const statusLabelKey =
            s.status === "on-track"
              ? "countdownOnTrack"
              : s.status === "behind"
              ? "countdownBehind"
              : s.status === "critical"
              ? "countdownCritical"
              : "countdownNoDeadline"

          return (
            <div
              key={s.planId}
              className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-background/30"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.courseColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{s.courseName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{s.planName}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {s.daysRemaining !== null ? (
                  <div className="text-right">
                    <p className="text-base font-bold text-foreground leading-none">
                      T-{s.daysRemaining}
                    </p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
                      {label("countdownDays")}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">
                    {label("countdownOpenEnded")}
                  </p>
                )}

                <div className="w-20 hidden sm:block">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>{Math.round(s.pctDone * 100)}%</span>
                    <span className="inline-flex items-center gap-0.5">
                      {/* D4 fix: show "—" instead of misleading "0%" when no
                          logs exist yet. Pace is unknown, not failing. */}
                      {s.loggedDays === 0 ? (
                        <span>—</span>
                      ) : s.paceRatio >= 1 ? (
                        <>
                          <TrendingUp className="w-2.5 h-2.5" />
                          {Math.round(s.paceRatio * 100)}%
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-2.5 h-2.5" />
                          {Math.round(s.paceRatio * 100)}%
                        </>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(s.pctDone * 100)}%`,
                        backgroundColor: s.courseColor,
                      }}
                    />
                  </div>
                </div>

                <div className={`flex items-center gap-1 ${statusClass}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {label(statusLabelKey)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
