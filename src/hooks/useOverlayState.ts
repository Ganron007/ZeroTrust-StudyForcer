import { useCallback, useRef, useState } from "react"

/**
 * Generic hook for any "this overlay can be open with optional state" pattern.
 *
 * Replaces the scattered `useState<boolean>` + per-overlay state pair that
 * lives in App.tsx. Each overlay gets one call:
 *
 * ```ts
 * const planner = useOverlayState<{ initialCourseId: string | null }>()
 *
 * // Open with state
 * planner.open({ initialCourseId: "cissp-10th-ed" })
 * // → isOpen === true, state.initialCourseId === "cissp-10th-ed"
 *
 * // Close
 * planner.close()
 * // → isOpen === false, state === { initialCourseId: null } (default)
 * ```
 *
 * State persistence: the state is reset to `initial` on close, so the next
 * open() sees a clean slate unless the caller passes new args.
 */

export type OverlayController<T> = {
  isOpen: boolean
  state: T
  open: (args?: T) => void
  close: () => void
  toggle: () => void
  /** Replace state without changing open/closed. */
  setState: (s: T | ((prev: T) => T)) => void
}

export function useOverlayState<T>(initial: T): OverlayController<T> {
  // Capture the initial value in a ref so the `close` / `toggle` callbacks
  // have stable identity across re-renders. The caller is allowed to pass
  // a fresh object literal each render — we only care about the value
  // on the first render.
  const initialRef = useRef(initial)
  const [isOpen, setIsOpen] = useState(false)
  const [state, setStateRaw] = useState<T>(initial)

  const open = useCallback(
    (args?: T) => {
      if (args !== undefined) setStateRaw(args)
      setIsOpen(true)
    },
    [],
  )

  const close = useCallback(() => {
    setIsOpen(false)
    setStateRaw(initialRef.current)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((v) => {
      if (v) setStateRaw(initialRef.current)
      return !v
    })
  }, [])

  return { isOpen, state, open, close, toggle, setState: setStateRaw }
}
