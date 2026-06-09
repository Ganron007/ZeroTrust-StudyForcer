import { useEffect, useRef } from "react"

/**
 * Phase 2.5: useFocusTrap — focus management for modals and popovers.
 *
 * Behavior when active:
 *  - Moves focus to the first focusable element on mount
 *  - Tab / Shift+Tab cycle through the focusable elements within the
 *    container
 *  - Esc fires `onEscape` (caller's choice — most callers close the popover)
 *  - On unmount, returns focus to the element that was focused before
 *    the trap was activated (or to `fallbackFocus` if that element is
 *    no longer in the DOM)
 *
 * WCAG 2.4.3 (focus order) and 2.1.2 (no keyboard trap escape).
 *
 * Usage:
 *   const containerRef = useFocusTrap<HTMLDivElement>({
 *     active: open,
 *     onEscape: () => setOpen(false),
 *   })
 */

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "audio[controls]",
  "video[controls]",
  "iframe",
  "object",
  "embed",
  "[contenteditable]:not([contenteditable='false'])",
].join(",")

export interface UseFocusTrapOptions {
  /** When true, the trap is active. When false, no behavior. */
  active: boolean
  /** Esc key handler. */
  onEscape?: () => void
  /** Element to focus on mount. Defaults to first focusable. */
  initialFocus?: () => HTMLElement | null
  /** Element to focus on unmount. Defaults to previously-focused element. */
  fallbackFocus?: () => HTMLElement | null
  /** If true, the trap also returns focus on unmount. Default true. */
  returnFocusOnUnmount?: boolean
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions,
) {
  const {
    active,
    onEscape,
    initialFocus,
    fallbackFocus,
    returnFocusOnUnmount = true,
  } = options

  const containerRef = useRef<T | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    if (typeof window === "undefined") return

    // Remember which element had focus before the trap opened
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    // Find the container element
    const container = containerRef.current
    if (!container) return

    // Move focus into the container
    const focusTarget =
      initialFocus?.() ??
      (container.querySelector(FOCUSABLE_SELECTORS) as HTMLElement | null) ??
      container
    focusTarget.focus()

    // Trap Tab / Shift+Tab
    const c = container
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        onEscape?.()
        return
      }
      if (e.key !== "Tab") return
      const focusables = Array.from(
        c.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !c.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !c.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    c.addEventListener("keydown", onKeyDown)

    return () => {
      c.removeEventListener("keydown", onKeyDown)
      if (returnFocusOnUnmount) {
        const fallback = fallbackFocus?.()
        const target = fallback ?? previouslyFocusedRef.current
        // Only restore focus if the element is still in the DOM
        if (target && document.contains(target)) {
          target.focus()
        }
      }
    }
  }, [active, onEscape, initialFocus, fallbackFocus, returnFocusOnUnmount])

  return containerRef
}
