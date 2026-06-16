"use client"

import { useMemo } from "react"
import { Zap, X } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"
import { usePlanStore } from "@/lib/plan-store"
import { isSprintActive, sprintDaysRemaining, type SprintOverlay } from "@/lib/sprint"
import { localToday } from "@/lib/date-utils"
import { showToast } from "./NotificationToast"

/**
 * Phase 0.5.4: Sprint mode banner.
 *
 * Surfaces a small banner above the main content when ANY active plan
 * has an active sprint. Shows the remaining days and the pace boost.
 * The user can dismiss (cancel) the sprint from this banner.
 */
export function SprintBanner() {
  const { label, toast: tToast } = usePersonality()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)
  const updatePlan = usePlanStore((s) => s.updatePlan)

  const activeSprints = useMemo(() => {
    const today = localToday()
    const out: Array<{ plan: typeof allPlans[0]; sprint: SprintOverlay; daysLeft: number }> = []
    for (const plan of allPlans) {
      if (!activePlanIds.includes(plan.id)) continue
      if (!plan.sprint) continue
      if (isSprintActive(plan.sprint, today)) {
        out.push({ plan, sprint: plan.sprint, daysLeft: sprintDaysRemaining(plan.sprint, today) })
      }
    }
    return out
  }, [allPlans, activePlanIds])

  if (activeSprints.length === 0) return null

  const cancelSprint = (planId: string) => {
    const plan = allPlans.find((p) => p.id === planId)
    if (!plan) return
    const { sprint, ...rest } = plan
    void sprint // discarded
    updatePlan({ ...rest, updatedAt: new Date().toISOString() }).then(() => {
      showToast(tToast("sprintCancelled"), "info")
    }).catch((e) => {
      console.error("[SprintBanner] failed to cancel sprint:", e)
    })
  }

  return (
    <div
      data-testid="sprint-banner"
      className="rounded-xl mb-4 border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-center gap-3 flex-wrap"
    >
      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {activeSprints.length === 1 ? (
          <div className="text-sm text-foreground">
            {formatStr(label("sprintActivePlan"), {
              planName: activeSprints[0].plan.name,
              days: String(activeSprints[0].daysLeft),
              pct: String(activeSprints[0].sprint.paceBoost),
            })}
          </div>
        ) : (
          <div className="text-sm text-foreground">
            {formatStr(label("sprintActiveMultiple"), {
              count: String(activeSprints.length),
            })}
          </div>
        )}
      </div>
      {activeSprints.length === 1 && (
        <button
          onClick={() => cancelSprint(activeSprints[0].plan.id)}
          className="text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 rounded p-1"
          title={label("sprintCancel")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
