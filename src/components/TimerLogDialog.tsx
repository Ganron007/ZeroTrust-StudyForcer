"use client"

import { useCallback } from "react"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "../lib/personality"
import { showToast } from "./NotificationToast"

/**
 * Timer-elapsed confirmation dialog. Extracted from App.tsx where it was
 * inline JSX. The user-facing copy ("You studied for Xh Ym") is built from
 * a per-mode `tToast` template + formatStr interpolation.
 *
 * Self-contained: it owns the dialog state through `isOpen` and
 * `minutes`, and fires `onClose` when the user picks Skip or Log.
 */
export type TimerLogDialogProps = {
  isOpen: boolean
  minutes: number
  onClose: () => void
}

export function TimerLogDialog({ isOpen, minutes, onClose }: TimerLogDialogProps) {
  const { label, toast } = usePersonality()

  const handleConfirm = useCallback(() => {
    // A12: If minutes is 0, just close without logging
    if (minutes <= 0) {
      onClose()
      return
    }
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const sessionLabel = h > 0 ? `${h}h ${m}m` : `${m}m`
    showToast(formatStr(toast("sessionLogged"), { label: sessionLabel }), "info")
    onClose()
  }, [minutes, onClose, toast])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold mb-2">{label("logStudySession")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {label("youStudiedFor")}{" "}
          <span className="font-semibold text-foreground">
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </span>
          . {label("logThisToEntry")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
          >
            {label("skip")}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
          >
            {label("logSessionAction")}
          </button>
        </div>
      </div>
    </div>
  )
}
