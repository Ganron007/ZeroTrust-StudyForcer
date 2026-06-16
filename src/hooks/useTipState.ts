import { useCallback, useEffect, useState } from "react"
import { createTipPicker } from "../lib/tips"
import { useOverlayState } from "./useOverlayState"
import type { PersonalityMode } from "../lib/personality"

/**
 * Tip popup state — bundles the show/hide flag, the picker, and the current
 * tip. Re-seeds the tip pool when the personality mode changes (different
 * modes have different tip sets).
 *
 * Replaces 3 useStates from App.tsx: showTip, tipPicker, currentTip.
 */
export type TipState = {
  showTip: ReturnType<typeof useOverlayState<null>>
  currentTip: string
  tipNumber: number
  totalTips: number
  nextTip: () => void
}

export function useTipState(mode: PersonalityMode): TipState {
  const showTip = useOverlayState<null>(null)
  // Lazy initial: tipPicker needs `mode` for first build. We use
  // useState's lazy initializer so the picker is only created once.
  const [tipPicker] = useState(() => createTipPicker(mode))
  const [currentTip, setCurrentTip] = useState(() => tipPicker.next())

  // Re-seed the tip pool when the mode changes — different modes
  // have different tip sets. We don't need to keep the picker identity
  // stable; the picker is just a sorted array + current index.
  useEffect(() => {
    tipPicker.setMode(mode)
    setCurrentTip(tipPicker.next())
    // We intentionally depend on `mode` only — the picker is stable
    // across renders. This is the same pattern the v2.3.1 code used.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const nextTip = useCallback(() => {
    setCurrentTip(tipPicker.next())
  }, [tipPicker])

  return {
    showTip,
    currentTip,
    tipNumber: tipPicker.currentIndex,
    totalTips: tipPicker.total,
    nextTip,
  }
}
