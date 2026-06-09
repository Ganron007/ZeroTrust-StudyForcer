import { useMemo } from "react"
import { Flame } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"

interface StreakChipProps {
  /** Optional override. If provided, uses this date instead of today. */
  today?: string
  /** Optional override className for the wrapper. */
  className?: string
}

/**
 * Phase 2.3: Study Streak Counter (header chip).
 *
 * Pure derivation from `dailyLog` keys — no new state, no new storage.
 * A "day" is considered logged if any active plan has a non-zero
 * `pagesRead` entry in its `dailyLog[date]`.
 *
 * The streak is the number of consecutive days ending at today (or yesterday
 * if today hasn't been logged yet) where every such day was logged.
 */
export default function StreakChip({ today, className = "" }: StreakChipProps) {
  const { label } = usePersonality()
  const allPlans = usePlanStore((s) => s.allPlans)
  const activePlanIds = usePlanStore((s) => s.activePlanIds)

  const streak = useMemo<number>(() => {
    if (allPlans.length === 0) return 0
    // Build a Set of all dates that are "logged" across active plans.
    // A date is logged if any active plan has pagesRead > 0 in dailyLog[date].
    const loggedDates = new Set<string>()
    for (const plan of allPlans) {
      if (!activePlanIds.includes(plan.id)) continue
      for (const [date, log] of Object.entries(plan.dailyLog)) {
        if (log.pagesRead > 0) loggedDates.add(date)
      }
    }
    if (loggedDates.size === 0) return 0

    // Resolve "today" once. If the caller passed an override (e.g. for tests
    // or for a custom start date), use that. Otherwise, use local-time today.
    const baseToday = today ?? localToday()
    const base = new Date(baseToday + "T00:00:00")

    // Walk backward from today. If today is logged, count it; otherwise
    // skip today and start from yesterday. Stop on first unlogged day.
    let count = 0
    const d = new Date(base)
    // Allow today to not yet be logged — start from yesterday in that case.
    if (!loggedDates.has(toDateStr(d))) {
      d.setDate(d.getDate() - 1)
    }
    // Cap at 365 days to avoid runaway loops on garbage state.
    for (let i = 0; i < 365; i++) {
      if (loggedDates.has(toDateStr(d))) {
        count++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }
    return count
  }, [allPlans, activePlanIds, today])

  if (streak === 0) return null

  return (
    <div
      data-testid="streak-chip"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 ${className}`}
      title={label("dayStreak")}
    >
      <Flame className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold tabular-nums">
        {streak}
      </span>
    </div>
  )
}

import { localToday, toDateStr } from "@/lib/date-utils"
