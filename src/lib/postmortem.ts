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

// v2.6.0 audit fix: serialize all mutations to prevent
// read-modify-write races. localStorage is single-threaded in
// browsers, but the async/await gap between read and write is wide
// enough for two concurrent operations to interleave. Same pattern
// as plan-storage.ts serialize() and database.ts withDbLock().
let mutationChain: Promise<unknown> = Promise.resolve()

function serialize<T>(op: () => T): Promise<T> {
  const next = mutationChain.then(op)
  mutationChain = next.catch(() => undefined)
  return next
}

function readAll(): Record<string, Postmortem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Record<string, Postmortem>
  } catch {
    // Quarantine corrupt data for manual recovery (same pattern as database.ts)
    try {
      const corruptKey = `${STORAGE_KEY}.corrupt-${Date.now()}`
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) localStorage.setItem(corruptKey, raw)
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
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

export function savePostmortem(postmortem: Postmortem): Promise<void> {
  return serialize(() => {
    const all = readAll()
    all[postmortem.planId] = postmortem
    writeAll(all)
  })
}

export function deletePostmortem(planId: string): Promise<void> {
  return serialize(() => {
    const all = readAll()
    delete all[planId]
    writeAll(all)
  })
}

/**
 * Find plans whose exam date has passed and that don't yet have
 * a postmortem. The ExamPassedBanner surfaces this.
 *
 * v2.6.0 audit fix: reads storage ONCE (not per-plan) to avoid N+1
 * JSON parses. Returns plan IDs sorted by date (oldest first — most
 * overdue appears first).
 */
export function findPlansNeedingPostmortem(
  plans: Array<{ id: string; targetEndDate?: string }>,
  today: string,
): string[] {
  const existing = readAll()
  const candidates: Array<{ id: string; date: number }> = []

  for (const p of plans) {
    if (!p.targetEndDate) continue
    if (existing[p.id]) continue
    const t = new Date(p.targetEndDate + "T00:00:00").getTime()
    if (isNaN(t)) continue
    const now = new Date(today + "T00:00:00").getTime()
    if (t <= now) {
      candidates.push({ id: p.id, date: t })
    }
  }
  // Sort by date ascending — most overdue first.
  candidates.sort((a, b) => a.date - b.date)
  return candidates.map((c) => c.id)
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
