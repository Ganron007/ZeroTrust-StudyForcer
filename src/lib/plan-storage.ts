import { readStorage, writeStorage } from "./database"
import { localToday } from "./date-utils"
import { now, nowMs } from "./clock"

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${nowMs().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// S16: Serialize all plan-storage mutations to prevent TOCTOU races.
// read→modify→write without serialization can lose updates when two
// mutations overlap. This module-level promise chain ensures each mutation
// completes before the next starts.
let mutationChain: Promise<unknown> = Promise.resolve()

function serialize<T>(op: () => Promise<T>): Promise<T> {
  // Only chain on success — on failure, skip to next op so one bad
  // mutation doesn't block the chain.
  const next = mutationChain.then(op)
  mutationChain = next.catch(() => undefined)
  return next
}

export interface ChapterCheck {
  writtenLab?: boolean
  reviewQuestions?: boolean
}

export interface ChapterProgress {
  count: number
  practiceDone?: boolean
  skipped?: boolean
}

export interface DailyLog {
  pagesRead: number
  note?: string
}

export type Anchor = "endDate" | "pagesPerDay"

export interface StudyPlan {
  id: string
  courseId: string
  name: string
  createdAt: string
  updatedAt: string
  startDate: string
  pagesPerDay: number
  studyDays: number[]
  startingChapterId: number
  chapterStartOverrides: Record<number, number>
  /** Optional target end date (YYYY-MM-DD). When anchor="endDate", this is the locked deadline. */
  targetEndDate?: string
  /** Legacy field — kept for migration. Computed on-the-fly for fixedDuration. */
  targetDayCount?: number
  /** The locked anchor: "endDate" or "pagesPerDay". */
  anchor: Anchor
  /** Map of YYYY-MM-DD → daily log. Presence means the day was logged/processed. */
  dailyLog: Record<string, DailyLog>
  /** YYYY-MM-DD date strings of explicitly skipped study days. */
  skippedDays: string[]
  /** Ordered unit IDs for this plan. If absent, the course's default unit order is used. */
  unitOrder?: number[]
}

// readStorage and writeStorage are now imported from ./database
// (they delegate to SQLite in Tauri mode, or localStorage in web/test mode)

export const planStorage = {
  async getAll(): Promise<StudyPlan[]> {
    const { plans } = await readStorage()
    return Object.values(plans).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  },

  async get(id: string): Promise<StudyPlan | null> {
    const { plans } = await readStorage()
    return plans[id] ?? null
  },

  async save(plan: Omit<StudyPlan, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<StudyPlan> {
    return serialize(async () => {
      const data = await readStorage()
      const timestamp = now()
      const id = plan.id ?? generateId()
      const existing = data.plans[id]
      const saved: StudyPlan = {
        ...plan,
        id,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        dailyLog: plan.dailyLog ?? {},
        skippedDays: plan.skippedDays ?? [],
        // S15: `"unitOrder" in plan` correctly handles both cases:
        // - `{ ...plan, unitOrder: undefined }` → key present, value undefined → clears it
        // - `{ ...plan }` (key omitted) → key present from spread, existing value preserved
        unitOrder: "unitOrder" in (plan as Record<string, unknown>) ? plan.unitOrder : existing?.unitOrder,
      }
      data.plans[id] = saved
      // S17: Auto-activate new plans (plans that didn't exist before)
      if (!existing) {
        data.activePlanIds = (data.activePlanIds ?? [])
        if (!data.activePlanIds.includes(id)) {
          data.activePlanIds.push(id)
        }
      }
      await writeStorage(data)
      return saved
    })
  },

  async delete(id: string): Promise<void> {
    return serialize(async () => {
      const data = await readStorage()
      delete data.plans[id]
      data.activePlanIds = (data.activePlanIds ?? []).filter((pid) => pid !== id)
      await writeStorage(data)
    })
  },

  async rename(id: string, name: string): Promise<void> {
    return serialize(async () => {
      const data = await readStorage()
      if (data.plans[id]) {
        data.plans[id].name = name
        data.plans[id].updatedAt = now()
        await writeStorage(data)
      }
    })
  },

  async getActiveIds(): Promise<string[]> {
    // Reads are not serialized (concurrent reads are safe and common)
    const data = await readStorage()
    return data.activePlanIds ?? []
  },

  async setActiveIds(ids: string[]): Promise<void> {
    return serialize(async () => {
      const data = await readStorage()
      data.activePlanIds = ids.filter((id) => data.plans[id])
      data.activePlanIds = data.activePlanIds ?? []
      await writeStorage(data)
    })
  },

  async addActiveId(id: string): Promise<void> {
    return serialize(async () => {
      const data = await readStorage()
      if (!data.plans[id]) return
      // S18: Guard against undefined activePlanIds on legacy data
      data.activePlanIds = data.activePlanIds ?? []
      if (!data.activePlanIds.includes(id)) {
        data.activePlanIds.push(id)
        await writeStorage(data)
      }
    })
  },

  async removeActiveId(id: string): Promise<void> {
    return serialize(async () => {
      const data = await readStorage()
      // S18: Guard against undefined activePlanIds on legacy data
      data.activePlanIds = (data.activePlanIds ?? []).filter((pid) => pid !== id)
      await writeStorage(data)
    })
  },

  async clearAll(): Promise<void> {
    await writeStorage({ plans: {}, activePlanIds: [] })
  },
}

export function defaultPlan(
  courseId: string,
  overrides?: Partial<StudyPlan>,
  courseDefaults?: { pagesPerDay?: number; studyDays?: number[]; startingChapterId?: number },
): Omit<StudyPlan, "id" | "createdAt" | "updatedAt"> {
  return {
    courseId,
    name: "My Study Plan",
    startDate: localToday(),
    pagesPerDay: courseDefaults?.pagesPerDay ?? 20,
    studyDays: courseDefaults?.studyDays ?? [1, 2, 3, 4, 5],
    startingChapterId: courseDefaults?.startingChapterId ?? 1,
    chapterStartOverrides: {},
    targetEndDate: undefined,
    targetDayCount: undefined,
    anchor: "pagesPerDay",
    dailyLog: {},
    skippedDays: [],
    ...overrides,
  }
}
