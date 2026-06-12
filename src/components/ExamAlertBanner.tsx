import { useMemo } from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { useCourse } from "./CourseProvider"
import { localToday } from "@/lib/date-utils"

/**
 * Phase 0.5.1: Top-of-app exam-day alert banner.
 *
 * Surfaces urgent exam deadlines (T-3 or fewer days) above the tab
 * strip. Persistent across all tabs so the user can't miss it.
 *
 * Distinct from the existing ExamCountdownBand (Phase 1.3) which is
 * a full plan summary in the Calendar tab. This is a compact,
 * always-visible alert for imminent deadlines.
 */
export default function ExamAlertBanner() {
  const { label } = usePersonality()
  const { courses } = useCourse()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)

  const imminent = useMemo(() => {
    const today = localToday()
    const result: Array<{ planId: string; courseName: string; daysLeft: number }> = []
    for (const plan of allPlans) {
      if (!activePlanIds.includes(plan.id)) continue
      if (!plan.targetEndDate) continue
      const d = new Date(plan.targetEndDate + "T00:00:00").getTime()
      const t = new Date(today + "T00:00:00").getTime()
      if (isNaN(d) || isNaN(t)) continue
      const days = Math.round((d - t) / 86400000)
      if (days <= 3) {
        const course = courses.find((c) => c.id === plan.courseId)
        result.push({
          planId: plan.id,
          courseName: course?.name ?? plan.courseId,
          daysLeft: days,
        })
      }
    }
    return result.sort((a, b) => a.daysLeft - b.daysLeft)
  }, [allPlans, activePlanIds, courses])

  if (imminent.length === 0) return null

  // Color by urgency
  const mostUrgent = Math.min(...imminent.map((i) => i.daysLeft))
  const bgClass =
    mostUrgent <= 0
      ? "bg-red-500/15 border-red-500/40"
      : mostUrgent <= 1
      ? "bg-red-500/10 border-red-500/30"
      : "bg-amber-500/10 border-amber-500/30"
  const textClass =
    mostUrgent <= 1 ? "text-red-600 dark:text-red-300" : "text-amber-700 dark:text-amber-300"

  return (
    <div
      data-testid="exam-alert-banner"
      className={`w-full px-4 pt-3 pb-0`}
      role="alert"
      aria-live="polite"
    >
      <div className={`rounded-lg border ${bgClass} px-3 py-2 flex items-center gap-2 flex-wrap`}>
        {mostUrgent <= 0 ? (
          <AlertTriangle className={`w-4 h-4 ${textClass} flex-shrink-0`} />
        ) : (
          <Clock className={`w-4 h-4 ${textClass} flex-shrink-0`} />
        )}
        <span className={`text-xs font-medium ${textClass}`}>
          {mostUrgent <= 0
            ? label("examToday")
            : mostUrgent === 1
            ? label("examTomorrow")
            : label("examThisWeek")}
          {": "}
        </span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {imminent.map((i) => (
            <li key={i.planId} className={`text-xs ${textClass}`}>
              <span className="font-semibold">{i.courseName}</span>{" "}
              <span className="opacity-80">
                T-{i.daysLeft < 0 ? Math.abs(i.daysLeft) : i.daysLeft}
                {i.daysLeft < 0 ? " (past)" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
