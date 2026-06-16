"use client"

import { useState, useEffect } from "react"
import { useCourse } from "./CourseProvider"
import { findDomainMatches, buildCreditKey, type DomainMatch } from "@/lib/lab-credit"
import { usePersonality } from "./PersonalityProvider"
import { formatStr } from "@/lib/personality"
import { showToast } from "./NotificationToast"
import type { LabDefinition, LabSession } from "@/lib/lab-sessions"

export type LabCreditPromptProps = {
  /** The most recently logged lab session. */
  session: LabSession | null
  /** The lab definition for the session (used for focus text). */
  lab: LabDefinition | null
  /** Called when the user accepts credit. The session will be updated with `creditedTo`. */
  onAccept: (creditKey: string) => void
  /** Called when the user dismisses the prompt. */
  onDismiss: () => void
}

/**
 * Phase 0.5.6: Lab → exam-domain credit prompt.
 *
 * Surfaces after a lab session is logged, asking the user if they
 * want to credit the minutes to a matching exam domain. Off by
 * default — the user must explicitly accept.
 *
 * Renders nothing if no match is found for the lab's focus.
 */
export function LabCreditPrompt({ session, lab, onAccept, onDismiss }: LabCreditPromptProps) {
  const { courses } = useCourse()
  const { label, toast: tToast } = usePersonality()
  const [matches, setMatches] = useState<DomainMatch[]>([])

  useEffect(() => {
    if (!lab) {
      setMatches([])
      return
    }
    setMatches(findDomainMatches(lab, courses))
  }, [lab, courses])

  if (!session || !lab || matches.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-base font-bold mb-2">{label("labCreditTitle")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatStr(label("labCreditDesc"), {
            lab: lab.name,
            minutes: String(session.minutes),
          })}
        </p>
        <div className="space-y-2 mb-5">
          {matches.map((m) => (
            <button
              key={`${m.courseId}:${m.domainId}`}
              onClick={() => onAccept(buildCreditKey(m.courseId, m.domainId))}
              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{m.domainName}</div>
                  <div className="text-xs text-muted-foreground">{m.courseName}</div>
                </div>
                <span className="text-[10px] text-muted-foreground">+{session.minutes}m</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              showToast(tToast("labCreditDismissed"), "info")
              onDismiss()
            }}
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all"
          >
            {label("labCreditNo")}
          </button>
        </div>
      </div>
    </div>
  )
}
