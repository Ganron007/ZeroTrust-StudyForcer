import { useCallback, useEffect, useState } from "react"
import { usePlanStore } from "../lib/plan-store"

/**
 * Refresh controller — owns `refreshTick` + `refreshing` state and the
 * debounced-spin behavior. Components call `trigger()` to force a
 * reload of plans from storage (typically after Mark Done or after
 * a backup restore).
 *
 * Replaces 2 useStates + the manual `setTimeout(() => setRefreshing(false), 400)`
 * from App.tsx.
 */
const SPIN_DURATION_MS = 400

export type RefreshController = {
  tick: number
  isRefreshing: boolean
  trigger: () => void
  /** Trigger a refresh with a custom message — used by handleRefresh. */
  triggerWithToast: (toast: () => void) => void
}

export function useRefreshController(): RefreshController {
  const loadPlans = usePlanStore((s) => s.loadPlans)
  const [tick, setTick] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Reload plans whenever tick changes (except the initial 0, which is just
  // "not yet triggered"). This is the same pattern App.tsx had inline.
  useEffect(() => {
    if (tick === 0) return
    loadPlans()
  }, [tick, loadPlans])

  const trigger = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  const triggerWithToast = useCallback(
    (toast: () => void) => {
      setIsRefreshing(true)
      setTick((t) => t + 1)
      toast()
      setTimeout(() => setIsRefreshing(false), SPIN_DURATION_MS)
    },
    [],
  )

  return { tick, isRefreshing, trigger, triggerWithToast }
}
