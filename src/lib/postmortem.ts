/**
 * Phase 0.5.8: Postmortem mode.
 *
 * When a plan's targetEndDate (exam date) passes, surface a banner
 * prompting the user to write a postmortem. The postmortem is a
 * 5-section template:
 *   - Timeline
 *   - Root cause analysis
 *   - What worked
 *   - What didn't
 *   - Action items
 *
 * Stored per-plan in localStorage. The postmortem can be edited
 * later from the planner.
 */

export interface Postmortem {
  /** Plan ID this postmortem belongs to. */
  planId: string
  /** When the postmortem was first created. */
  createdAt: string
  /** When the postmortem was last edited. */
  updatedAt: string
  timeline: string
  rootCause: string
  worked: string
  didnt: string
  actions: string
}

const STORAGE_KEY = "ztsf:postmortems"

function readAll(): Record<string, Postmortem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, Postmortem>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, Postmortem>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn("[postmortem] write failed:", e)
  }
}

export function getPostmortem(planId: string): Postmortem | null {
  return readAll()[planId] ?? null
}

export function savePostmortem(postmortem: Postmortem): void {
  const all = readAll()
  all[postmortem.planId] = postmortem
  writeAll(all)
}

export function deletePostmortem(planId: string): void {
  const all = readAll()
  delete all[planId]
  writeAll(all)
}

/**
 * Find plans whose exam date has passed and that don't yet have
 * a postmortem. The ExamPassedBanner surfaces this.
 */
export function findPlansNeedingPostmortem(
  plans: Array<{ id: string; targetEndDate?: string }>,
  today: string,
): string[] {
  return plans
    .filter((p) => {
      if (!p.targetEndDate) return false
      const t = new Date(p.targetEndDate + "T00:00:00").getTime()
      if (isNaN(t)) return false
      const now = new Date(today + "T00:00:00").getTime()
      return t <= now
    })
    .filter((p) => !getPostmortem(p.id))
    .map((p) => p.id)
}

export function createEmptyPostmortem(planId: string): Postmortem {
  const now = new Date().toISOString()
  return {
    planId,
    createdAt: now,
    updatedAt: now,
    timeline: "",
    rootCause: "",
    worked: "",
    didnt: "",
    actions: "",
  }
}
