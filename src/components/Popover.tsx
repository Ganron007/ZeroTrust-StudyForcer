"use client"

import { useEffect, useRef } from "react"

export type PopoverProps = {
  open: boolean
  onClose: () => void
  /** Reference to the element that anchors the popover (the trigger button). */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Position relative to the anchor. Default: "bottom-end". */
  align?: "start" | "end" | "center"
  /** Width class. Default: w-48. */
  widthClass?: string
  /** ARIA role for the popover content. */
  role?: "menu" | "dialog" | "listbox"
  /** ARIA label for the popover content. */
  ariaLabel?: string
  /** Content rendered inside the popover. */
  children: React.ReactNode
  /** Optional className for the popover container. */
  className?: string
  /** Optional z-index. Default: 50. */
  zIndex?: number
}

/**
 * Lightweight popover primitive.
 *
 * Renders a click-outside-to-close overlay with optional focus trap and
 * Escape handling. The `anchorRef` is used to align the popover to the
 * trigger element. When `anchorRef` is omitted, the popover anchors to
 * the right side of its parent container.
 *
 * Used by AppHeader for theme/mode/notification pickers. Extracted from
 * App.tsx in v2.7.0 to remove the inline popover repetition (4 copies of
 * the same overlay+menu markup).
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "end",
  widthClass = "w-48",
  role,
  ariaLabel,
  children,
  className = "",
  zIndex = 50,
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Focus the first focusable element inside the popover when it opens
  useEffect(() => {
    if (!open) return
    const el = popoverRef.current
    if (!el) return
    const firstFocusable = el.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )
    firstFocusable?.focus()
  }, [open])

  if (!open) return null

  // Position classes
  const alignClass = align === "start" ? "left-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"

  return (
    <>
      {/* Backdrop - click anywhere to close. Stops propagation so the trigger doesn't re-open. */}
      <div
        className="fixed inset-0"
        style={{ zIndex: zIndex - 1 }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div
        ref={popoverRef}
        role={role}
        aria-label={ariaLabel}
        className={`absolute top-full mt-2 ${alignClass} bg-card border border-border rounded-lg shadow-lg p-1 ${widthClass} ${className}`}
        style={{ zIndex: zIndex }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  )
}
