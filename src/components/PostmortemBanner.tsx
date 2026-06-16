"use client"

import { useState, useEffect, useMemo } from "react"
import { BookHeart, X, Check } from "lucide-react"
import { usePersonality } from "./PersonalityProvider"
import { usePlanStore } from "@/lib/plan-store"
import { findPlansNeedingPostmortem, getPostmortem, savePostmortem, deletePostmortem, createEmptyPostmortem, type Postmortem } from "@/lib/postmortem"
import { localToday } from "@/lib/date-utils"
import { showToast } from "./NotificationToast"
import { formatStr } from "@/lib/personality"

/**
 * Phase 0.5.8: Postmortem mode.
 *
 * When a plan's exam date passes and the user hasn't yet written a
 * postmortem, surface a banner prompting them. Clicking opens an
 * editor modal with a 5-section template:
 *   - Timeline
 *   - Root cause analysis
 *   - What worked
 *   - What didn't
 *   - Action items
 *
 * Dismissing the banner marks the postmortem as "skipped" (we don't
 * re-prompt after dismissal), but the user can always create one
 * from the planner later.
 */
export function PostmortemBanner() {
  const { label, toast: tToast } = usePersonality()
  const allPlans = usePlanStore((s) => s.allPlans)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const plansNeedingPostmortem = useMemo(() => {
    const today = localToday()
    const candidates = findPlansNeedingPostmortem(allPlans, today)
    return candidates.filter((id) => !dismissed.has(id))
  }, [allPlans, dismissed])

  if (plansNeedingPostmortem.length === 0) return null

  const firstId = plansNeedingPostmortem[0]
  const plan = allPlans.find((p) => p.id === firstId)

  return (
    <>
      <div
        data-testid="postmortem-banner"
        className="rounded-xl mb-4 border border-purple-500/30 bg-purple-500/5 px-4 py-2.5 flex items-center gap-3 flex-wrap"
      >
        <BookHeart className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-sm text-foreground">
          {plansNeedingPostmortem.length === 1 ? (
            <span>
              {formatStr(label("postmortemPrompt"), { planName: plan?.name ?? "your plan" })}
            </span>
          ) : (
            <span>
              {formatStr(label("postmortemPromptMultiple"), {
                count: String(plansNeedingPostmortem.length),
              })}
            </span>
          )}
        </div>
        <button
          onClick={() => setEditingPlanId(firstId)}
          className="text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-500/10 rounded px-2 py-1"
        >
          {label("postmortemWrite")}
        </button>
        <button
          onClick={() => {
            const next = new Set(dismissed)
            next.add(firstId)
            setDismissed(next)
          }}
          className="text-purple-700/60 dark:text-purple-400/60 hover:bg-purple-500/10 rounded p-1"
          title={label("postmortemDismiss")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {editingPlanId && (
        <PostmortemEditor
          planId={editingPlanId}
          onClose={() => setEditingPlanId(null)}
        />
      )}
    </>
  )
}

function PostmortemEditor({ planId, onClose }: { planId: string; onClose: () => void }) {
  const { label, toast: tToast } = usePersonality()
  const allPlans = usePlanStore((s) => s.allPlans)
  const plan = allPlans.find((p) => p.id === planId)
  const [post, setPost] = useState<Postmortem>(() => {
    const existing = getPostmortem(planId)
    return existing ?? createEmptyPostmortem(planId)
  })

  const update = (field: keyof Postmortem, value: string) => {
    setPost((p) => ({ ...p, [field]: value, updatedAt: new Date().toISOString() }))
  }

  const save = async () => {
    try {
      await savePostmortem(post)
      showToast(tToast("postmortemSaved"), "complete")
      onClose()
    } catch (e) {
      console.error("[PostmortemEditor] save failed:", e)
      showToast(tToast("postmortemSaveFailed"), "break")
    }
  }

  const remove = async () => {
    if (!window.confirm(label("postmortemDeleteConfirm"))) return
    await deletePostmortem(planId)
    showToast(tToast("postmortemDeleted"), "info")
    onClose()
  }

  if (!plan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{label("postmortemTitle")}</h3>
            <p className="text-sm text-muted-foreground">{plan.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {(
            [
              ["timeline", "postmortemTimeline"],
              ["rootCause", "postmortemRootCause"],
              ["worked", "postmortemWorked"],
              ["didnt", "postmortemDidnt"],
              ["actions", "postmortemActions"],
            ] as const
          ).map(([field, labelKey]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label(labelKey)}</label>
              <textarea
                value={post[field]}
                onChange={(e) => update(field, e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder={label(`${labelKey}Placeholder` as any)}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={remove}
            className="px-3 py-2 rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive text-sm"
          >
            {label("postmortemDelete")}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted"
          >
            {label("postmortemCancel")}
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {label("postmortemSave")}
          </button>
        </div>
      </div>
    </div>
  )
}
