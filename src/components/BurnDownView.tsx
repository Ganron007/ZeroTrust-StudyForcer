import { useMemo } from "react"
import { TrendingDown } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { syncStudyPlan } from "@/lib/plan-engine"
import { getOrderedChapters } from "@/lib/cissp-data"
import { applySprintPace } from "@/lib/sprint"
import type { StudyPlan } from "@/lib/plan-storage"
import { localToday } from "@/lib/date-utils"

/**
 * Phase 0.5.7: Reverse burn-down view.
 *
 * Horizontal Gantt-style "pages remaining vs days remaining" bar.
 * Distinct from the existing ScheduleList (Phase 0) which is a
 * vertical list of past/today/future days.
 */
interface BurnDownViewProps {
  className?: string
}

interface PlanBurnDown {
  planId: string
  planName: string
  courseName: string
  courseColor: string
  pagesRemaining: number
  daysRemaining: number | null
  paceRatio: number
  status: "on-pace" | "behind" | "no-deadline"
}

function summarizePlan(plan: StudyPlan, today: string) {
  return null as never
}

function deriveBurnDown(
  plan: StudyPlan,
  chapters: ReturnType<typeof getOrderedChapters>,
  today: string,
): PlanBurnDown {
  const daysRemaining = plan.targetEndDate
    ? Math.round(
        (new Date(plan.targetEndDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) /
          86400000,
      )
    : null

  const params = syncStudyPlan(plan, chapters, today)
  const totalPages = chapters.reduce((s, c) => s + c.pages, 0)
  const pagesRemaining = Math.max(0, totalPages - params.consumed)
  const effectivePPD = applySprintPace(plan.pagesPerDay, plan.sprint, today)
  const loggedDays = Object.values(plan.dailyLog).filter((l) => l.pagesRead > 0)
  const actualPace = loggedDays.length > 0
    ? loggedDays.reduce((s, l) => s + l.pagesRead, 0) / loggedDays.length
    : 0
  const paceRatio = effectivePPD > 0 ? actualPace / effectivePPD : 1

  let status: PlanBurnDown["status"] = "no-deadline"
  if (daysRemaining !== null) {
    const requiredPace = pagesRemaining / Math.max(1, daysRemaining)
    status = requiredPace > effectivePPD * 1.2 ? "behind" : "on-pace"
  }

  return {
    planId: plan.id,
    planName: plan.name,
    courseName: "course", // overridden by caller
    courseColor: "#2563EB",
    pagesRemaining,
    daysRemaining,
    paceRatio,
    status,
  }
}

export default function BurnDownView({ className = "" }: BurnDownViewProps) {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)

  const summaries = useMemo<PlanBurnDown[]>(() => {
    const today = localToday()
    const result: PlanBurnDown[] = []
    for (const plan of allPlans) {
      if (!activePlanIds.includes(plan.id)) continue
      const course = courses.find((c) => c.id === plan.courseId)
      if (!course) continue
      const chapters = getOrderedChapters(course, plan.unitOrder)
      const bd = deriveBurnDown(plan, chapters, today)
      bd.courseName = course.name
      bd.courseColor = course.units[0]?.color ?? "#2563EB"
      result.push(bd)
    }
    return result.sort((a, b) => {
      const aDays = a.daysRemaining ?? Number.MAX_SAFE_INTEGER
      const bDays = b.daysRemaining ?? Number.MAX_SAFE_INTEGER
      return aDays - bDays
    })
  }, [allPlans, activePlanIds, courses])

  if (summaries.length === 0) return null

  // Find max for normalization
  const maxPages = Math.max(...summaries.map((s) => s.pagesRemaining), 1)
  const maxDays = Math.max(
    ...summaries.map((s) => s.daysRemaining ?? 0),
    1,
  )

  return (
    <div
      data-testid="burndown-view"
      className={`bg-card border border-border rounded-xl p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{label("burndownTitle")}</h3>
      </div>

      <div className="space-y-3">
        {summaries.map((s) => {
          // Bar widths as % of max
          const pagesBarWidth = (s.pagesRemaining / maxPages) * 100
          const daysBarWidth = s.daysRemaining !== null
            ? (s.daysRemaining / maxDays) * 100
            : 100
          const statusClass =
            s.status === "on-pace"
              ? "bg-green-500"
              : s.status === "behind"
              ? "bg-amber-500"
              : "bg-muted-foreground"

          return (
            <div
              key={s.planId}
              className="space-y-1.5 p-2 rounded-lg border border-border/50 bg-background/30"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.courseColor }}
                />
                <span className="text-xs font-semibold text-foreground flex-1 truncate">
                  {s.courseName}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {s.daysRemaining !== null
                    ? `T-${s.daysRemaining}`
                    : label("countdownOpenEnded")}
                </span>
              </div>

              {/* Pages remaining bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{label("burndownPagesRemaining").replace("{n}", String(s.pagesRemaining))}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statusClass} rounded-full transition-all`}
                    style={{ width: `${pagesBarWidth}%` }}
                  />
                </div>
              </div>

              {/* Days remaining bar */}
              {s.daysRemaining !== null && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      {label("burndownDaysRemaining").replace("{n}", String(s.daysRemaining))}
                    </span>
                    <span>
                      {s.status === "on-pace"
                        ? label("burndownOnPace")
                        : s.status === "behind"
                        ? label("burndownBehind")
                        : ""}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{ width: `${daysBarWidth}%` }}
                    />
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
